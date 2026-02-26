-- Add lifecycle timestamps for analytics
ALTER TABLE "WorkItem" ADD COLUMN "startedAt"   TIMESTAMP(3);
ALTER TABLE "WorkItem" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Indexes for fast range queries in metrics endpoints
CREATE INDEX "WorkItem_completedAt_idx" ON "WorkItem"("completedAt");
CREATE INDEX "WorkItem_startedAt_idx"  ON "WorkItem"("startedAt");

-- Backfill: items currently DONE get completedAt = statusChangedAt (Week 4 field) OR updatedAt
UPDATE "WorkItem"
SET "completedAt" = COALESCE("statusChangedAt", "updatedAt")
WHERE status = 'DONE'
  AND "completedAt" IS NULL;

-- Backfill: items that have progressed past BACKLOG/READY get startedAt = createdAt
UPDATE "WorkItem"
SET "startedAt" = "createdAt"
WHERE status IN ('IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'NEEDS_QA', 'DONE')
  AND "startedAt" IS NULL;
