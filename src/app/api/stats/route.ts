import { prisma } from '@/lib/db';
import { successResponse, withAuth } from '@/lib/api-utils';
import { WorkItemStatus, WorkItemType, DeadlineStatus } from '@prisma/client';

// 30-second module-level cache. Each Cloud Run instance caches independently,
// which is fine — the goal is reducing per-instance DB load on rapid reloads.
let statsCache: { payload: unknown; expiresAt: number } | null = null;
const STATS_TTL_MS = 30_000;

// GET /api/stats - Dashboard statistics
export async function GET() {
  return withAuth(async () => {
    const tsNow = Date.now();
    if (statsCache && tsNow < statsCache.expiresAt) {
      return successResponse(statsCache.payload);
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Start of this week (Sunday midnight local, treated as UTC for simplicity)
    const startOfWeek = new Date(now);
    startOfWeek.setUTCHours(0, 0, 0, 0);
    startOfWeek.setUTCDate(now.getUTCDate() - now.getUTCDay());

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 7);

    const [
      totalItems,
      activeItems,
      overdueItems,
      blockedItems,
      waitingItems,
      doneThisWeek,
      dueSoonItems,
      serUnassigned,
      serDueSoon,
      byOwner,
    ] = await Promise.all([
      prisma.workItem.count(),
      prisma.workItem.count({
        where: { status: { notIn: [WorkItemStatus.DONE, WorkItemStatus.BACKLOG] } },
      }),
      prisma.workItem.count({
        where: {
          status: { notIn: [WorkItemStatus.DONE] },
          dueAt: { lt: now },
        },
      }),
      prisma.workItem.count({
        where: { status: WorkItemStatus.BLOCKED },
      }),
      prisma.workItem.count({
        where: {
          status: { notIn: [WorkItemStatus.DONE] },
          waitingOnUserId: { not: null },
        },
      }),
      prisma.workItem.count({
        where: {
          status: WorkItemStatus.DONE,
          updatedAt: { gte: weekAgo },
        },
      }),
      prisma.workItem.count({
        where: {
          status: { notIn: [WorkItemStatus.DONE] },
          dueAt: { gte: now, lte: in7Days },
        },
      }),
      // SER: unassigned and not done
      prisma.workItem.count({
        where: {
          type: WorkItemType.SPONSORED_EDITORIAL_REVIEW,
          status: { notIn: [WorkItemStatus.DONE] },
          ownerId: null,
        },
      }),
      // SER: has due date within 14 days and not done
      prisma.workItem.count({
        where: {
          type: WorkItemType.SPONSORED_EDITORIAL_REVIEW,
          status: { notIn: [WorkItemStatus.DONE] },
          dueAt: { gte: now, lte: in14Days },
        },
      }),
      prisma.workItem.groupBy({
        by: ['ownerId'],
        where: { status: { notIn: [WorkItemStatus.DONE] } },
        _count: true,
      }),
    ]);

    // Events upload status for this week
    const eventsUploadThisWeek = await prisma.editorialDeadline.findFirst({
      where: {
        cadenceKey: { startsWith: 'EVENTS_UPLOAD_' },
        dueAt: { gte: startOfWeek, lt: endOfWeek },
      },
      select: { id: true, title: true, dueAt: true, status: true },
    });

    // Owner names for workload chart
    const ownerIds = byOwner.map(o => o.ownerId).filter(Boolean) as string[];
    const owners = await prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, name: true },
    });
    const ownerMap = Object.fromEntries(owners.map(o => [o.id, o.name]));
    const workloadByOwner = byOwner.map(o => ({
      name: o.ownerId ? ownerMap[o.ownerId] || 'Unknown' : 'Unassigned',
      count: o._count,
    }));

    const MILESTONE_LABEL: Record<string, string> = {
      SIGNUP_DEADLINE:    'Signup Deadline',
      GRAPHICS_DUE:       'Graphics Due',
      FOLDER_TO_REVIEWERS:'To Reviewers',
      WRAP_UP:            'Wrap-Up',
    };

    // 14-day spine: editorial deadlines + work items + campaign milestones + magazine issues
    type MilestoneRow = {
      id: string; type: string; planned_at: Date;
      campaign_title: string; owner_name: string | null;
    };

    const [spineDeadlines, spineWorkItems, spineMilestones, spineMagazines] = await Promise.all([
      prisma.editorialDeadline.findMany({
        where: {
          dueAt: { gte: now, lte: in14Days },
          status: { not: DeadlineStatus.COMPLETED },
        },
        select: { id: true, title: true, type: true, dueAt: true, status: true, isRecurring: true },
        orderBy: { dueAt: 'asc' },
        take: 30,
      }),
      prisma.workItem.findMany({
        where: {
          status: { notIn: [WorkItemStatus.DONE] },
          dueAt: { gte: now, lte: in14Days },
        },
        select: {
          id: true, title: true, type: true, priority: true, dueAt: true, status: true,
          owner: { select: { name: true } },
        },
        orderBy: { dueAt: 'asc' },
        take: 30,
      }),
      prisma.$queryRaw<MilestoneRow[]>`
        SELECT m.id, m.type, m."plannedAt" AS planned_at,
               w.title AS campaign_title, u.name AS owner_name
        FROM "CampaignMilestone" m
        JOIN "WorkItem" w ON w.id = m."workItemId"
        LEFT JOIN "User" u ON u.id = w."ownerId"
        WHERE m."plannedAt" >= ${now} AND m."plannedAt" <= ${in14Days}
          AND m."completedAt" IS NULL
        ORDER BY m."plannedAt" ASC
        LIMIT 20
      `,
      (prisma as any).magazineIssue.findMany({
        where: { dueAt: { gte: now, lte: in14Days } },
        select: { id: true, title: true, dueAt: true },
        orderBy: { dueAt: 'asc' },
        take: 10,
      }) as Promise<{ id: string; title: string; dueAt: Date }[]>,
    ]);

    const spine14Days = [
      ...spineDeadlines.map(d => ({
        id: d.id,
        kind: 'deadline' as const,
        title: d.title,
        deliverableType: d.type as string,
        dueAt: d.dueAt,
        status: d.status,
        isRecurring: d.isRecurring,
      })),
      ...spineWorkItems.map(w => ({
        id: w.id,
        kind: 'workItem' as const,
        title: w.title,
        deliverableType: w.type as string,
        dueAt: w.dueAt!,
        status: w.status,
        priority: w.priority,
        ownerName: w.owner?.name ?? null,
      })),
      ...spineMilestones.map(m => ({
        id: m.id,
        kind: 'deadline' as const,
        title: `${m.campaign_title} — ${MILESTONE_LABEL[m.type] ?? m.type}`,
        deliverableType: 'CAMPAIGN',
        dueAt: m.planned_at,
        status: 'UPCOMING',
        ownerName: m.owner_name ?? null,
      })),
      ...spineMagazines.map((m: { id: string; title: string; dueAt: Date }) => ({
        id: m.id,
        kind: 'deadline' as const,
        title: `${m.title} — Issue Due`,
        deliverableType: 'MAGAZINE',
        dueAt: m.dueAt,
        status: 'UPCOMING',
      })),
    ].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    const payload = {
      // Tile counts
      totalItems,
      activeItems,
      overdueItems,
      blockedItems,
      waitingItems,
      dueSoonItems,
      doneThisWeek,
      // SER
      serUnassigned,
      serDueSoon,
      // Upcoming campaign milestones + magazine issues in next 14 days
      upcomingMilestones: spineMilestones.length + spineMagazines.length,
      // Events
      eventsUploadThisWeek,
      // Spine
      spine14Days,
      // Chart
      workloadByOwner,
    };

    statsCache = { payload, expiresAt: Date.now() + STATS_TTL_MS };
    return successResponse(payload);
  });
}
