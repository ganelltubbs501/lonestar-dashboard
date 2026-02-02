import { prisma } from '@/lib/db';
import { errorResponse, successResponse, withAdminAuth } from '@/lib/api-utils';
import { MagazineItemType, MagazineSection } from '@prisma/client';

type ImportBody = {
  year: number;
  month: number; // 1-12
  csvText: string;
  overwrite?: boolean; // default true
};

function parseBool(v: string | undefined | null) {
  const s = (v ?? '').trim().toLowerCase();
  if (!s) return null;
  return s === 'true' || s === 'yes' || s === '1';
}

function isUrl(s: string) {
  return /^https?:\/\//i.test(s.trim());
}

// Auto-detect CSV vs TSV delimiter
function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

// Parse delimited text (CSV or TSV) into rows
function parseDelimited(text: string) {
  const delim = detectDelimiter(text);

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, '')) // strip BOM
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  const rows = lines.map((line) => line.split(delim).map((cell) => cell.trim()));

  return rows;
}

// Header normalization helpers
function norm(h: string) {
  return h.replace(/^\uFEFF/, '').trim().toUpperCase();
}

function findHeaderIndex(headers: string[], candidates: string[]) {
  const normalized = headers.map(norm);

  for (const candidate of candidates) {
    const c = norm(candidate);
    const idx = normalized.findIndex((h) => h === c);
    if (idx >= 0) return idx;
  }
  return -1;
}

function findHeaderIndexByIncludes(headers: string[], includesAny: string[]) {
  const normalized = headers.map(norm);

  for (const inc of includesAny) {
    const needle = norm(inc);
    const idx = normalized.findIndex((h) => h.includes(needle));
    if (idx >= 0) return idx;
  }
  return -1;
}

function sectionFromLabel(label: string): MagazineSection {
  const key = label.trim().toLowerCase();
  if (key === 'ads') return MagazineSection.ADS;
  if (key === 'sponsored editorial reviews') return MagazineSection.SPONSORED_EDITORIAL_REVIEWS;
  if (key === 'book campaigns') return MagazineSection.BOOK_CAMPAIGNS;
  if (key === 'texas books preview') return MagazineSection.TEXAS_BOOKS_PREVIEW;
  if (key.includes('events')) return MagazineSection.EVENTS;

  // "Front" signals
  if (['cover', 'letter from the editor', 'video from the editor', 'contributors'].includes(key)) {
    return MagazineSection.FRONT;
  }

  return MagazineSection.OTHER;
}

function issueDueAtUtcNoon(year: number, month: number) {
  // Due date is 19th. Store at 12:00 UTC so it stays "the 19th" in most timezones.
  return new Date(Date.UTC(year, month - 1, 19, 12, 0, 0));
}

function currentSectionFromLabelFallback(currentSection: MagazineSection, content: string) {
  // If the section wasn't set (because the sheet doesn't use explicit headers for early rows),
  // infer from known front-of-issue items.
  if (currentSection !== MagazineSection.OTHER) return currentSection;
  return sectionFromLabel(content);
}

export async function POST(req: Request) {
  return withAdminAuth(async () => {
    const body = (await req.json().catch(() => null)) as ImportBody | null;
    if (!body) return errorResponse('Invalid JSON body', 400);

    const { year, month, csvText } = body;
    const overwrite = body.overwrite ?? true;

    if (!year || !month || month < 1 || month > 12) {
      return errorResponse('year and month (1-12) are required', 400);
    }
    if (!csvText || typeof csvText !== 'string') {
      return errorResponse('csvText is required', 400);
    }

    const rows = parseDelimited(csvText);

    if (rows.length < 2) return errorResponse('CSV/TSV appears empty', 400);

    // Header row: find indexes with flexible matching
    const headers = rows[0];

    const contentIdx = findHeaderIndex(headers, [
      'CONTENT',
      'CONTENT MAP',
      'ITEM',
      'TITLE',
      'DELIVERABLE',
      'NAME',
    ]);

    if (contentIdx < 0) {
      return errorResponse(`CSV missing a content/title column. Found headers: ${headers.join(', ')}`, 400);
    }

    // Proofed is clean
    const proofIdx = findHeaderIndex(headers, ['PROOFED', 'PROOF']);

    // Folder column is not standard in your sheet name ("In February Folder")
    // so match by "FOLDER" contains
    const folderIdx =
      findHeaderIndex(headers, ['IN FOLDER', 'FOLDER']) >= 0
        ? findHeaderIndex(headers, ['IN FOLDER', 'FOLDER'])
        : findHeaderIndexByIncludes(headers, ['FOLDER']);

    // URL optional (some sheets don't have it)
    const urlIdx = findHeaderIndex(headers, ['URL', 'LINK', 'HYPERLINK']);

    // Ad size column
    const adSizeIdx =
      findHeaderIndex(headers, ['AD SIZE', 'ADSIZE', 'SIZE']) >= 0
        ? findHeaderIndex(headers, ['AD SIZE', 'ADSIZE', 'SIZE'])
        : 3; // fallback to column 4

    // Theme color appears in the first couple rows in far-right columns (in your export)
    let themeColor: string | null = null;
    for (let i = 1; i < Math.min(rows.length, 6); i++) {
      const maybe = rows[i].find((c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c));
      if (maybe) {
        themeColor = maybe;
        break;
      }
    }

    const title = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const dueAt = issueDueAtUtcNoon(year, month);

    const issue = await prisma.magazineIssue.upsert({
      where: { year_month: { year, month } },
      update: { title, themeColor: themeColor ?? undefined, dueAt },
      create: { year, month, title, themeColor: themeColor ?? undefined, dueAt },
    });

    if (overwrite) {
      await prisma.magazineItem.deleteMany({ where: { issueId: issue.id } });
    }

    let currentSection: MagazineSection = MagazineSection.OTHER;
    let sortOrder = 0;
    let lastItemId: string | null = null;

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const content = (cols[contentIdx] ?? '').toString().trim();
      const rowUrl = urlIdx >= 0 ? (cols[urlIdx] ?? '').toString().trim() : '';
      const proofedVal = proofIdx >= 0 ? parseBool(cols[proofIdx]) : null;
      const folderVal = folderIdx >= 0 ? parseBool(cols[folderIdx]) : null;
      const adSize = (cols[adSizeIdx] ?? '').toString().trim();

      // Skip fully blank / separator-ish rows
      if (!content && proofedVal === false && folderVal === false) {
        continue;
      }
      if (!content) {
        continue;
      }

      // URL rows attach to previous item if possible
      if (isUrl(content)) {
        if (lastItemId) {
          await prisma.magazineItem.update({
            where: { id: lastItemId },
            data: { url: content },
          });
        } else {
          // no previous item: store as URL_ONLY
          const item = await prisma.magazineItem.create({
            data: {
              issueId: issue.id,
              section: currentSection,
              kind: MagazineItemType.URL_ONLY,
              title: 'Link',
              url: content,
              sortOrder: sortOrder++,
            },
          });
          lastItemId = item.id;
        }
        continue;
      }

      // Section header rows (Proofed/Folder empty)
      if (proofedVal === null && folderVal === null) {
        currentSection = sectionFromLabel(content);
        // optional: store header as an item (I skip by default)
        continue;
      }

      // Determine URL: prefer dedicated column, fallback to next-row detection
      let itemUrl: string | undefined = isUrl(rowUrl) ? rowUrl : undefined;

      // Ads: title row followed by URL row (common in your sheet)
      if (currentSection === MagazineSection.ADS && adSize) {
        const nextCols = rows[i + 1] ?? [];
        const nextContent = (nextCols[contentIdx] ?? '').toString().trim();

        // If no URL from column, check next row
        if (!itemUrl && isUrl(nextContent)) {
          itemUrl = nextContent;
          i++; // skip the URL row
        }

        const item = await prisma.magazineItem.create({
          data: {
            issueId: issue.id,
            section: currentSection,
            kind: MagazineItemType.AD,
            title: content,
            adSize,
            proofed: proofedVal ?? false,
            inFolder: folderVal ?? false,
            url: itemUrl,
            sortOrder: sortOrder++,
          },
        });
        lastItemId = item.id;
        continue;
      }

      // Subitems (e.g., "with Emily Smith")
      const kind =
        content.toLowerCase().startsWith('with ') ? MagazineItemType.SUBITEM : MagazineItemType.ITEM;

      const item = await prisma.magazineItem.create({
        data: {
          issueId: issue.id,
          section: currentSectionFromLabelFallback(currentSection, content),
          kind,
          title: content,
          url: itemUrl,
          proofed: proofedVal ?? false,
          inFolder: folderVal ?? false,
          sortOrder: sortOrder++,
          // default behavior: if not proofed, mark needsProofing
          needsProofing: proofedVal === false,
        },
      });

      lastItemId = item.id;
    }

    return successResponse({ issueId: issue.id, title: issue.title, importedItems: sortOrder });
  });
}
