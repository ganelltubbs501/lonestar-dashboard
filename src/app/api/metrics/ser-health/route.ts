import { prisma } from '@/lib/db';
import { successResponse, withAuth } from '@/lib/api-utils';

type SummaryRow = {
  total_active: bigint;
  unassigned: bigint;
  overdue: bigint;
  due_soon: bigint;
  avg_assignment_days: number | null;
};

type ReviewRow = {
  avg_review_days: number | null;
  completed_count: bigint;
};

type ActiveRow = {
  id: string;
  title: string;
  status: string;
  due_at: Date | null;
  created_at: Date;
  owner_name: string | null;
  owner_email: string | null;
  days_until_due: number | null;
  days_since_created: number;
};

type CompletedRow = {
  id: string;
  title: string;
  completed_at: Date;
  cycle_days: number;
};

type ReminderRow = {
  type: string;
  sent_at: Date;
  item_title: string;
};

// GET /api/metrics/ser-health
export async function GET() {
  return withAuth(async () => {
    const [summaryRows, reviewRows, activeRows, completedRows, reminderRows] = await Promise.all([
      // ── Aggregate counts for non-DONE SER items ─────────────────────────────
      prisma.$queryRaw<SummaryRow[]>`
        SELECT
          COUNT(*)                                                                              AS total_active,
          COUNT(*) FILTER (WHERE "ownerId" IS NULL)                                            AS unassigned,
          COUNT(*) FILTER (WHERE "dueAt" < NOW())                                              AS overdue,
          COUNT(*) FILTER (WHERE "dueAt" >= NOW() AND "dueAt" < NOW() + INTERVAL '7 days')    AS due_soon,
          ROUND(
            AVG(EXTRACT(EPOCH FROM ("startedAt" - "createdAt")) / 86400)
            FILTER (WHERE "startedAt" IS NOT NULL)::numeric, 1
          )::float                                                                              AS avg_assignment_days
        FROM "WorkItem"
        WHERE type = 'SPONSORED_EDITORIAL_REVIEW' AND status::text != 'DONE'
      `,

      // ── Avg review time for completed SER items ──────────────────────────────
      prisma.$queryRaw<ReviewRow[]>`
        SELECT
          ROUND(
            AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) / 86400)
            FILTER (WHERE "completedAt" IS NOT NULL AND "startedAt" IS NOT NULL)::numeric, 1
          )::float                    AS avg_review_days,
          COUNT(*)                    AS completed_count
        FROM "WorkItem"
        WHERE type = 'SPONSORED_EDITORIAL_REVIEW' AND status::text = 'DONE'
      `,

      // ── All active SER items with risk context ───────────────────────────────
      prisma.$queryRaw<ActiveRow[]>`
        SELECT
          w.id,
          w.title,
          w.status::text                                                               AS status,
          w."dueAt"                                                                    AS due_at,
          w."createdAt"                                                                AS created_at,
          u.name                                                                       AS owner_name,
          u.email                                                                      AS owner_email,
          CASE
            WHEN w."dueAt" IS NOT NULL
            THEN CEIL(EXTRACT(EPOCH FROM (w."dueAt" - NOW())) / 86400)
            ELSE NULL
          END                                                                          AS days_until_due,
          FLOOR(EXTRACT(EPOCH FROM (NOW() - w."createdAt")) / 86400)                  AS days_since_created
        FROM "WorkItem" w
        LEFT JOIN "User" u ON u.id = w."ownerId"
        WHERE w.type = 'SPONSORED_EDITORIAL_REVIEW' AND w.status::text != 'DONE'
        ORDER BY
          CASE WHEN w."dueAt" IS NULL THEN 1 ELSE 0 END,
          w."dueAt" ASC NULLS LAST
      `,

      // ── Last 10 completed SER items with cycle time ──────────────────────────
      prisma.$queryRaw<CompletedRow[]>`
        SELECT
          id,
          title,
          "completedAt"                                                                AS completed_at,
          ROUND(
            EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400
          , 1)::float                                                                  AS cycle_days
        FROM "WorkItem"
        WHERE type = 'SPONSORED_EDITORIAL_REVIEW'
          AND status::text = 'DONE'
          AND "completedAt" IS NOT NULL
        ORDER BY "completedAt" DESC
        LIMIT 10
      `,

      // ── Last 15 reminders sent ───────────────────────────────────────────────
      prisma.$queryRaw<ReminderRow[]>`
        SELECT r.type, r."sentAt" AS sent_at, w.title AS item_title
        FROM "SerReminder" r
        JOIN "WorkItem" w ON w.id = r."workItemId"
        ORDER BY r."sentAt" DESC
        LIMIT 15
      `,
    ]);

    const s = summaryRows[0];
    const r = reviewRows[0];

    const summary = {
      totalActive:       Number(s?.total_active ?? 0),
      unassigned:        Number(s?.unassigned ?? 0),
      overdue:           Number(s?.overdue ?? 0),
      dueSoon:           Number(s?.due_soon ?? 0),
      avgAssignmentDays: s?.avg_assignment_days ?? null,
      avgReviewDays:     r?.avg_review_days ?? null,
      completedCount:    Number(r?.completed_count ?? 0),
    };

    const active = activeRows.map((row) => ({
      id:              row.id,
      title:           row.title,
      status:          row.status,
      dueAt:           row.due_at?.toISOString() ?? null,
      createdAt:       row.created_at.toISOString(),
      owner:           row.owner_name || row.owner_email
                         ? { name: row.owner_name, email: row.owner_email }
                         : null,
      daysUntilDue:    row.days_until_due != null ? Number(row.days_until_due) : null,
      daysSinceCreated: Number(row.days_since_created),
    }));

    const recentCompleted = completedRows.map((row) => ({
      id:          row.id,
      title:       row.title,
      completedAt: row.completed_at.toISOString(),
      cycleDays:   Number(row.cycle_days),
    }));

    const reminderLog = reminderRows.map((row) => ({
      type:      row.type,
      sentAt:    row.sent_at.toISOString(),
      itemTitle: row.item_title,
    }));

    return successResponse({ summary, active, recentCompleted, reminderLog });
  });
}
