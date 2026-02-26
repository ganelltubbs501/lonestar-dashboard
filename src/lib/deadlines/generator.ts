/**
 * Recurring Deliverables Generator
 *
 * Generates upcoming EditorialDeadline rows for recurring ops cadences:
 *   - Newsletter: every Monday
 *   - Events Upload: every Friday
 *   - Weekend Events Post: every Sunday at 5 pm UTC
 *   - Magazine: monthly (15th of each month)
 *
 * Uses cadenceKey for idempotent upserts — safe to run multiple times per day.
 * Manually-created deadlines have cadenceKey = NULL and are never touched.
 */

import { prisma } from "@/lib/db";
import { DeliverableType, DeadlineStatus, RecurrenceType } from "@prisma/client";
import logger from "@/lib/logger";

type DeadlineSpec = {
  cadenceKey: string;
  type: DeliverableType;
  title: string;
  dueAt: Date;
  recurrence: RecurrenceType;
};

/** "2026-03-02" from a Date (uses UTC date parts) */
function dateSlug(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "March 2026" */
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Returns midnight-UTC Date objects for every occurrence of `dayOfWeek`
 * (0=Sun … 6=Sat) within the next `lookaheadDays` days starting from `from`.
 */
function getDatesForDayOfWeek(
  dayOfWeek: number,
  lookaheadDays: number,
  from: Date
): Date[] {
  const results: Date[] = [];
  // start at today's midnight UTC
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (let i = 0; i <= lookaheadDays; i++) {
    if (cursor.getUTCDay() === dayOfWeek) {
      results.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return results;
}

/**
 * Returns unique {year, month} pairs (1-based month) covered by the
 * next `lookaheadDays` days from `from`.
 */
function getMonthsInRange(lookaheadDays: number, from: Date): Array<{ year: number; month: number }> {
  const seen = new Set<string>();
  const result: Array<{ year: number; month: number }> = [];
  const cursor = new Date(from);
  for (let i = 0; i <= lookaheadDays; i++) {
    const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 }); // 1-based
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export async function generateUpcomingDeadlines(lookaheadDays = 35): Promise<{
  created: number;
  skipped: number;
}> {
  const now = new Date();
  const specs: DeadlineSpec[] = [];

  // ── Newsletter: every Monday at 09:00 UTC ────────────────────────────────
  for (const midnight of getDatesForDayOfWeek(1, lookaheadDays, now)) {
    const slug = dateSlug(midnight);
    const dueAt = new Date(midnight);
    dueAt.setUTCHours(9, 0, 0, 0);
    specs.push({
      cadenceKey: `NEWSLETTER_${slug}`,
      type: DeliverableType.NEWSLETTER,
      title: `Newsletter – week of ${slug}`,
      dueAt,
      recurrence: RecurrenceType.WEEKLY,
    });
  }

  // ── Events Upload: every Friday at 12:00 UTC ─────────────────────────────
  for (const midnight of getDatesForDayOfWeek(5, lookaheadDays, now)) {
    const slug = dateSlug(midnight);
    const dueAt = new Date(midnight);
    dueAt.setUTCHours(12, 0, 0, 0);
    specs.push({
      cadenceKey: `EVENTS_UPLOAD_${slug}`,
      type: DeliverableType.EVENTS,
      title: `Events Upload – ${slug}`,
      dueAt,
      recurrence: RecurrenceType.WEEKLY,
    });
  }

  // ── Weekend Events Post: every Sunday at 17:00 UTC ───────────────────────
  for (const midnight of getDatesForDayOfWeek(0, lookaheadDays, now)) {
    const slug = dateSlug(midnight);
    const dueAt = new Date(midnight);
    dueAt.setUTCHours(17, 0, 0, 0);
    specs.push({
      cadenceKey: `WEEKEND_EVENTS_${slug}`,
      type: DeliverableType.EVENTS,
      title: `Weekend Events Post – ${slug}`,
      dueAt,
      recurrence: RecurrenceType.WEEKLY,
    });
  }

  // ── Magazine: monthly on the 15th at 12:00 UTC ──────────────────────────
  for (const { year, month } of getMonthsInRange(lookaheadDays, now)) {
    const dueAt = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0, 0));
    if (dueAt >= now) {
      specs.push({
        cadenceKey: `MAGAZINE_${year}-${String(month).padStart(2, "0")}`,
        type: DeliverableType.MAGAZINE,
        title: `Magazine – ${MONTH_NAMES[month - 1]} ${year}`,
        dueAt,
        recurrence: RecurrenceType.MONTHLY,
      });
    }
  }

  logger.info({ specCount: specs.length, lookaheadDays }, "[DeadlineGen] generating specs");

  // Upsert each spec — create if new, skip (empty update) if already exists.
  // createMany with skipDuplicates is the most efficient path.
  const createResult = await prisma.editorialDeadline.createMany({
    data: specs.map((s) => ({
      cadenceKey: s.cadenceKey,
      type: s.type,
      title: s.title,
      dueAt: s.dueAt,
      isRecurring: true,
      recurrence: s.recurrence,
      status: DeadlineStatus.UPCOMING,
    })),
    skipDuplicates: true,
  });

  const created = createResult.count;
  const skipped = specs.length - created;

  logger.info({ created, skipped, total: specs.length }, "[DeadlineGen] done");

  return { created, skipped };
}
