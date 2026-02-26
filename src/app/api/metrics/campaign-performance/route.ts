import { prisma } from '@/lib/db';
import { successResponse, withAuth } from '@/lib/api-utils';

type MilestoneStatsRow = {
  type: string;
  total_planned: bigint;
  total_completed: bigint;
  on_time: bigint;
  avg_delay_days: number | null;
};

type NoteRow = {
  note: string;
  cnt: bigint;
};

type CampaignSummaryRow = {
  total: bigint;
  completed: bigint;
  fully_on_time: bigint;
};

// GET /api/metrics/campaign-performance
export async function GET() {
  return withAuth(async () => {
    const [milestoneStats, topNotes, campaignSummary] = await Promise.all([

      // ── Per-milestone: planned vs completed, on-time %, avg delay ────────────
      prisma.$queryRaw<MilestoneStatsRow[]>`
        SELECT
          m.type,
          COUNT(*) FILTER (WHERE m."plannedAt" IS NOT NULL)                    AS total_planned,
          COUNT(*) FILTER (WHERE m."completedAt" IS NOT NULL)                  AS total_completed,
          COUNT(*) FILTER (
            WHERE m."completedAt" IS NOT NULL
              AND m."plannedAt"   IS NOT NULL
              AND m."completedAt" <= m."plannedAt"
          )                                                                     AS on_time,
          ROUND(
            AVG(
              EXTRACT(EPOCH FROM (m."completedAt" - m."plannedAt")) / 86400
            ) FILTER (
              WHERE m."completedAt" IS NOT NULL AND m."plannedAt" IS NOT NULL
            )::numeric, 1
          )::float                                                              AS avg_delay_days
        FROM "CampaignMilestone" m
        JOIN "WorkItem" w ON w.id = m."workItemId"
        WHERE w.type = 'BOOK_CAMPAIGN'
        GROUP BY m.type
        ORDER BY m.type
      `,

      // ── Top delay notes (most common non-empty notes on late milestones) ─────
      prisma.$queryRaw<NoteRow[]>`
        SELECT m.note, COUNT(*) AS cnt
        FROM "CampaignMilestone" m
        JOIN "WorkItem" w ON w.id = m."workItemId"
        WHERE w.type = 'BOOK_CAMPAIGN'
          AND m.note IS NOT NULL
          AND m.note != ''
          AND m."completedAt" IS NOT NULL
          AND m."plannedAt"   IS NOT NULL
          AND m."completedAt" > m."plannedAt"
        GROUP BY m.note
        ORDER BY cnt DESC
        LIMIT 5
      `,

      // ── Campaign-level summary: total / completed / fully on-time ────────────
      prisma.$queryRaw<CampaignSummaryRow[]>`
        WITH milestone_counts AS (
          SELECT
            m."workItemId",
            COUNT(*) FILTER (
              WHERE m."completedAt" IS NOT NULL
                AND m."plannedAt"   IS NOT NULL
                AND m."completedAt" > m."plannedAt"
            ) AS late_count
          FROM "CampaignMilestone" m
          GROUP BY m."workItemId"
        )
        SELECT
          COUNT(*)                                                              AS total,
          COUNT(*) FILTER (WHERE w.status::text = 'DONE')                     AS completed,
          COUNT(*) FILTER (
            WHERE COALESCE(mc.late_count, 0) = 0
          )                                                                     AS fully_on_time
        FROM "WorkItem" w
        LEFT JOIN milestone_counts mc ON mc."workItemId" = w.id
        WHERE w.type = 'BOOK_CAMPAIGN'
      `,
    ]);

    const MILESTONE_ORDER = [
      'SIGNUP_DEADLINE',
      'GRAPHICS_DUE',
      'FOLDER_TO_REVIEWERS',
      'WRAP_UP',
    ];

    const statsMap = new Map(milestoneStats.map((r) => [r.type, r]));

    const byMilestone = MILESTONE_ORDER.map((type) => {
      const r = statsMap.get(type);
      const totalPlanned = Number(r?.total_planned ?? 0);
      const totalCompleted = Number(r?.total_completed ?? 0);
      const onTime = Number(r?.on_time ?? 0);
      const late = totalCompleted - onTime;
      const onTimePct =
        totalCompleted > 0 ? Math.round((onTime / totalCompleted) * 100) : null;

      return {
        type,
        label: MILESTONE_LABELS[type] ?? type,
        totalPlanned,
        totalCompleted,
        onTime,
        late,
        onTimePct,
        avgDelayDays: r?.avg_delay_days ?? null,
      };
    });

    const s = campaignSummary[0];
    const summary = {
      total: Number(s?.total ?? 0),
      completed: Number(s?.completed ?? 0),
      fullyOnTime: Number(s?.fully_on_time ?? 0),
    };

    const delayReasons = topNotes.map((n) => ({
      note: n.note,
      count: Number(n.cnt),
    }));

    return successResponse({ summary, byMilestone, delayReasons });
  });
}

const MILESTONE_LABELS: Record<string, string> = {
  SIGNUP_DEADLINE:    'Signup Deadline',
  GRAPHICS_DUE:       'Graphics Due',
  FOLDER_TO_REVIEWERS:'Folder to Reviewers',
  WRAP_UP:            'Wrap-up',
};
