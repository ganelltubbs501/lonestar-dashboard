import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth, successResponse } from '@/lib/api-utils';

// GET /api/metrics/executive
// Single-call aggregate for the executive dashboard.
export async function GET() {
  return withAuth(async () => {
    const now = new Date();

    // ── 1. Work-item summary ───────────────────────────────────────────────
    const [wiRows, serRows, eventRows, milestoneRows, velocityRows] = await Promise.all([

      prisma.$queryRaw<any[]>`
        SELECT
          COUNT(*) FILTER (WHERE status != 'DONE')                                                        AS active,
          COUNT(*) FILTER (WHERE status != 'DONE' AND "dueAt" IS NOT NULL AND "dueAt" < NOW())            AS overdue,
          COUNT(*) FILTER (WHERE status = 'BLOCKED')                                                       AS blocked,
          COUNT(*) FILTER (WHERE status != 'DONE' AND "dueAt" >= NOW() AND "dueAt" <= NOW() + INTERVAL '7 days') AS due_soon
        FROM "WorkItem"
      `,

      // ── 2. SER summary ──────────────────────────────────────────────────
      prisma.$queryRaw<any[]>`
        SELECT
          COUNT(*) FILTER (WHERE status != 'DONE')                                                      AS active,
          COUNT(*) FILTER (WHERE status != 'DONE' AND "ownerId" IS NULL)                                AS unassigned,
          COUNT(*) FILTER (WHERE status != 'DONE' AND "dueAt" IS NOT NULL AND "dueAt" < NOW())          AS overdue,
          AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400.0)
            FILTER (WHERE status = 'DONE' AND "completedAt" IS NOT NULL)                                AS avg_review_days
        FROM "WorkItem"
        WHERE type = 'SPONSORED_EDITORIAL_REVIEW'
      `,

      // ── 3. Events pipeline counts ────────────────────────────────────────
      prisma.$queryRaw<any[]>`
        SELECT "pipelineStatus" AS status, COUNT(*) AS count
        FROM "Event"
        WHERE "pipelineStatus" != 'ARCHIVED'
        GROUP BY "pipelineStatus"
      `,

      // ── 4. Campaign milestone stats (active campaigns only) ───────────────
      prisma.$queryRaw<any[]>`
        SELECT
          COUNT(DISTINCT w.id)                                                                         AS active_campaigns,
          COUNT(cm.id) FILTER (WHERE cm."plannedAt" IS NOT NULL)                                      AS total_planned,
          COUNT(cm.id) FILTER (WHERE cm."completedAt" IS NOT NULL AND cm."completedAt" <= cm."plannedAt") AS total_on_time,
          COUNT(cm.id) FILTER (WHERE cm.type = 'GRAPHICS_DUE' AND cm."plannedAt" IS NOT NULL)         AS graphics_planned,
          COUNT(cm.id) FILTER (WHERE cm.type = 'GRAPHICS_DUE' AND cm."completedAt" IS NOT NULL AND cm."completedAt" > cm."plannedAt") AS graphics_late,
          AVG(
            EXTRACT(EPOCH FROM (cm."completedAt" - cm."plannedAt")) / 86400.0
          ) FILTER (WHERE cm."completedAt" IS NOT NULL AND cm."completedAt" > cm."plannedAt")         AS avg_delay_days
        FROM "WorkItem" w
        LEFT JOIN "CampaignMilestone" cm ON cm."workItemId" = w.id
        WHERE w.type = 'BOOK_CAMPAIGN' AND w.status != 'DONE'
      `,

      // ── 5. Velocity — last 4 complete weeks ─────────────────────────────
      prisma.$queryRaw<any[]>`
        SELECT
          date_trunc('week', "completedAt" AT TIME ZONE 'UTC') AS week_start,
          COUNT(*) AS total
        FROM "WorkItem"
        WHERE status = 'DONE'
          AND "completedAt" IS NOT NULL
          AND "completedAt" >= NOW() - INTERVAL '35 days'
          AND "completedAt" < date_trunc('week', NOW() AT TIME ZONE 'UTC')
        GROUP BY week_start
        ORDER BY week_start ASC
        LIMIT 4
      `,
    ]);

    // ── Work items ──────────────────────────────────────────────────────────
    const wi = wiRows[0] ?? {};
    const workItems = {
      active:   Number(wi.active   ?? 0),
      overdue:  Number(wi.overdue  ?? 0),
      blocked:  Number(wi.blocked  ?? 0),
      dueSoon:  Number(wi.due_soon ?? 0),
    };

    // ── SER ─────────────────────────────────────────────────────────────────
    const sr = serRows[0] ?? {};
    const ser = {
      active:         Number(sr.active      ?? 0),
      unassigned:     Number(sr.unassigned  ?? 0),
      overdue:        Number(sr.overdue     ?? 0),
      avgReviewDays:  sr.avg_review_days != null ? Math.round(Number(sr.avg_review_days)) : null,
    };

    // ── Events ───────────────────────────────────────────────────────────────
    const evMap: Record<string, number> = {};
    for (const r of eventRows) evMap[r.status] = Number(r.count ?? 0);

    // Next Friday
    const nextFriday = new Date(now);
    nextFriday.setUTCDate(now.getUTCDate() + ((5 - now.getUTCDay() + 7) % 7 || 7));
    const nextBatchDate = nextFriday.toISOString().split('T')[0];

    const events = {
      intake:         evMap['INTAKE']          ?? 0,
      compilation:    evMap['COMPILATION']     ?? 0,
      readyToUpload:  evMap['READY_TO_UPLOAD'] ?? 0,
      uploaded:       evMap['UPLOADED']        ?? 0,
      nextBatchDate,
    };

    // ── Campaigns ─────────────────────────────────────────────────────────
    const cm = milestoneRows[0] ?? {};
    const activeCampaigns    = Number(cm.active_campaigns ?? 0);
    const totalPlanned       = Number(cm.total_planned    ?? 0);
    const totalOnTime        = Number(cm.total_on_time    ?? 0);
    const graphicsPlanned    = Number(cm.graphics_planned ?? 0);
    const graphicsLate       = Number(cm.graphics_late    ?? 0);
    const avgDelayDays       = cm.avg_delay_days != null ? Math.round(Number(cm.avg_delay_days) * 10) / 10 : null;

    const onTimePct = totalPlanned > 0
      ? Math.round((totalOnTime / totalPlanned) * 100) : null;
    const graphicsLatePct = graphicsPlanned > 0
      ? Math.round((graphicsLate / graphicsPlanned) * 100) : null;

    const campaigns = {
      active: activeCampaigns,
      onTimePct,
      avgDelayDays,
      graphicsLatePct,
    };

    // ── Velocity ─────────────────────────────────────────────────────────
    // Fill up to 4 weeks (may be fewer if data is sparse)
    const velocity = velocityRows.map(r => {
      const d = new Date(r.week_start);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      return { weekLabel: label, total: Number(r.total ?? 0) };
    });

    return successResponse({
      generatedAt: now.toISOString(),
      workItems,
      ser,
      campaigns,
      events,
      velocity,
    });
  });
}
