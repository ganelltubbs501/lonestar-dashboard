-- AlterTable: add nullable cadenceKey to EditorialDeadline
ALTER TABLE "EditorialDeadline" ADD COLUMN "cadenceKey" TEXT;

-- CreateIndex: unique, but PostgreSQL allows multiple NULLs so manually-created deadlines are unaffected
CREATE UNIQUE INDEX "EditorialDeadline_cadenceKey_key" ON "EditorialDeadline"("cadenceKey");
