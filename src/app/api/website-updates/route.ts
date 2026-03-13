import { successResponse, errorResponse, withAuth } from '@/lib/api-utils';
import { fetchSheetValues, getAllSheetNames } from '@/lib/googleSheets';
import { prisma } from '@/lib/db';

const SPREADSHEET_ID = '1F4B_k6H8PKQsFdzdZBRrINX-w_tIcrEiK9gRparIcio';
const MAJOR_EVENTS_SHEET = 'Major Events';

/** Parse a date string like "March 15", "March 15, 2026", "3/15", "3/15/2026".
 *  Returns a Date set to noon UTC on that day, or null if unparseable.
 *  Assumes current year when no year is given; bumps to next year if the date has passed. */
function parseDateCell(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  const now = new Date();
  const currentYear = now.getFullYear();

  // Try native parse first (handles "March 15, 2026", "3/15/2026", ISO, etc.)
  const native = new Date(s);
  if (!isNaN(native.getTime()) && native.getFullYear() > 2000) {
    native.setUTCHours(12, 0, 0, 0);
    return native;
  }

  // "Month Day" e.g. "March 15" or "March 15th"
  const monthDay = s.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/i);
  if (monthDay) {
    const attempt = new Date(`${monthDay[1]} ${monthDay[2]}, ${currentYear}`);
    if (!isNaN(attempt.getTime())) {
      if (attempt < now) attempt.setFullYear(currentYear + 1);
      attempt.setUTCHours(12, 0, 0, 0);
      return attempt;
    }
  }

  // "M/D" e.g. "3/15"
  const slashShort = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashShort) {
    const attempt = new Date(`${slashShort[1]}/${slashShort[2]}/${currentYear}`);
    if (!isNaN(attempt.getTime())) {
      if (attempt < now) attempt.setFullYear(currentYear + 1);
      attempt.setUTCHours(12, 0, 0, 0);
      return attempt;
    }
  }

  return null;
}

async function syncMajorEventsToCalendar(rows: string[][], headers: string[]) {
  // Find date and title column indices (case-insensitive)
  // Matches "Event Month", "Date", "Month", etc.
  const dateIdx = headers.findIndex((h) => /month|date/i.test(h));
  // Prefer a column with "name" in it (e.g. "Event Name") over generic "event"
  const titleIdx = headers.findIndex((h) => /\bname\b/i.test(h));

  if (dateIdx === -1 || titleIdx === -1) return; // can't map without both columns

  const toUpsert: { title: string; dueAt: Date; cadenceKey: string }[] = [];

  for (const row of rows) {
    const rawDate = row[dateIdx] ?? '';
    const rawTitle = row[titleIdx] ?? '';
    if (!rawDate || !rawTitle) continue;

    const dueAt = parseDateCell(rawDate);
    if (!dueAt) continue;

    const cadenceKey = `MAJOR_EVENT_${rawTitle.trim()}_${dueAt.getFullYear()}`;
    toUpsert.push({ title: rawTitle.trim(), dueAt, cadenceKey });
  }

  if (toUpsert.length === 0) return;

  // Upsert: update dueAt/title if key already exists, otherwise create
  await Promise.allSettled(
    toUpsert.map(({ title, dueAt, cadenceKey }) =>
      (prisma as any).editorialDeadline.upsert({
        where: { cadenceKey },
        update: { title, dueAt },
        create: {
          type: 'MAJOR_EVENT',
          title,
          dueAt,
          isRecurring: false,
          cadenceKey,
        },
      })
    )
  );
}

export async function GET() {
  return withAuth(async () => {
    try {
      const sheetNames = await getAllSheetNames(SPREADSHEET_ID);
      if (!sheetNames.length) {
        return errorResponse('No sheets found in spreadsheet', 500);
      }

      const sheets = await Promise.all(
        sheetNames.map(async (name) => {
          const values = await fetchSheetValues(SPREADSHEET_ID, `'${name}'!A:Z`);
          if (!values || values.length === 0) {
            return { name, headers: [], rows: [] };
          }
          const headers = (values[0] as string[]).map((h) => String(h ?? '').trim());
          const rows = values.slice(1).map((row) =>
            headers.map((_, i) => String((row as string[])[i] ?? '').trim())
          );
          return { name, headers, rows };
        })
      );

      // Sync Major Events to calendar (fire and forget — don't block the response)
      const majorEvents = sheets.find((s) => s.name === MAJOR_EVENTS_SHEET);
      if (majorEvents && majorEvents.rows.length > 0) {
        syncMajorEventsToCalendar(majorEvents.rows, majorEvents.headers).catch(() => {});
      }

      return successResponse({ sheets });
    } catch (e: any) {
      return errorResponse(e?.message ?? 'Failed to load spreadsheet', 500);
    }
  });
}
