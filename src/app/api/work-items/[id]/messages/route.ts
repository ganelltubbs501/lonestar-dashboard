import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, withAuth } from '@/lib/api-utils';
import { z } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

const createMessageSchema = z.object({
  body: z.string().min(1).max(5000),
  direction: z.enum(['INBOUND', 'OUTBOUND', 'INTERNAL']),
  channel: z.enum(['INTERNAL', 'EMAIL', 'PHONE', 'OTHER']).default('INTERNAL'),
  externalEmail: z.string().email().nullable().optional(),
  externalName: z.string().nullable().optional(),
});

// GET /api/work-items/[id]/messages - Get message thread for a work item
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(async () => {
    const { id } = await params;

    const messages = await prisma.message.findMany({
      where: { workItemId: id },
      orderBy: { createdAt: 'asc' },
    });

    return successResponse(messages);
  });
}

// POST /api/work-items/[id]/messages - Add a message to the thread
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(async (userId) => {
    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = createMessageSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('Validation failed: ' + JSON.stringify(result.error.issues));
    }

    // Check work item exists
    const workItem = await prisma.workItem.findUnique({
      where: { id },
      select: { id: true, waitingOnUserId: true },
    });

    if (!workItem) {
      return errorResponse('Work item not found', 404);
    }

    const message = await prisma.message.create({
      data: {
        workItemId: id,
        body: result.data.body,
        direction: result.data.direction,
        channel: result.data.channel,
        externalEmail: result.data.externalEmail || null,
        externalName: result.data.externalName || null,
        senderId: userId,
        sentAt: result.data.direction !== 'INBOUND' ? new Date() : null,
      },
    });

    // Update work item based on message direction
    const workItemUpdate: Record<string, unknown> = {};

    if (result.data.direction === 'OUTBOUND') {
      // We sent something - mark as waiting for reply
      workItemUpdate.waitingReason = 'Awaiting reply';
      workItemUpdate.waitingSince = new Date();
      workItemUpdate.lastContactedAt = new Date();
    } else if (result.data.direction === 'INBOUND') {
      // We received a reply - no longer waiting
      workItemUpdate.waitingOnUserId = null;
      workItemUpdate.waitingReason = null;
      workItemUpdate.waitingSince = null;
    }

    if (Object.keys(workItemUpdate).length > 0) {
      await prisma.workItem.update({
        where: { id },
        data: workItemUpdate,
      });
    }

    // Log activity
    await prisma.auditLog.create({
      data: {
        workItemId: id,
        userId,
        action: 'message_added',
        meta: {
          direction: result.data.direction,
          channel: result.data.channel,
        },
      },
    });

    return successResponse(message, 201);
  });
}
