import { prisma } from '@/lib/db';
import { successResponse, withAdminAuth } from '@/lib/api-utils';

// GET /api/admin/sync-status — recent sync runs for the admin dashboard
export async function GET() {
  return withAdminAuth(async () => {
    const recentRuns = await prisma.sheetsImportRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const lastRun = recentRuns[0] ?? null;

    // A "recent failure" is any FAILED run in the last 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hasRecentFailure = recentRuns.some(
      (r) => r.status === 'FAILED' && new Date(r.createdAt) >= cutoff
    );

    return successResponse({ recentRuns, lastRun, hasRecentFailure });
  });
}
