import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, withAuth } from '@/lib/api-utils';
import { MagazineItemType, MagazineSection } from '@prisma/client';
import { parseFolderIdFromUrl, listDriveFolder, folderNameToSection } from '@/lib/googleDrive';

// ── GET /api/magazine/issues ─────────────────────────────────────────────────

export async function GET() {
  return withAuth(async () => {
    const issues = await prisma.magazineIssue.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: {
        id: true, year: true, month: true, title: true,
        dueAt: true, themeColor: true,
        theme: true, driveLink: true,
      },
      take: 24,
    });
    return successResponse(issues);
  });
}

// ── POST /api/magazine/issues — create issue from Google Drive folder ─────────

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const body = await req.json().catch(() => null) as {
      month: number;
      year: number;
      theme: string;
      driveLink: string;
    } | null;

    if (!body) return errorResponse('Invalid JSON', 400);

    const { month, year, theme, driveLink } = body;

    if (!year || !month || month < 1 || month > 12)
      return errorResponse('year and month (1–12) are required', 400);
    if (!theme?.trim())
      return errorResponse('theme is required', 400);
    if (!driveLink?.trim())
      return errorResponse('driveLink is required', 400);

    const folderId = parseFolderIdFromUrl(driveLink.trim());
    if (!folderId)
      return errorResponse('Could not parse a Drive folder ID from the URL', 400);

    // ── Read Drive folder ──────────────────────────────────────────────────────
    let topLevel;
    try {
      topLevel = await listDriveFolder(folderId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Drive API error';
      return errorResponse(`Drive error: ${msg}`, 502);
    }

    // ── Upsert issue ───────────────────────────────────────────────────────────
    const title = new Date(year, month - 1, 1).toLocaleString('en-US', {
      month: 'long', year: 'numeric',
    });
    const dueAt = new Date(Date.UTC(year, month - 1, 19, 12, 0, 0));

    const issue = await prisma.magazineIssue.upsert({
      where:  { year_month: { year, month } },
      update: { title, theme: theme.trim(), driveLink: driveLink.trim(), dueAt },
      create: { year, month, title, theme: theme.trim(), driveLink: driveLink.trim(), dueAt },
    });

    // Clear existing items (overwrite)
    await prisma.magazineItem.deleteMany({ where: { issueId: issue.id } });

    // ── Build items from Drive contents ────────────────────────────────────────
    type NewItem = {
      issueId:      string;
      section:      MagazineSection;
      kind:         MagazineItemType;
      title:        string;
      url:          string | null;
      dueAt:        Date;
      sortOrder:    number;
      needsProofing: boolean;
    };

    const items: NewItem[] = [];
    let order = 0;

    const subfolders = topLevel.filter((f) => f.isFolder);
    const rootFiles  = topLevel.filter((f) => !f.isFolder);

    // Files in the root → OTHER section
    for (const file of rootFiles) {
      items.push({
        issueId: issue.id, section: MagazineSection.OTHER,
        kind: MagazineItemType.ITEM, title: file.name,
        url: file.webViewLink, dueAt, sortOrder: order++, needsProofing: true,
      });
    }

    // Subfolders → map name to section, list their files
    for (const sf of subfolders) {
      const section = folderNameToSection(sf.name);
      let sfFiles;
      try {
        sfFiles = await listDriveFolder(sf.id);
      } catch {
        continue; // skip inaccessible subfolders
      }
      for (const file of sfFiles.filter((f) => !f.isFolder)) {
        items.push({
          issueId: issue.id, section, kind: MagazineItemType.ITEM,
          title: file.name, url: file.webViewLink, dueAt,
          sortOrder: order++, needsProofing: true,
        });
      }
    }

    if (items.length > 0) {
      await prisma.magazineItem.createMany({ data: items });
    }

    return successResponse({
      issueId:       issue.id,
      title:         issue.title,
      importedItems: items.length,
    });
  });
}
