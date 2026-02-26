import { prisma } from '@/lib/db';
import { successResponse, withAdminAuth } from '@/lib/api-utils';

// GET /api/admin/health — system health snapshot for the admin dashboard
export async function GET() {
  return withAdminAuth(async () => {
    // 1. DB connectivity
    let dbOk = false;
    let dbError: string | null = null;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch (e: any) {
      dbError = e?.message ?? 'Unknown DB error';
    }

    // 2. Last Sheets sync run
    const lastSheetsSync = await prisma.sheetsImportRun.findFirst({
      orderBy: { createdAt: 'desc' },
    }).catch(() => null);

    // 3. Last recurrence run (generate-deadlines job)
    const lastRecurrence = await (prisma as any).cronRunLog
      .findFirst({
        where: { jobName: 'generate-deadlines' },
        orderBy: { createdAt: 'desc' },
      })
      .catch(() => null);

    // 4. Last Texas Authors cron run
    const lastTxSync = await (prisma as any).cronRunLog
      .findFirst({
        where: { jobName: 'texas-authors-sync' },
        orderBy: { createdAt: 'desc' },
      })
      .catch(() => null);

    // 5. Upcoming deadlines counts (validation that generator is running)
    const now = new Date();
    const in28Days = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = await prisma.editorialDeadline.count({
      where: { dueAt: { gte: now, lte: in28Days } },
    }).catch(() => null);

    // 6. Cloud Run revision (injected by the platform automatically)
    const revision = process.env.K_REVISION ?? null;
    const service = process.env.K_SERVICE ?? null;

    return successResponse({
      checkedAt: new Date().toISOString(),
      db: { ok: dbOk, error: dbError },
      lastSheetsSync,
      lastRecurrence,
      lastTxSync,
      upcomingDeadlines,
      revision,
      service,
    });
  });
}
