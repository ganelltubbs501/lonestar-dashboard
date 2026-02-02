-- CreateEnum
CREATE TYPE "MagazineSection" AS ENUM ('FRONT', 'FEATURES', 'REGULARS', 'EVENTS', 'SPONSORED_EDITORIAL_REVIEWS', 'BOOK_CAMPAIGNS', 'TEXAS_BOOKS_PREVIEW', 'ADS', 'OTHER');

-- CreateEnum
CREATE TYPE "MagazineItemType" AS ENUM ('ITEM', 'SUBITEM', 'AD', 'URL_ONLY', 'HEADER');

-- CreateTable
CREATE TABLE "MagazineIssue" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "themeColor" TEXT,
    "notes" TEXT,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MagazineIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagazineItem" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "section" "MagazineSection" NOT NULL DEFAULT 'OTHER',
    "kind" "MagazineItemType" NOT NULL DEFAULT 'ITEM',
    "title" TEXT NOT NULL,
    "url" TEXT,
    "notes" TEXT,
    "proofed" BOOLEAN NOT NULL DEFAULT false,
    "inFolder" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "dueAt" TIMESTAMP(3),
    "needsProofing" BOOLEAN NOT NULL DEFAULT false,
    "adSize" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "workItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MagazineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MagazineIssue_year_month_idx" ON "MagazineIssue"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MagazineIssue_year_month_key" ON "MagazineIssue"("year", "month");

-- CreateIndex
CREATE INDEX "MagazineItem_issueId_section_sortOrder_idx" ON "MagazineItem"("issueId", "section", "sortOrder");

-- CreateIndex
CREATE INDEX "MagazineItem_ownerId_idx" ON "MagazineItem"("ownerId");

-- CreateIndex
CREATE INDEX "MagazineItem_dueAt_idx" ON "MagazineItem"("dueAt");

-- AddForeignKey
ALTER TABLE "MagazineItem" ADD CONSTRAINT "MagazineItem_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "MagazineIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagazineItem" ADD CONSTRAINT "MagazineItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagazineItem" ADD CONSTRAINT "MagazineItem_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
