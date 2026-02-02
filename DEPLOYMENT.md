# Production Deployment Guide

## Overview

OPS Desktop uses a **Build → Migrate → Start** pattern for safe production deployments.

### Deployment Flow

```
1. Build        npx prisma generate && next build
2. Migrate      npx prisma migrate deploy
3. Start        next start
```

This ensures:
- ✅ Migrations run BEFORE app starts
- ✅ No data loss or schema conflicts
- ✅ Safe rollback if migration fails
- ✅ Idempotent (can run multiple times safely)

---

## Local Testing

Test the production flow locally:

```bash
# 1. Build the app
npm run prod:build

# 2. Run migrations
npm run prod:migrate

# 3. Start the server
npm run prod:start
```

Or run all three at once:
```bash
npm run prod:deploy
```

---

## Docker Deployment (Recommended)

### Build Docker Image

```bash
docker build -t ops-desktop:latest .
```

### Run Container

```bash
docker run \
  -e DATABASE_URL="postgresql://user:pass@db:5432/ops_desktop?schema=public" \
  -e AUTH_SECRET="your-secret-key-here" \
  -e AUTH_URL="https://yourdomain.com" \
  -e EMAIL_SERVER_HOST="smtp.gmail.com" \
  -e EMAIL_SERVER_PORT="587" \
  -e EMAIL_SERVER_USER="your-email@gmail.com" \
  -e EMAIL_SERVER_PASSWORD="your-app-password" \
  -e EMAIL_FROM="noreply@yourdomain.com" \
  -p 3000:3000 \
  ops-desktop:latest
```

The entrypoint script (`docker-entrypoint.sh`) automatically:
1. Validates required environment variables
2. Runs `npx prisma migrate deploy`
3. Starts the Next.js server

---

## Render.com Deployment

### 1. Create Web Service

- **Build Command**: `npm run prod:build`
- **Start Command**: `npm run prod:migrate && npm run prod:start`
- **Environment**: Node 20, Ubuntu

### 2. Set Environment Variables

In Render dashboard → Environment:

```
DATABASE_URL=postgresql://...
AUTH_SECRET=...
AUTH_URL=https://your-app.onrender.com
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=...
EMAIL_SERVER_PASSWORD=...
EMAIL_FROM=...
GHL_WEBHOOK_SECRET=...
LOG_LEVEL=info
DEMO_MODE=false
```

### 3. Add PostgreSQL Service

- Database: PostgreSQL
- Region: Same as web service
- Copy connection string to `DATABASE_URL`

---

## Fly.io Deployment

### 1. Install Fly CLI

```bash
brew install flyctl
```

### 2. Create fly.toml

```toml
app = "ops-desktop"
primary_region = "sfo"

[build]
builder = "docker"

[env]
DATABASE_URL = "..."
AUTH_SECRET = "..."
AUTH_URL = "https://ops-desktop.fly.dev"

[[services]]
internal_port = 3000
protocol = "tcp"

[services.concurrency]
hard_limit = 25
soft_limit = 20
```

### 3. Deploy

```bash
flyctl deploy
```

Fly runs Docker build automatically and uses `docker-entrypoint.sh` for migrations.

---

## VPS / Self-Hosted Deployment

### 1. Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Systemd (for auto-restart)

### 2. Setup

```bash
# Clone repo
git clone https://github.com/your-org/ops-desktop.git
cd ops-desktop

# Install dependencies
npm ci

# Set environment variables
cp .env.example .env.production
# Edit .env.production with your values

# Build
npm run prod:build

# Run migrations
npm run prod:migrate
```

### 3. Systemd Service (auto-restart)

Create `/etc/systemd/system/ops-desktop.service`:

```ini
[Unit]
Description=OPS Desktop
After=network.target postgresql.service

[Service]
Type=simple
User=nodeapp
WorkingDirectory=/opt/ops-desktop
EnvironmentFile=/opt/ops-desktop/.env.production
ExecStart=/usr/bin/npm run prod:start
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable ops-desktop
sudo systemctl start ops-desktop
```

---

## Migration Strategies

### Safe Production Migration

**Use `prisma migrate deploy`** (what we use):
- Only runs unapplied migrations
- Fails fast if there are pending migrations
- Idempotent (safe to run multiple times)
- Best for CI/CD pipelines

```bash
npx prisma migrate deploy
```

### Development Migration

Use `prisma migrate dev` for local development:
```bash
npm run db:migrate
```

This:
- Creates new migrations from schema changes
- Applies all unapplied migrations
- Prompts to reset if needed
- NOT safe for production

### Push Without Migration History

For schema-first workflows (not recommended for production):
```bash
npx prisma db push
```

---

## Rollback Strategy

If a migration fails in production:

1. **Identify the failed migration**
   ```bash
   # Check migration status
   npx prisma migrate resolve --rolled-back 20250113_migration_name
   ```

2. **Fix the schema/migration**
   ```bash
   # Edit prisma/migrations/20250113_migration_name/migration.sql
   ```

3. **Redeploy**
   ```bash
   npm run prod:migrate
   ```

---

## Monitoring

### Check Migration Status

```bash
npx prisma migrate status
```

### View Database

```bash
# Local dev
npm run db:studio
```

### Logs

Docker:
```bash
docker logs -f container-name
```

Systemd:
```bash
sudo journalctl -u ops-desktop -f
```

---

## Checklist

Before production deployment:

- [ ] Set `DEMO_MODE=false`
- [ ] Verify DATABASE_URL is production Postgres
- [ ] Set unique `AUTH_SECRET` (use `npx auth secret`)
- [ ] Configure SMTP (EMAIL_SERVER_*)
- [ ] Test migrations locally: `npm run prod:migrate`
- [ ] Run: `npm run prod:build`
- [ ] Test start: `npm run prod:start`
- [ ] Verify app boots without warnings
- [ ] Check database in production is reachable
- [ ] Set `NODE_ENV=production`

---

## Troubleshooting

### Migration fails with "pending migrations"

```bash
# Check status
npx prisma migrate status

# Apply pending
npx prisma migrate deploy
```

### "AUTH_SECRET is required"

Migrations run before the app validates env vars. The entrypoint validates early:

```bash
# In docker-entrypoint.sh, see lines 10-27
```

Set all required env vars before deploying.

### Database connection timeout

- Check DATABASE_URL is correct
- Verify network connectivity to database
- Check database credentials
- Ensure database server is running

---

## Success Criteria

✅ **Deployment is successful when:**

- Build completes without errors
- Migrations apply successfully
- App starts and responds to `http://localhost:3000`
- Database is accessible
- NextAuth magic links work
- All required environment variables are set
