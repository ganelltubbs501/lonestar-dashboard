import { prisma } from '@/lib/db';
import { successResponse, withAuth } from '@/lib/api-utils';

// GET /api/users - List all users (for assignment dropdowns)
export async function GET() {
  return withAuth(async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });

    return successResponse(users);
  });
}
