import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { MILESTONE_TYPES } from '../../route';

// PATCH /api/campaigns/[id]/milestones
// Body: { type, plannedAt?, completedAt?, note? }
// Upserts a single milestone for the given campaign work item.
type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams,
) {
  return withAuth(async () => {
    const { id } = await params;
    const body = await req.json();
    const { type, plannedAt, completedAt, note } = body as {
      type: string;
      plannedAt?: string | null;
      completedAt?: string | null;
      note?: string | null;
    };

    if (!MILESTONE_TYPES.includes(type as any)) {
      return errorResponse(`Invalid milestone type: ${type}`, 400);
    }

    // Verify the work item exists and is a BOOK_CAMPAIGN
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "WorkItem"
      WHERE id = ${id} AND type = 'BOOK_CAMPAIGN'
      LIMIT 1
    `;
    if (existing.length === 0) {
      return errorResponse('Campaign not found', 404);
    }

    const plannedDate = plannedAt ? new Date(plannedAt) : null;
    const completedDate = completedAt ? new Date(completedAt) : null;

    // Upsert via raw SQL (avoids stale Prisma client)
    await prisma.$executeRaw`
      INSERT INTO "CampaignMilestone" (
        "id", "workItemId", "type",
        "plannedAt", "completedAt", "note",
        "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text,
        ${id},
        ${type},
        ${plannedDate},
        ${completedDate},
        ${note ?? null},
        NOW(),
        NOW()
      )
      ON CONFLICT ("workItemId", "type")
      DO UPDATE SET
        "plannedAt"   = EXCLUDED."plannedAt",
        "completedAt" = EXCLUDED."completedAt",
        "note"        = EXCLUDED."note",
        "updatedAt"   = NOW()
    `;

    return successResponse({ ok: true });
  });
}
