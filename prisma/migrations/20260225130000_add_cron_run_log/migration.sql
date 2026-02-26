-- CreateTable: generic cron job execution history
CREATE TABLE "CronRunLog" (
    "id"         TEXT NOT NULL,
    "jobName"    TEXT NOT NULL,
    "status"     TEXT NOT NULL,
    "result"     JSONB,
    "error"      TEXT,
    "durationMs" INTEGER,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CronRunLog_jobName_idx" ON "CronRunLog"("jobName");
CREATE INDEX "CronRunLog_createdAt_idx" ON "CronRunLog"("createdAt");
