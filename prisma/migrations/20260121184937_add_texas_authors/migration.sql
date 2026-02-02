/*
  Warnings:

  - You are about to drop the column `bookTitle` on the `TexasAuthor` table. All the data in the column will be lost.
  - You are about to drop the column `genres` on the `TexasAuthor` table. All the data in the column will be lost.
  - You are about to drop the column `importedAt` on the `TexasAuthor` table. All the data in the column will be lost.
  - You are about to drop the column `pubDate` on the `TexasAuthor` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `TexasAuthor` table. All the data in the column will be lost.
  - You are about to drop the column `sourceRowHash` on the `TexasAuthor` table. All the data in the column will be lost.
  - You are about to drop the column `sourceSheetId` on the `TexasAuthor` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[externalKey]` on the table `TexasAuthor` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `externalKey` to the `TexasAuthor` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SourceSystem" AS ENUM ('GOOGLE_SHEETS');

-- DropIndex
DROP INDEX "TexasAuthor_sourceRowHash_key";

-- AlterTable
ALTER TABLE "TexasAuthor" DROP COLUMN "bookTitle",
DROP COLUMN "genres",
DROP COLUMN "importedAt",
DROP COLUMN "pubDate",
DROP COLUMN "source",
DROP COLUMN "sourceRowHash",
DROP COLUMN "sourceSheetId",
ADD COLUMN     "externalKey" TEXT NOT NULL,
ADD COLUMN     "raw" JSONB,
ADD COLUMN     "sourceRef" TEXT,
ADD COLUMN     "sourceSystem" "SourceSystem" NOT NULL DEFAULT 'GOOGLE_SHEETS';

-- CreateTable
CREATE TABLE "SheetSyncState" (
    "id" TEXT NOT NULL,
    "sourceSystem" "SourceSystem" NOT NULL DEFAULT 'GOOGLE_SHEETS',
    "spreadsheetId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rangeA1" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastRowCount" INTEGER,
    "lastHash" TEXT,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SheetSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SheetSyncState_key_key" ON "SheetSyncState"("key");

-- CreateIndex
CREATE INDEX "SheetSyncState_spreadsheetId_sheetName_idx" ON "SheetSyncState"("spreadsheetId", "sheetName");

-- CreateIndex
CREATE UNIQUE INDEX "TexasAuthor_externalKey_key" ON "TexasAuthor"("externalKey");
