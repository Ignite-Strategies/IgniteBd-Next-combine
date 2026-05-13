#!/usr/bin/env node

/**
 * Migration script that handles DIRECT_DATABASE_URL for Neon pooler compatibility
 * Uses DIRECT_DATABASE_URL if available, otherwise falls back to DATABASE_URL
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load .env.local if it exists (for local development)
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

// Get environment variables
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// prisma/schema.prisma declares directUrl = env("DIRECT_DATABASE_URL"); Prisma CLI
// still requires that variable to be set. Mirror DATABASE_URL when absent (e.g. Vercel).
if (!process.env.DIRECT_DATABASE_URL) {
  process.env.DIRECT_DATABASE_URL = databaseUrl;
  console.log(
    '⚠️  DIRECT_DATABASE_URL not set — using DATABASE_URL for schema/directUrl. Add a non-pooler Neon URL if migrate deploy times out.',
  );
}

// When both URLs are provided and differ, run migrations on the direct (non-pooler) connection.
if (process.env.DIRECT_DATABASE_URL !== databaseUrl) {
  console.log('✅ Using DIRECT_DATABASE_URL for migrate deploy (bypasses pooler)');
  process.env.DATABASE_URL = process.env.DIRECT_DATABASE_URL;
}

try {
  console.log('🔄 Running Prisma migrations...');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
  console.log('✅ Migrations completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error(
    '\nIf you see P1001 (cannot reach DB on :5432), try HTTP-based apply against Neon:\n' +
      '  npm run migrate:neon-http\n' +
      'Then mark the migration applied when Prisma can connect:\n' +
      '  npx prisma migrate resolve --applied 20260328130000_next_engagement_purpose_refactor\n',
  );
  process.exit(1);
}






