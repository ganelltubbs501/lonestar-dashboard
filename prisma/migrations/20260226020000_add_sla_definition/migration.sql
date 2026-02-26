CREATE TABLE "SlaDefinition" (
    "id"            TEXT         NOT NULL,
    "workItemType"  TEXT         NOT NULL,
    "targetDays"    INTEGER,
    "dueDateDriven" BOOLEAN      NOT NULL DEFAULT false,
    "label"         TEXT         NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SlaDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SlaDefinition_workItemType_key" ON "SlaDefinition"("workItemType");

-- Seed default SLA targets
INSERT INTO "SlaDefinition" ("id", "workItemType", "targetDays", "dueDateDriven", "label") VALUES
  (gen_random_uuid()::text, 'SOCIAL_ASSET_REQUEST',       14,   false, 'Social Graphics'),
  (gen_random_uuid()::text, 'SPONSORED_EDITORIAL_REVIEW', 30,   false, 'SER'),
  (gen_random_uuid()::text, 'BOOK_CAMPAIGN',              NULL, true,  'Book Campaign'),
  (gen_random_uuid()::text, 'WEBSITE_EVENT',              3,    false, 'Website Event'),
  (gen_random_uuid()::text, 'TX_BOOK_PREVIEW_LEAD',       7,    false, 'TX Book Preview'),
  (gen_random_uuid()::text, 'ACCESS_REQUEST',             2,    false, 'Access Request'),
  (gen_random_uuid()::text, 'GENERAL',                    14,   false, 'General');
