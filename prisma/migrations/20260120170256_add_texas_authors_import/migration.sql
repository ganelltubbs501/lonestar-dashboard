-- CreateEnum
CREATE TYPE "SheetsImportKind" AS ENUM ('TEXAS_AUTHORS');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "TexasAuthor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "state" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "bookTitle" TEXT,
    "pubDate" TIMESTAMP(3),
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'google_sheets',
    "sourceSheetId" TEXT,
    "sourceRowHash" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TexasAuthor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetsImportRun" (
    "id" TEXT NOT NULL,
    "kind" "SheetsImportKind" NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'SUCCESS',
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SheetsImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TexasAuthor_sourceRowHash_key" ON "TexasAuthor"("sourceRowHash");

-- CreateIndex
CREATE INDEX "TexasAuthor_name_idx" ON "TexasAuthor"("name");

-- CreateIndex
CREATE INDEX "TexasAuthor_email_idx" ON "TexasAuthor"("email");
