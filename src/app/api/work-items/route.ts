import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse, validationErrorResponse, withAuth } from '@/lib/api-utils';
import { createWorkItemSchema } from '@/lib/validations';
import logger from '@/lib/logger';
import { WorkItemStatus } from '@prisma/client';

// GET /api/work-items - List all work items with filtering
export async function GET(request: NextRequest) {
  return withAuth(async (userId) => {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') as WorkItemStatus | null;
    const ownerId = searchParams.get('ownerId');
    const type = searchParams.get('type');
    const assignedToMe = searchParams.get('assignedToMe') === 'true';
    const unassigned = searchParams.get('unassigned') === 'true';

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (assignedToMe) where.ownerId = userId;
    if (unassigned) where.ownerId = null;
    if (ownerId && !assignedToMe && !unassigned) where.ownerId = ownerId;

    const items = await prisma.workItem.findMany({
      where,
      include: {
        requester: {
          select: { id: true, name: true, email: true, image: true },
        },
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
        _count: {
          select: { subtasks: true, comments: true },
        },
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { dueAt: 'asc' },
      ],
      take: 200, // safety cap — board uses client-side filtering on this set
    });

    return successResponse(items);
  });
}

// POST /api/work-items - Create a new work item
export async function POST(request: NextRequest) {
  return withAuth(async (userId) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = createWorkItemSchema.safeParse(body);
    if (!result.success) {
      return validationErrorResponse(result.error);
    }

    const { type, title, description, priority, dueAt, ownerId, tags } = result.data;

    // Get template for this type to create subtasks
    const template = await prisma.triggerTemplate.findFirst({
      where: { workItemType: type, isActive: true },
    });

    const workItem = await prisma.workItem.create({
      data: {
        type,
        title,
        description: description || '',
        priority,
        dueAt: dueAt ? new Date(dueAt) : template
          ? new Date(Date.now() + template.dueDaysOffset * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        requesterId: userId,
        ownerId: ownerId || null,
        tags: tags,
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true, image: true },
        },
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Create subtasks from template (subtasks is now Json type in schema)
    if (template && template.subtasks) {
      const subtaskData = template.subtasks as Array<{ title: string; offsetDays?: number }>;
      await prisma.subtask.createMany({
        data: subtaskData.map((st, index) => ({
          workItemId: workItem.id,
          title: st.title,
          order: index,
        })),
      });
    }

    // Log activity
    await prisma.auditLog.create({
      data: {
        workItemId: workItem.id,
        userId,
        action: 'created',
        meta: { title: workItem.title, type: workItem.type },
      },
    });

    logger.info({ workItemId: workItem.id, type, userId }, 'Work item created');

    return successResponse(workItem, 201);
  });
}
