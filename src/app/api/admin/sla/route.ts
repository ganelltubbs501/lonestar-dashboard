import { successResponse, withAdminAuth } from '@/lib/api-utils';

// GET /api/admin/sla — list all SLA definitions (admin only)
export async function GET() {
  return withAdminAuth(async () => {
    const { prisma } = await import('@/lib/db');
    const rules = await (prisma as any).slaDefinition.findMany({
      orderBy: { workItemType: 'asc' },
    });
    return successResponse(rules);
  });
}
