import { prisma } from '@/lib/db';
import { successResponse, withAuth } from '@/lib/api-utils';

type RawOwnerRow = {
  id: string;
  name: string | null;
  email: string;
  active: bigint;
  on_time: bigint;
  due_this_week: bigint;
  overdue: bigint;
};

// GET /api/metrics/owner-load — active / overdue / due-this-week per owner
export async function GET() {
  return withAuth(async () => {
    const rows = await prisma.$queryRaw<RawOwnerRow[]>`
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(*)                                                                                AS active,
        COUNT(*) FILTER (WHERE w."dueAt" IS NULL OR w."dueAt" >= NOW() + INTERVAL '7 days')   AS on_time,
        COUNT(*) FILTER (WHERE w."dueAt" >= NOW() AND w."dueAt" < NOW() + INTERVAL '7 days')  AS due_this_week,
        COUNT(*) FILTER (WHERE w."dueAt" < NOW())                                              AS overdue
      FROM "User" u
      JOIN "WorkItem" w ON w."ownerId" = u.id AND w.status::text != 'DONE'
      GROUP BY u.id, u.name, u.email
      ORDER BY active DESC, u.name
    `;

    const owners = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      active: Number(r.active),
      onTime: Number(r.on_time),
      dueThisWeek: Number(r.due_this_week),
      overdue: Number(r.overdue),
    }));

    return successResponse({ owners });
  });
}
