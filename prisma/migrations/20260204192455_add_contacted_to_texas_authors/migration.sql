-- AlterTable
ALTER TABLE "TexasAuthor" ADD COLUMN     "contacted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "TexasAuthor_contacted_idx" ON "TexasAuthor"("contacted");
