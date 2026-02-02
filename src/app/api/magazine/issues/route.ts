import { prisma } from '@/lib/db';
import { successResponse, withAuth } from '@/lib/api-utils';

export async function GET() {
  return withAuth(async () => {
    const issues = await prisma.magazineIssue.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: { id: true, year: true, month: true, title: true, dueAt: true, themeColor: true },
      take: 24,
    });

    return successResponse(issues);
  });
}
