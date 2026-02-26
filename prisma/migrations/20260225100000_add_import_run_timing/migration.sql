-- AlterTable: add timing columns to SheetsImportRun
ALTER TABLE "SheetsImportRun" ADD COLUMN "startedAt"  TIMESTAMP(3);
ALTER TABLE "SheetsImportRun" ADD COLUMN "finishedAt" TIMESTAMP(3);
ALTER TABLE "SheetsImportRun" ADD COLUMN "durationMs" INTEGER;
