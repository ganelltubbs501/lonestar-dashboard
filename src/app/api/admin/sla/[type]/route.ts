import { NextRequest } from 'next/server';
import { successResponse, errorResponse, withAdminAuth } from '@/lib/api-utils';

type RouteParams = { params: Promise<{ type: string }> };

// PATCH /api/admin/sla/[type] — update target for a work item type (admin only)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { type } = await params;
    const body = await req.json();
    const { targetDays, dueDateDriven, label } = body as {
      targetDays?: number | null;
      dueDateDriven?: boolean;
      label?: string;
    };

    const { prisma } = await import('@/lib/db');

    const existing = await (prisma as any).slaDefinition.findUnique({
      where: { workItemType: type },
    });
    if (!existing) {
      return errorResponse(`No SLA definition found for type: ${type}`, 404);
    }

    const updated = await (prisma as any).slaDefinition.update({
      where: { workItemType: type },
      data: {
        ...(targetDays !== undefined ? { targetDays } : {}),
        ...(dueDateDriven !== undefined ? { dueDateDriven } : {}),
        ...(label !== undefined ? { label } : {}),
        updatedAt: new Date(),
      },
    });

    return successResponse(updated);
  });
}
