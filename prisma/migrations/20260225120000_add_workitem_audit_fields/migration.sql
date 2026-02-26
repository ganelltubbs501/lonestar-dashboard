-- AlterTable: add light audit fields to WorkItem
ALTER TABLE "WorkItem" ADD COLUMN "updatedById"     TEXT;
ALTER TABLE "WorkItem" ADD COLUMN "statusChangedAt" TIMESTAMP(3);
ALTER TABLE "WorkItem" ADD COLUMN "ownerChangedAt"  TIMESTAMP(3);

-- CreateIndex: updatedAt for doneThisWeek count query
CREATE INDEX "WorkItem_updatedAt_idx" ON "WorkItem"("updatedAt");
