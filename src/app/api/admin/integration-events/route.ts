import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, withAdminAuth } from '@/lib/api-utils';

// GET /api/admin/integration-events - List integration events (admin only)
export async function GET(request: NextRequest) {
  return withAdminAuth(async () => {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const events = await prisma.integrationEvent.findMany({
      take: limit,
      orderBy: { receivedAt: 'desc' },
      include: {
        workItem: {
          select: { id: true, title: true },
        },
      },
    });

    return successResponse(events);
  });
}
