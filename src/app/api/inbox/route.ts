import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, withAuth } from '@/lib/api-utils';

// GET /api/inbox - Get all items awaiting reply/input
export async function GET(request: NextRequest) {
  return withAuth(async (userId) => {
    const { searchParams } = new URL(request.url);

    const myItemsOnly = searchParams.get('mine') === 'true';

    // Get work items awaiting reply (has waitingOnUserId set)
    const awaitingReply = await prisma.workItem.findMany({
      where: {
        waitingOnUserId: { not: null },
        status: { not: 'DONE' },
        ...(myItemsOnly ? { ownerId: userId } : {}),
      },
      include: {
        owner: { select: { id: true, name: true, image: true } },
        requester: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ waitingSince: 'asc' }, { dueAt: 'asc' }],
    });

    // Get blocked items (similar concept - waiting on something)
    const blocked = await prisma.workItem.findMany({
      where: {
        status: 'BLOCKED',
        ...(myItemsOnly ? { ownerId: userId } : {}),
      },
      include: {
        owner: { select: { id: true, name: true, image: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });

    // Get items with recent inbound messages (last 48 hours)
    const recentInbound = await prisma.message.findMany({
      where: {
        direction: 'INBOUND',
        createdAt: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
        },
        readAt: null,
      },
      include: {
        workItem: {
          include: {
            owner: { select: { id: true, name: true, image: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate wait times
    const awaitingWithDuration = awaitingReply.map((item) => ({
      ...item,
      waitingDays: item.waitingSince
        ? Math.floor((Date.now() - new Date(item.waitingSince).getTime()) / (24 * 60 * 60 * 1000))
        : 0,
    }));

    return successResponse({
      awaitingReply: awaitingWithDuration,
      blocked,
      unreadMessages: recentInbound,
      counts: {
        awaiting: awaitingReply.length,
        blocked: blocked.length,
        unread: recentInbound.length,
      },
    });
  });
}
