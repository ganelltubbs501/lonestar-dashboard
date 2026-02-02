import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, validationErrorResponse, withAuth } from '@/lib/api-utils';
import { createSubtaskSchema } from '@/lib/validations';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/work-items/[id]/subtasks
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(async () => {
    const { id } = await params;

    const subtasks = await prisma.subtask.findMany({
      where: { workItemId: id },
      orderBy: { order: 'asc' },
    });

    return successResponse(subtasks);
  });
}

// POST /api/work-items/[id]/subtasks
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(async () => {
    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = createSubtaskSchema.safeParse(body);
    if (!result.success) {
      return validationErrorResponse(result.error);
    }

    // Check work item exists
    const workItem = await prisma.workItem.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!workItem) {
      return errorResponse('Work item not found', 404);
    }

    // Get max order
    const maxOrder = await prisma.subtask.findFirst({
      where: { workItemId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const subtask = await prisma.subtask.create({
      data: {
        workItemId: id,
        title: result.data.title,
        order: result.data.order ?? (maxOrder?.order ?? -1) + 1,
      },
    });

    return successResponse(subtask, 201);
  });
}
