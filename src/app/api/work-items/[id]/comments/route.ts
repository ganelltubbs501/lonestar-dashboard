import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, validationErrorResponse, withAuth } from '@/lib/api-utils';
import { createCommentSchema } from '@/lib/validations';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/work-items/[id]/comments
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(async () => {
    const { id } = await params;

    const comments = await prisma.comment.findMany({
      where: { workItemId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return successResponse(comments);
  });
}

// POST /api/work-items/[id]/comments
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(async (userId) => {
    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = createCommentSchema.safeParse(body);
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

    const comment = await prisma.comment.create({
      data: {
        workItemId: id,
        userId,
        body: result.data.body,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        workItemId: id,
        userId,
        action: 'comment_added',
        meta: { commentId: comment.id },
      },
    });

    return successResponse(comment, 201);
  });
}
