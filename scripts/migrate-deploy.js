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
  console.error(
    '\nIf you see P1001 (cannot reach DB on :5432), try HTTP-based apply against Neon:\n' +
      '  npm run migrate:neon-http\n' +
      'Then mark the migration applied when Prisma can connect:\n' +
      '  npx prisma migrate resolve --applied 20260328130000_next_engagement_purpose_refactor\n',
  );
  process.exit(1);
}






