CREATE TABLE "SerReminder" (
    "id"         TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "sentAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SerReminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SerReminder_workItemId_type_idx" ON "SerReminder"("workItemId", "type");
CREATE INDEX "SerReminder_sentAt_idx"           ON "SerReminder"("sentAt");
