-- DropForeignKey
ALTER TABLE "WorkItem" DROP CONSTRAINT "WorkItem_requesterId_fkey";

-- AlterTable
ALTER TABLE "CampaignMilestone" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SlaDefinition" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkItem" ALTER COLUMN "requesterId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
