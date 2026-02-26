CREATE TABLE "CampaignMilestone" (
    "id"          TEXT         NOT NULL,
    "workItemId"  TEXT         NOT NULL,
    "type"        TEXT         NOT NULL,
    "plannedAt"   TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "note"        TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignMilestone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignMilestone_workItemId_type_key" ON "CampaignMilestone"("workItemId", "type");
CREATE        INDEX "CampaignMilestone_workItemId_idx"      ON "CampaignMilestone"("workItemId");
CREATE        INDEX "CampaignMilestone_type_plannedAt_idx"  ON "CampaignMilestone"("type", "plannedAt");
