import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, validationErrorResponse, withAuth } from '@/lib/api-utils';
import { updateSubtaskSchema } from '@/lib/validations';

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/subtasks/[id] - Update a subtask
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAuth(async () => {
    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = updateSubtaskSchema.safeParse(body);
    if (!result.success) {
      return validationErrorResponse(result.error);
    }

    const existing = await prisma.subtask.findUnique({
      where: { id },
      select: { id: true, completedAt: true },
    });

    if (!existing) {
      return errorResponse('Subtask not found', 404);
    }

    const updateData: Record<string, unknown> = {};

    if (result.data.title !== undefined) {
      updateData.title = result.data.title;
    }
    if (result.data.order !== undefined) {
      updateData.order = result.data.order;
    }
    if (result.data.completed !== undefined) {
      updateData.completedAt = result.data.completed ? new Date() : null;
    }

    const subtask = await prisma.subtask.update({
      where: { id },
      data: updateData,
    });

    return successResponse(subtask);
  });
}

// DELETE /api/subtasks/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(async () => {
    const { id } = await params;

    const existing = await prisma.subtask.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return errorResponse('Subtask not found', 404);
    }

    await prisma.subtask.delete({ where: { id } });

    return successResponse({ deleted: true });
  });
}
