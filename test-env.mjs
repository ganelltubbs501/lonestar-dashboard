// Quick test to verify env validation works
import('./src/lib/env.ts')
  .then(() => {
    console.log('✓ Env validation passed - all required vars present');
    process.exit(0);
  })
  .catch((err) => {
    console.error('✗ Env validation failed:', err.message);
    process.exit(1);
  });
