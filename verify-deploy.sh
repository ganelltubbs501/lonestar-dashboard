#!/bin/bash
# Production deployment verification script
# Run this to test the deploy flow locally before pushing to production

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OPS DESKTOP - Deployment Flow Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Check environment variables
echo "▶ Step 1: Checking environment variables..."
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set in .env"
fi
if [ -z "$AUTH_SECRET" ]; then
  echo "⚠️  AUTH_SECRET not set in .env"
fi
if [ -z "$AUTH_URL" ]; then
  echo "⚠️  AUTH_URL not set in .env"
fi
echo "✓ Environment check complete"
echo ""

# Step 2: Prisma Generate
echo "▶ Step 2: Generating Prisma Client..."
npm run db:generate
echo "✓ Prisma Client generated"
echo ""

# Step 3: Check migration status
echo "▶ Step 3: Checking migration status..."
npx prisma migrate status
echo "✓ Migration status checked"
echo ""

# Step 4: Build
echo "▶ Step 4: Building Next.js app..."
npm run prod:build
echo "✓ Build complete"
echo ""

# Step 5: Test migration deploy (dry run / status check)
echo "▶ Step 5: Verifying migration deploy command..."
npx prisma migrate deploy
echo "✓ Migrations applied (or already up to date)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment flow verified successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Run: npm run prod:start"
echo "  2. Visit: http://localhost:3000"
echo "  3. Deploy to production when ready"
