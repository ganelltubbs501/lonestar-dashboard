import { prisma } from '@/lib/db';
import { successResponse, withAuth } from '@/lib/api-utils';
import { WorkItemTypeLabel } from '@/lib/utils';
import { WorkItemStatus } from '@prisma/client';

type RawCycleRow = {
  type: string;
  avg_days: number;
  median_days: number;
  count: bigint;
};

type RawOverallRow = {
  avg_days: number;
  count: bigint;
};

// GET /api/metrics/cycle-time — avg days created→done by type + bottleneck items
export async function GET() {
  return withAuth(async () => {
    const [byTypeRows, overallRows] = await Promise.all([
      prisma.$queryRaw<RawCycleRow[]>`
        SELECT
          type::text AS type,
          ROUND(AVG(
            EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400
          )::numeric, 1)::float AS avg_days,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400
          )::numeric, 1)::float AS median_days,
          COUNT(*) AS count
        FROM "WorkItem"
        WHERE "completedAt" IS NOT NULL AND status = 'DONE'
        GROUP BY type
        ORDER BY avg_days DESC NULLS LAST
      `,
      prisma.$queryRaw<RawOverallRow[]>`
        SELECT
          ROUND(AVG(
            EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400
          )::numeric, 1)::float AS avg_days,
          COUNT(*) AS count
        FROM "WorkItem"
        WHERE "completedAt" IS NOT NULL AND status = 'DONE'
      `,
    ]);

    const overall = {
      avgDays: overallRows[0]?.avg_days ?? null,
      count: Number(overallRows[0]?.count ?? 0),
    };

    const byType = byTypeRows.map((r) => ({
      type: r.type,
      label: (WorkItemTypeLabel as Record<string, string>)[r.type] ?? r.type,
      avgDays: r.avg_days,
      medianDays: r.median_days,
      count: Number(r.count),
    }));

    // Bottleneck detection: items stuck in BLOCKED or NEEDS_QA > 3 days.
    // Use updatedAt for the threshold — statusChangedAt is Week 4 data and
    // unavailable in the local stale Prisma client select types.
    const stuckThreshold = new Date(Date.now() - 3 * 86400000);

    const bottleneckSelect = {
      id: true,
      title: true,
      type: true,
      updatedAt: true,
      owner: { select: { name: true } },
    } as const;

    const [blocked, needsQa] = await Promise.all([
      prisma.workItem.findMany({
        where: { status: WorkItemStatus.BLOCKED, updatedAt: { lte: stuckThreshold } },
        select: bottleneckSelect,
        orderBy: { updatedAt: 'asc' },
        take: 20,
      }),
      prisma.workItem.findMany({
        where: { status: WorkItemStatus.NEEDS_QA, updatedAt: { lte: stuckThreshold } },
        select: bottleneckSelect,
        orderBy: { updatedAt: 'asc' },
        take: 20,
      }),
    ]);

    const toBottleneck = (item: (typeof blocked)[0]) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      owner: item.owner,
      daysStuck: Math.floor((Date.now() - item.updatedAt.getTime()) / 86400000),
    });

    return successResponse({
      overall,
      byType,
      bottlenecks: {
        blocked: blocked.map(toBottleneck),
        needsQa: needsQa.map(toBottleneck),
      },
    });
  });
}
