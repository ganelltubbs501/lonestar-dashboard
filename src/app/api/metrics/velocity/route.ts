import { prisma } from '@/lib/db';
import { successResponse, withAuth } from '@/lib/api-utils';
import { WorkItemTypeLabel } from '@/lib/utils';

type RawRow = { week: Date; type: string; count: bigint };

/** Monday-based ISO week start for a given date (UTC) */
function weekStart(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const m = new Date(d);
  m.setUTCHours(0, 0, 0, 0);
  m.setUTCDate(d.getUTCDate() + diff);
  return m;
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// GET /api/metrics/velocity — items completed per week, last 5 weeks
export async function GET() {
  return withAuth(async () => {
    const rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        date_trunc('week', "completedAt" AT TIME ZONE 'UTC') AS week,
        type::text AS type,
        COUNT(*) AS count
      FROM "WorkItem"
      WHERE "completedAt" IS NOT NULL
        AND "completedAt" >= NOW() - INTERVAL '35 days'
        AND status = 'DONE'
      GROUP BY 1, 2
      ORDER BY 1
    `;

    // Build a lookup: weekISO → { total, byType }
    const map = new Map<string, { total: number; byType: Record<string, number> }>();
    for (const row of rows) {
      const key = (row.week as Date).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, { total: 0, byType: {} });
      const entry = map.get(key)!;
      const n = Number(row.count);
      entry.total += n;
      entry.byType[row.type] = (entry.byType[row.type] ?? 0) + n;
    }

    // Generate 5 consecutive Monday slots ending at (and including) current week
    const now = new Date();
    const thisMonday = weekStart(now);
    const weeks = [];
    let totalCompleted = 0;

    for (let i = 4; i >= 0; i--) {
      const wStart = new Date(thisMonday);
      wStart.setUTCDate(thisMonday.getUTCDate() - i * 7);
      const key = wStart.toISOString().slice(0, 10);
      const data = map.get(key) ?? { total: 0, byType: {} };
      totalCompleted += data.total;
      weeks.push({
        week: key,
        label: weekLabel(wStart),
        total: data.total,
        byType: data.byType,
      });
    }

    return successResponse({ weeks, totalCompleted });
  });
}
