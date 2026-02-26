# Ops Desktop — Owner's Manual

**Project:** `lonestar-dashboard`
**Service:** `ops-desktop` (Cloud Run, `us-east5`)
**Database:** `ops-desktop-dev` (Cloud SQL PostgreSQL 16, `us-east5-c`, IP `34.162.66.199`)
**URL:** `https://ops-desktop-41047594468.us-east5.run.app`

---

## 1. How to Deploy

Deployment is a two-step process: build the Docker image, then roll it to Cloud Run.

```bash
# Step 1 — build image and push to GCR
gcloud builds submit \
  --tag gcr.io/lonestar-dashboard/ops-desktop:latest \
  --project=lonestar-dashboard

# Step 2 — deploy the new image
gcloud run deploy ops-desktop \
  --image gcr.io/lonestar-dashboard/ops-desktop:latest \
  --region us-east5 \
  --project lonestar-dashboard \
  --platform managed
```

**What happens automatically on each deploy:**

1. Cloud Build runs `npm ci` → `postinstall` runs `prisma generate` with the latest schema.
2. `npm run build` compiles the Next.js standalone bundle.
3. `docker-entrypoint.sh` validates `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`, then starts `node server.js`.
4. **Migrations are NOT auto-run at startup.** Run them manually before deploying when the schema has changed (see §2).

**Check the current revision:**
```bash
gcloud run services describe ops-desktop \
  --region=us-east5 --project=lonestar-dashboard \
  --format="value(status.latestReadyRevisionName)"
```

---

## 2. How to Run Migrations

Migrations must be applied against the live Cloud SQL instance **before** deploying code that depends on new columns/tables.

### During development (local)
```bash
# Creates a new migration file + applies it locally
npm run db:migrate
# or: npx prisma migrate dev --name describe_the_change
```

### In production
Migrations are applied by running `prisma migrate deploy` directly against the Cloud SQL instance. The easiest approach is a one-off Cloud Run Job or running it locally with Cloud SQL Auth Proxy.

**Option A — via Cloud SQL Auth Proxy (recommended for one-off)**
```bash
# 1. Start the proxy (in a separate terminal)
cloud-sql-proxy lonestar-dashboard:us-east5:ops-desktop-dev

# 2. In another terminal, set the local DATABASE_URL and deploy
DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/ops_desktop" \
  npx prisma migrate deploy
```

**Option B — inside a temporary Cloud Run container**
```bash
gcloud run jobs create migrate-job \
  --image gcr.io/lonestar-dashboard/ops-desktop:latest \
  --region us-east5 \
  --project lonestar-dashboard \
  --set-secrets DATABASE_URL=DATABASE_URL:latest \
  --command "npx" \
  --args "prisma,migrate,deploy" \
  --execute-now
```

**Adding a new migration:**
1. Edit `prisma/schema.prisma`.
2. Run `npm run db:migrate` locally to generate the SQL file under `prisma/migrations/`.
3. Commit both the schema change and the migration SQL.
4. Apply with `prisma migrate deploy` before deploying the new Docker image.

---

## 3. How to Seed

The seed script creates users, trigger templates, and 25 sample work items. It is **idempotent** — safe to re-run.

**Required environment variables before seeding:**
```bash
export DATABASE_URL="postgresql://..."
export ADMIN_EMAIL="you@yourdomain.com"
export ALLOWED_EMAILS="staff1@example.com,staff2@example.com"
export SEED_ADMIN_PASSWORD="YourSecureAdminPass123"
export SEED_STAFF_PASSWORD="YourSecureStaffPass123"
```

**Run the seed:**
```bash
npm run db:seed
# or: npx tsx prisma/seed.ts
```

**Optional demo mode** (clears existing work items before seeding):
```bash
SEED_DEMO=true npm run db:seed
```

The seed script will:
- Upsert the admin user (role: `ADMIN`).
- Upsert all staff users from `ALLOWED_EMAILS` (role: `STAFF`).
- Clean up any leftover `@ops.com` demo users.
- Upsert 7 trigger templates (one per `WorkItemType`).
- Create 25 sample work items with subtasks and comments.

---

## 4. How to Rotate Secrets

All secrets are stored in **Google Secret Manager** under project `lonestar-dashboard`. Cloud Run injects them at runtime via secret bindings.

**List all secrets:**
```bash
gcloud secrets list --project=lonestar-dashboard
```

**Required secrets (16 total):**

| Secret Name | What it is |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | NextAuth signing key |
| `NEXTAUTH_SECRET` | (alias used by older auth config) |
| `AUTH_SECRET` | NextAuth signing secret |
| `ADMIN_EMAIL` | Admin user email |
| `ALLOWED_EMAILS` | Comma-separated allowed login emails |
| `CRON_SYNC_SECRET` | Bearer token for cron job endpoints |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | SA JSON for Texas Authors sheet |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Texas Authors spreadsheet ID |
| `GOOGLE_SHEETS_RANGE` | Sheet range for Texas Authors |
| `OPS_SHEETS_SA_JSON` | SA JSON for ops work-items sheet |
| `OPS_SHEETS_SPREADSHEET_ID` | Ops work-items spreadsheet ID |
| `OPS_SHEETS_RANGE` | Range for ops work-items sheet |
| `OPS_SHEETS_SYNC_SECRET` | Bearer token for ops sheets sync |
| `SEED_ADMIN_PASSWORD` | Password used by seed script |
| `SEED_STAFF_PASSWORD` | Password used by seed script |

**Rotate a secret (add a new version):**
```bash
# Example: rotate the cron secret
echo -n "new-secret-value-here" | \
  gcloud secrets versions add CRON_SYNC_SECRET \
    --data-file=- \
    --project=lonestar-dashboard
```

Cloud Run picks up the new version automatically on the next request because secrets are bound with `latest` version alias. No redeploy needed for secret rotation.

**Verify the active version:**
```bash
gcloud secrets versions list CRON_SYNC_SECRET --project=lonestar-dashboard
```

> **Important:** After rotating `DATABASE_URL` you must also update the Cloud SQL user password to match:
> ```bash
> gcloud sql users set-password USER \
>   --host=% --instance=ops-desktop-dev \
>   --project=lonestar-dashboard \
>   --password="new-password"
> ```

---

## 5. How to Fix a Failed Sync

There are two sync jobs: **Ops Sheets sync** (work items/events from internal Google Sheet) and **Texas Authors sync** (authors database from the Texas Authors spreadsheet).

### Diagnose

1. Go to **Admin → Sync Runs** tab in the app.
   A red banner appears automatically if any sync failed in the last 24 hours.
2. Or check the API directly:
   ```bash
   curl -H "Cookie: ..." https://ops-desktop-41047594468.us-east5.run.app/api/admin/sync-status
   ```
3. Or query the DB:
   ```sql
   SELECT * FROM "SheetsImportRun" ORDER BY "createdAt" DESC LIMIT 10;
   SELECT * FROM "CronRunLog" ORDER BY "createdAt" DESC LIMIT 10;
   ```

### Common failure causes and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| `invalid_grant` in error | Service account token expired | Rotate the `GOOGLE_SERVICE_ACCOUNT_JSON` secret with a fresh key downloaded from the SA in Cloud Console |
| `Spreadsheet not found` | Sheet ID changed or SA lost access | Update `GOOGLE_SHEETS_SPREADSHEET_ID` secret; share the sheet with the SA email |
| `Timeout` error | Google Sheets API slow | Re-trigger sync — the sync engine has a 30 s timeout with 1 automatic retry |
| `Unknown column` / Prisma error | Schema out of sync | Run `prisma migrate deploy` then redeploy |
| `Unauthorized` from cron endpoint | Wrong `CRON_SYNC_SECRET` value | Verify the header value matches the secret |

### Manually trigger Texas Authors sync:
```bash
curl -X POST \
  -H "x-cron-secret: $(gcloud secrets versions access latest --secret=CRON_SYNC_SECRET --project=lonestar-dashboard)" \
  https://ops-desktop-41047594468.us-east5.run.app/api/cron/sync/texas-authors
```

### Manually trigger Ops Sheets sync (from Admin UI):
Admin → Sync Runs → click **Sync Now** button.

Or via API (requires admin session cookie):
```bash
curl -X POST \
  -H "Cookie: ..." \
  https://ops-desktop-41047594468.us-east5.run.app/api/admin/sync
```

---

## 6. How Recurrence Works

The **Recurring Deliverables Engine** automatically creates upcoming `EditorialDeadline` rows for the four standing ops cadences. It runs on a schedule (see §7) and is safe to run multiple times — it is fully idempotent.

**Cadences generated automatically:**

| Cadence | Frequency | Due time (UTC) | `cadenceKey` pattern |
|---|---|---|---|
| Newsletter | Every Monday | 09:00 | `NEWSLETTER_2026-03-02` |
| Events Upload | Every Friday | 12:00 | `EVENTS_UPLOAD_2026-02-28` |
| Weekend Events Post | Every Sunday | 17:00 | `WEEKEND_EVENTS_2026-03-01` |
| Magazine | 15th of each month | 12:00 | `MAGAZINE_2026-03` |

**How idempotency works:**
Each deadline has a `cadenceKey` column with a `UNIQUE` constraint. `prisma.editorialDeadline.createMany({ skipDuplicates: true })` is used, so re-running the generator only inserts rows that don't already exist. Rows already in the DB are silently skipped.

**Manually-created deadlines** have `cadenceKey = NULL` — they are never touched or deleted by the generator. PostgreSQL allows multiple `NULL` values in a unique index.

**Lookahead window:** The generator creates deadlines for the next **35 days** from the time it runs.

**Source code:** `src/lib/deadlines/generator.ts`
**API endpoint:** `POST /api/cron/generate-deadlines`
**Audit:** Results are logged to the `CronRunLog` table (job name: `generate-deadlines`).

**Manually trigger deadline generation:**
```bash
curl -X POST \
  -H "x-cron-secret: $(gcloud secrets versions access latest --secret=CRON_SYNC_SECRET --project=lonestar-dashboard)" \
  https://ops-desktop-41047594468.us-east5.run.app/api/cron/generate-deadlines
```

---

## 7. Scheduler Jobs

### Cron endpoint inventory

Both endpoints require the `x-cron-secret` request header to match the `CRON_SYNC_SECRET` secret. They return `401` otherwise.

| Endpoint | Method | Purpose | Logs to |
|---|---|---|---|
| `/api/cron/generate-deadlines` | `POST` | Generates upcoming recurring editorial deadlines for the next 35 days | `CronRunLog` (job: `generate-deadlines`) |
| `/api/cron/sync/texas-authors` | `POST` | Syncs all Texas Authors tabs from Google Sheets to PostgreSQL | `CronRunLog` (job: `texas-authors-sync`) + `SheetsImportRun` |

### Recommended Cloud Scheduler setup

If not already configured, set up Cloud Scheduler jobs to call these endpoints on a schedule:

```bash
# Create the deadline generator job (runs daily at 06:00 UTC)
gcloud scheduler jobs create http generate-deadlines \
  --location=us-central1 \
  --project=lonestar-dashboard \
  --schedule="0 6 * * *" \
  --uri="https://ops-desktop-41047594468.us-east5.run.app/api/cron/generate-deadlines" \
  --http-method=POST \
  --headers="x-cron-secret=REPLACE_WITH_SECRET" \
  --attempt-deadline=60s

# Create the Texas Authors sync job (runs daily at 07:00 UTC)
gcloud scheduler jobs create http texas-authors-sync \
  --location=us-central1 \
  --project=lonestar-dashboard \
  --schedule="0 7 * * *" \
  --uri="https://ops-desktop-41047594468.us-east5.run.app/api/cron/sync/texas-authors" \
  --http-method=POST \
  --headers="x-cron-secret=REPLACE_WITH_SECRET" \
  --attempt-deadline=120s
```

> **Note:** Replace `REPLACE_WITH_SECRET` with the actual value from Secret Manager. Cloud Scheduler does not natively support Secret Manager references in headers — you can use an intermediary Cloud Function or OIDC auth if you need dynamic secret injection.

### Monitoring job runs

- **Admin UI → Health tab:** Shows last run time and status for both jobs.
- **Admin UI → Sync Runs tab:** Shows all Sheets import runs with row counts.
- **Direct DB query:**
  ```sql
  SELECT "jobName", "status", "result", "error", "durationMs", "createdAt"
  FROM "CronRunLog"
  ORDER BY "createdAt" DESC
  LIMIT 20;
  ```

---

## 8. Backup & Recovery

**Automated backups:** Enabled on `ops-desktop-dev` — daily at 02:00 UTC, 7 backups retained, 7-day transaction log retention (point-in-time recovery).

**Restore a backup:**
```bash
# List available backups
gcloud sql backups list --instance=ops-desktop-dev --project=lonestar-dashboard

# Restore (this overwrites the instance — use with caution)
gcloud sql backups restore BACKUP_ID \
  --restore-instance=ops-desktop-dev \
  --project=lonestar-dashboard
```

**Export to GCS (manual snapshot):**
```bash
gcloud sql export sql ops-desktop-dev \
  gs://lonestar-dashboard-backups/ops-desktop-$(date +%Y%m%d).sql \
  --database=ops_desktop \
  --project=lonestar-dashboard
```

---

## 9. Local Development

```bash
# Install dependencies
npm install

# Set up local .env (copy from .env.example or fill manually)
cp .env.example .env.local
# Edit .env.local with DATABASE_URL, AUTH_SECRET, etc.

# Apply migrations to local DB
npm run db:migrate

# Seed local DB
SEED_ADMIN_PASSWORD="dev-password" SEED_STAFF_PASSWORD="dev-password" \
  npm run db:seed

# Start dev server
npm run dev
# → http://localhost:3000

# Open Prisma Studio (DB GUI)
npm run db:studio

# TypeScript check (filters expected stale-client errors)
npx tsc --noEmit 2>&1 | grep -v "cronRunLog\|startedAt\|finishedAt\|durationMs\|updatedById\|statusChangedAt\|ownerChangedAt"
```

---

*Last updated: 2026-02-25 — revision `ops-desktop-00026-xzw`*
