#!/usr/bin/env node

/**
 * Migration script that handles DIRECT_DATABASE_URL for Neon pooler compatibility
 * Uses DIRECT_DATABASE_URL if available, otherwise falls back to DATABASE_URL
 */

const { execSync } = require('child_process');
const path = require('path');

// Get environment variables
const directUrl = process.env.DIRECT_DATABASE_URL;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// If DIRECT_DATABASE_URL is set, use it for migrations
// Otherwise, use DATABASE_URL (may timeout with Neon pooler)
if (directUrl) {
  console.log('✅ Using DIRECT_DATABASE_URL for migrations (bypasses pooler)');
  process.env.DATABASE_URL = directUrl;
} else {
  console.log('⚠️  DIRECT_DATABASE_URL not set, using DATABASE_URL');
  console.log('⚠️  If migrations timeout, set DIRECT_DATABASE_URL in Vercel');
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
  process.exit(1);
}

