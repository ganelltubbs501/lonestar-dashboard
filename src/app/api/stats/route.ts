import { prisma } from '@/lib/db';
import { successResponse, withAuth } from '@/lib/api-utils';
import { WorkItemStatus } from '@prisma/client';

// GET /api/stats - Dashboard statistics
export async function GET() {
  return withAuth(async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get counts by status
    const [
      totalItems,
      activeItems,
      overdueItems,
      blockedItems,
      doneThisWeek,
      byOwner,
      byType,
    ] = await Promise.all([
      prisma.workItem.count(),
      prisma.workItem.count({
        where: {
          status: {
            notIn: [WorkItemStatus.DONE, WorkItemStatus.BACKLOG],
          },
        },
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
          status: WorkItemStatus.DONE,
          updatedAt: { gte: weekAgo },
        },
      }),
      prisma.workItem.groupBy({
        by: ['ownerId'],
        where: {
          status: { notIn: [WorkItemStatus.DONE] },
        },
        _count: true,
      }),
      prisma.workItem.groupBy({
        by: ['type'],
        where: {
          status: { notIn: [WorkItemStatus.DONE] },
        },
        _count: true,
      }),
    ]);

    // Get owner names
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

    const workloadByType = byType.map(t => ({
      type: t.type,
      count: t._count,
    }));

    // Get upcoming items
    const upcomingItems = await prisma.workItem.findMany({
      where: {
        status: { notIn: [WorkItemStatus.DONE] },
        dueAt: { gte: now },
      },
      select: {
        id: true,
        title: true,
        type: true,
        priority: true,
        dueAt: true,
        owner: {
          select: { name: true },
        },
      },
      orderBy: { dueAt: 'asc' },
      take: 5,
    });

    return successResponse({
      totalItems,
      activeItems,
      overdueItems,
      blockedItems,
      doneThisWeek,
      workloadByOwner,
      workloadByType,
      upcomingItems,
    });
  });
}
