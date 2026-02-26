#!/bin/sh
# Docker entrypoint script for production
# Runs migrations safely before starting the app

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OPS DESKTOP - Production Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Validate required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL is not set"
  exit 1
fi

if [ -z "$AUTH_SECRET" ]; then
  echo "❌ ERROR: AUTH_SECRET is not set"
  exit 1
fi

if [ -z "$AUTH_URL" ]; then
  echo "❌ ERROR: AUTH_URL is not set"
  exit 1
fi

echo "✓ Environment variables validated"

# 2. Start the application (migrations are run as a separate deploy step)
echo ""
echo "▶ Starting Next.js server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run the Next.js server
# server.js is the standalone output from 'next build'
exec node server.js
