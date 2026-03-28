#!/usr/bin/env node
/**
 * Apply raw SQL migrations over Neon's HTTP SQL transport (via @neondatabase/serverless).
 * Use when `prisma migrate deploy` fails with P1001 (TCP :5432 blocked or pooler issues).
 *
 * Loads .env then .env.local (non-overriding), prefers DIRECT_DATABASE_URL then DATABASE_URL.
 *
 * After this succeeds, mark the migration in Prisma history from any machine that can run Prisma against the DB:
 *   npx prisma migrate resolve --applied 20260328130000_next_engagement_purpose_refactor
 *
 * Or run a normal deploy (it will see the migration as pending until resolved).
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadDotEnv(files) {
  for (const name of files) {
    const p = path.join(root, name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadDotEnv(['.env', '.env.local']);

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Set DATABASE_URL or DIRECT_DATABASE_URL');
  process.exit(1);
}

const migrationPath =
  process.argv[2] ||
  path.join(
    root,
    'prisma/migrations/20260328130000_next_engagement_purpose_refactor/migration.sql',
  );

let sqlText = readFileSync(migrationPath, 'utf8');
// Drop full-line SQL comments so semicolons inside "-- ...;" do not split statements
sqlText = sqlText
  .split('\n')
  .filter((line) => !/^\s*--/.test(line))
  .join('\n');
const statements = sqlText
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const sql = neon(connectionString);

async function main() {
  console.log(`📡 Neon's HTTP driver (${path.basename(migrationPath)}) — ${statements.length} statement(s)`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].endsWith(';') ? statements[i] : `${statements[i]};`;
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 72);
    try {
      await sql(stmt);
      console.log(`✅ [${i + 1}/${statements.length}] ${preview}…`);
    } catch (err) {
      const msg = err?.message || String(err);
      if (
        /already exists|duplicate key|enum label.*already exists/i.test(msg) ||
        /FOLLOW_UP.*not exist|POST_WARM_MEETING_NUDGE/i.test(msg)
      ) {
        console.warn(`⏭️  [${i + 1}/${statements.length}] Skipped (likely already applied): ${preview}…`);
        console.warn(`   ${msg}`);
        continue;
      }
      console.error(`❌ Failed on: ${preview}…`);
      throw err;
    }
  }
  console.log('\n✅ SQL applied. Mark Prisma migration as applied when you can run Prisma against this DB:');
  console.log(
    '   npx prisma migrate resolve --applied 20260328130000_next_engagement_purpose_refactor\n',
  );
}

main().catch((e) => {
  console.error('❌', e?.message || e);
  process.exit(1);
});
