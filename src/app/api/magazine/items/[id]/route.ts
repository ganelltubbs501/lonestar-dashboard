import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse, successResponse, withAuth } from '@/lib/api-utils';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return withAuth(async () => {
    const { id } = await params;
    const body = await req.json().catch(() => null);

    if (!body) return errorResponse('Invalid JSON body', 400);

    const allowed: Record<string, unknown> = {};
    if (typeof body.proofed === 'boolean') allowed.proofed = body.proofed;
    if (typeof body.inFolder === 'boolean') allowed.inFolder = body.inFolder;
    if (typeof body.needsProofing === 'boolean') allowed.needsProofing = body.needsProofing;
    if (typeof body.title === 'string') allowed.title = body.title;
    if (typeof body.url === 'string') allowed.url = body.url;
    if (typeof body.notes === 'string') allowed.notes = body.notes;
    if (typeof body.ownerId === 'string' || body.ownerId === null) allowed.ownerId = body.ownerId;
    if (typeof body.dueAt === 'string' || body.dueAt === null) allowed.dueAt = body.dueAt ? new Date(body.dueAt) : null;

    const updated = await prisma.magazineItem.update({
      where: { id },
      data: allowed,
      include: { owner: { select: { id: true, name: true, email: true } } },
    });

    return successResponse(updated);
  });
}
