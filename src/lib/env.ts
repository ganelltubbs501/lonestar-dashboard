/**
 * Environment variable validation
 * Ensures all required env vars are present at boot time
 * Fails fast on missing critical config
 */

const requiredEnvVars = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'AUTH_URL',
  'ALLOWED_EMAILS',
];

// Validate required environment variables at module load
function validateEnv() {
  const missing: string[] = [];

  // Check required vars
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    const message = `
╔════════════════════════════════════════════════════════════╗
║           MISSING REQUIRED ENVIRONMENT VARIABLES            ║
╚════════════════════════════════════════════════════════════╝

The following environment variables are required but not set:

${missing.map((v) => `  • ${v}`).join('\n')}

Please add these to your .env.local or deployment configuration.

For production deployments, ensure all variables are defined.
`;
    console.error(message);
    process.exit(1);
  }

  // Warn about missing optional but recommended vars in production
  if (process.env.NODE_ENV === 'production') {
    const warnings: string[] = [];

    if (!process.env.CRON_SYNC_SECRET) {
      warnings.push('CRON_SYNC_SECRET not set - cron endpoints will reject all requests');
    }
    if (!process.env.GHL_WEBHOOK_SECRET) {
      warnings.push('GHL_WEBHOOK_SECRET not set - webhook signature verification disabled');
    }

    if (warnings.length > 0) {
      console.warn('⚠️  Production environment warnings:');
      warnings.forEach((w) => console.warn(`   • ${w}`));
    }
  }

  // Log validation success in development
  if (process.env.NODE_ENV === 'development') {
    console.log('✓ Environment variables validated');
  }
}

// Run validation
validateEnv();

// Export validated env object for type-safe access
export const env = {
  // Required for authentication and database
  DATABASE_URL: process.env.DATABASE_URL!,
  AUTH_SECRET: process.env.AUTH_SECRET!,
  AUTH_URL: process.env.AUTH_URL!,
  ALLOWED_EMAILS: process.env.ALLOWED_EMAILS!,

  // App config
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
} as const;
