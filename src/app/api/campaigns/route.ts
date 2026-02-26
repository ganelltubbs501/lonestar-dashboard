import { prisma } from '@/lib/db';
import { successResponse, withAuth } from '@/lib/api-utils';

export const MILESTONE_TYPES = [
  'SIGNUP_DEADLINE',
  'GRAPHICS_DUE',
  'FOLDER_TO_REVIEWERS',
  'WRAP_UP',
] as const;

export type MilestoneType = (typeof MILESTONE_TYPES)[number];

type CampaignRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  owner_name: string | null;
  owner_email: string | null;
};

type MilestoneRow = {
  work_item_id: string;
  type: string;
  planned_at: Date | null;
  completed_at: Date | null;
  note: string | null;
};

// GET /api/campaigns — all BOOK_CAMPAIGN items with their milestones
export async function GET() {
  return withAuth(async () => {
    const [campaigns, milestones] = await Promise.all([
      prisma.$queryRaw<CampaignRow[]>`
        SELECT
          w.id,
          w.title,
          w.status::text                                                   AS status,
          w.priority::text                                                  AS priority,
          w."dueAt"                                                         AS due_at,
          w."startedAt"                                                     AS started_at,
          w."completedAt"                                                   AS completed_at,
          w."createdAt"                                                     AS created_at,
          u.name                                                            AS owner_name,
          u.email                                                           AS owner_email
        FROM "WorkItem" w
        LEFT JOIN "User" u ON u.id = w."ownerId"
        WHERE w.type = 'BOOK_CAMPAIGN'
        ORDER BY
          CASE w.status WHEN 'DONE' THEN 1 ELSE 0 END,
          w."dueAt" ASC NULLS LAST,
          w."createdAt" DESC
      `,
      prisma.$queryRaw<MilestoneRow[]>`
        SELECT
          "workItemId" AS work_item_id,
          type,
          "plannedAt"   AS planned_at,
          "completedAt" AS completed_at,
          note
        FROM "CampaignMilestone"
        ORDER BY "workItemId", type
      `,
    ]);

    // Build milestone map: workItemId → { type → data }
    const mMap = new Map<string, Record<string, MilestoneRow>>();
    for (const m of milestones) {
      if (!mMap.has(m.work_item_id)) mMap.set(m.work_item_id, {});
      mMap.get(m.work_item_id)![m.type] = m;
    }

    const items = campaigns.map((c) => {
      const ms = mMap.get(c.id) ?? {};

      // Normalize: each type always present, null if not yet set
      const milestonesOut: Record<string, {
        plannedAt: string | null;
        completedAt: string | null;
        note: string | null;
      }> = {};
      for (const t of MILESTONE_TYPES) {
        const m = ms[t];
        milestonesOut[t] = {
          plannedAt:   m?.planned_at?.toISOString() ?? null,
          completedAt: m?.completed_at?.toISOString() ?? null,
          note:        m?.note ?? null,
        };
      }

      return {
        id:          c.id,
        title:       c.title,
        status:      c.status,
        priority:    c.priority,
        dueAt:       c.due_at?.toISOString() ?? null,
        startedAt:   c.started_at?.toISOString() ?? null,
        completedAt: c.completed_at?.toISOString() ?? null,
        createdAt:   c.created_at.toISOString(),
        owner:       c.owner_name || c.owner_email
                       ? { name: c.owner_name, email: c.owner_email }
                       : null,
        milestones:  milestonesOut,
      };
    });

    return successResponse(items);
  });
}
