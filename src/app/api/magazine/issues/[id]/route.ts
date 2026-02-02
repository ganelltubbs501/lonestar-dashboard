import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse, successResponse, withAuth } from '@/lib/api-utils';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: RouteParams) {
  return withAuth(async () => {
    const { id } = await params;

    const issue = await prisma.magazineIssue.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
          include: {
            owner: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!issue) return errorResponse('Issue not found', 404);
    return successResponse(issue);
  });
}
