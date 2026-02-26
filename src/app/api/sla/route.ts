import { prisma } from '@/lib/db';
import { successResponse, withAuth } from '@/lib/api-utils';

// ── Row types ─────────────────────────────────────────────────────────────────

type RuleStatsRow = {
  work_item_type:  string;
  label:           string;
  target_days:     number | null;
  due_date_driven: boolean;
  active_count:    bigint;
  breach_count:    bigint;
  due_soon_count:  bigint;
  completed_count: bigint;
  missed_count:    bigint;
};

type FlaggedRow = {
  id:              string;
  title:           string;
  work_item_type:  string;
  status:          string;
  owner_name:      string | null;
  owner_email:     string | null;
  deadline:        Date | null;
  days_overdue:    number | null;
  sla_status:      string; // 'BREACH' | 'DUE_SOON'
};

type MissedRow = {
  id:           string;
  title:        string;
  work_item_type: string;
  completed_at: Date;
  days_late:    number;
};

// ── GET /api/sla ──────────────────────────────────────────────────────────────
export async function GET() {
  return withAuth(async () => {
    const [ruleStats, flagged, recentMissed] = await Promise.all([

      // ── Per-type SLA stats ────────────────────────────────────────────────
      prisma.$queryRaw<RuleStatsRow[]>`
        WITH item_deadlines AS (
          SELECT
            w.id,
            w.status::text                   AS status,
            w."completedAt",
            s."workItemType",
            s.label,
            s."targetDays",
            s."dueDateDriven",
            CASE
              WHEN s."dueDateDriven" THEN w."dueAt"
              ELSE w."createdAt" + (s."targetDays" || ' days')::interval
            END                              AS deadline
          FROM "SlaDefinition" s
          LEFT JOIN "WorkItem" w ON w.type::text = s."workItemType"
        )
        SELECT
          "workItemType"                                                             AS work_item_type,
          label,
          "targetDays"                                                               AS target_days,
          "dueDateDriven"                                                            AS due_date_driven,
          COUNT(*) FILTER (WHERE status != 'DONE')                                  AS active_count,
          COUNT(*) FILTER (WHERE status != 'DONE' AND deadline < NOW())             AS breach_count,
          COUNT(*) FILTER (
            WHERE status != 'DONE'
              AND deadline >= NOW()
              AND deadline < NOW() + INTERVAL '48 hours'
          )                                                                          AS due_soon_count,
          COUNT(*) FILTER (WHERE status = 'DONE')                                   AS completed_count,
          COUNT(*) FILTER (
            WHERE status = 'DONE'
              AND "completedAt" IS NOT NULL
              AND deadline IS NOT NULL
              AND "completedAt" > deadline
          )                                                                          AS missed_count
        FROM item_deadlines
        GROUP BY "workItemType", label, "targetDays", "dueDateDriven"
        ORDER BY breach_count DESC, due_soon_count DESC
      `,

      // ── Active items that are BREACH or DUE_SOON ─────────────────────────
      prisma.$queryRaw<FlaggedRow[]>`
        SELECT
          w.id,
          w.title,
          w.type::text                                                               AS work_item_type,
          w.status::text                                                             AS status,
          u.name                                                                     AS owner_name,
          u.email                                                                    AS owner_email,
          CASE
            WHEN s."dueDateDriven" THEN w."dueAt"
            ELSE w."createdAt" + (s."targetDays" || ' days')::interval
          END                                                                        AS deadline,
          CASE
            WHEN (
              CASE WHEN s."dueDateDriven" THEN w."dueAt"
                   ELSE w."createdAt" + (s."targetDays" || ' days')::interval
              END
            ) < NOW()
            THEN CEIL(
              EXTRACT(EPOCH FROM (
                NOW() - (
                  CASE WHEN s."dueDateDriven" THEN w."dueAt"
                       ELSE w."createdAt" + (s."targetDays" || ' days')::interval
                  END
                )
              )) / 86400
            )
            ELSE NULL
          END                                                                        AS days_overdue,
          CASE
            WHEN (
              CASE WHEN s."dueDateDriven" THEN w."dueAt"
                   ELSE w."createdAt" + (s."targetDays" || ' days')::interval
              END
            ) < NOW() THEN 'BREACH'
            ELSE 'DUE_SOON'
          END                                                                        AS sla_status
        FROM "WorkItem" w
        JOIN "SlaDefinition" s ON s."workItemType" = w.type::text
        LEFT JOIN "User" u ON u.id = w."ownerId"
        WHERE
          w.status::text != 'DONE'
          AND (
            CASE
              WHEN s."dueDateDriven" THEN w."dueAt"
              ELSE w."createdAt" + (s."targetDays" || ' days')::interval
            END
          ) < NOW() + INTERVAL '48 hours'
          AND (
            CASE
              WHEN s."dueDateDriven" THEN w."dueAt"
              ELSE w."createdAt" + (s."targetDays" || ' days')::interval
            END
          ) IS NOT NULL
        ORDER BY
          CASE WHEN (
            CASE WHEN s."dueDateDriven" THEN w."dueAt"
                 ELSE w."createdAt" + (s."targetDays" || ' days')::interval
            END
          ) < NOW() THEN 0 ELSE 1 END,
          deadline ASC NULLS LAST
      `,

      // ── Last 30 days: completed items that missed their SLA ───────────────
      prisma.$queryRaw<MissedRow[]>`
        SELECT
          w.id,
          w.title,
          w.type::text                                                               AS work_item_type,
          w."completedAt"                                                            AS completed_at,
          ROUND(
            EXTRACT(EPOCH FROM (
              w."completedAt" - (
                CASE WHEN s."dueDateDriven" THEN w."dueAt"
                     ELSE w."createdAt" + (s."targetDays" || ' days')::interval
                END
              )
            )) / 86400
          , 1)::float                                                                AS days_late
        FROM "WorkItem" w
        JOIN "SlaDefinition" s ON s."workItemType" = w.type::text
        WHERE
          w.status::text = 'DONE'
          AND w."completedAt" IS NOT NULL
          AND w."completedAt" > NOW() - INTERVAL '30 days'
          AND w."completedAt" > (
            CASE WHEN s."dueDateDriven" THEN w."dueAt"
                 ELSE w."createdAt" + (s."targetDays" || ' days')::interval
            END
          )
          AND (
            CASE WHEN s."dueDateDriven" THEN w."dueAt"
                 ELSE w."createdAt" + (s."targetDays" || ' days')::interval
            END
          ) IS NOT NULL
        ORDER BY w."completedAt" DESC
        LIMIT 20
      `,
    ]);

    // ── Shape rules ───────────────────────────────────────────────────────────
    const rules = ruleStats.map((r) => {
      const completed = Number(r.completed_count);
      const missed = Number(r.missed_count);
      const missedPct = completed > 0 ? Math.round((missed / completed) * 100) : null;
      return {
        workItemType:  r.work_item_type,
        label:         r.label,
        targetDays:    r.target_days,
        dueDateDriven: r.due_date_driven,
        activeCount:   Number(r.active_count),
        breachCount:   Number(r.breach_count),
        dueSoonCount:  Number(r.due_soon_count),
        completedCount: completed,
        missedCount:   missed,
        missedPct,
      };
    });

    // ── Summary ───────────────────────────────────────────────────────────────
    const totalBreach  = rules.reduce((a, r) => a + r.breachCount, 0);
    const totalDueSoon = rules.reduce((a, r) => a + r.dueSoonCount, 0);
    const worstType    = rules.reduce<typeof rules[0] | null>((worst, r) => {
      if (r.missedPct === null) return worst;
      if (!worst || (worst.missedPct ?? -1) < r.missedPct) return r;
      return worst;
    }, null);

    // ── Shape flagged items ───────────────────────────────────────────────────
    const flaggedItems = flagged.map((r) => ({
      id:          r.id,
      title:       r.title,
      type:        r.work_item_type,
      status:      r.status,
      owner:       r.owner_name || r.owner_email
                     ? { name: r.owner_name, email: r.owner_email }
                     : null,
      deadline:    r.deadline?.toISOString() ?? null,
      daysOverdue: r.days_overdue != null ? Number(r.days_overdue) : null,
      slaStatus:   r.sla_status,
    }));

    // ── Shape recent misses ───────────────────────────────────────────────────
    const recentMisses = recentMissed.map((r) => ({
      id:          r.id,
      title:       r.title,
      type:        r.work_item_type,
      completedAt: r.completed_at.toISOString(),
      daysLate:    Number(r.days_late),
    }));

    return successResponse({
      summary: {
        totalBreach,
        totalDueSoon,
        worstType: worstType
          ? { label: worstType.label, missedPct: worstType.missedPct }
          : null,
      },
      rules,
      flagged: flaggedItems,
      recentMisses,
    });
  });
}
