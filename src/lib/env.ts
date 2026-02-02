/**
 * Environment variable validation
 * Ensures all required env vars are present at boot time
 * Fails fast on missing critical config
 */

const requiredEnvVars = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
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
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
  ALLOWED_EMAILS: process.env.ALLOWED_EMAILS!,

  // App config
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
} as const;
