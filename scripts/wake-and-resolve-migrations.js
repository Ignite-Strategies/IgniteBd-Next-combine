#!/usr/bin/env node

/**
 * Wake up Neon database and resolve failed migrations
 * 
 * Neon databases can go to sleep and need to be woken up.
 * This script retries with exponential backoff until the database is awake.
 */

require('dotenv').config({ path: '.env.local' });
const { execSync } = require('child_process');

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];
const MAX_RETRIES = 10;
const INITIAL_DELAY = 2000; // 2 seconds

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function wakeDatabase() {
  console.log('🌙 Waking up Neon database...\n');
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${MAX_RETRIES}: Checking database connection...`);
      
      execSync(
        `npx prisma migrate status`,
        { 
          stdio: 'pipe',
          env: { ...process.env, DATABASE_URL },
          timeout: 10000
        }
      );
      
      console.log('✅ Database is awake!\n');
      return true;
    } catch (error) {
      if (error.message.includes('P1001') || error.message.includes("Can't reach database")) {
        const delay = INITIAL_DELAY * Math.pow(1.5, attempt - 1);
        console.log(`   ⏳ Database still sleeping, waiting ${delay/1000}s before retry...\n`);
        await sleep(delay);
      } else {
        // Different error - database might be awake but has other issues
        console.log('   ⚠️  Database responded but with an error (might be awake now)');
        return true;
      }
    }
  }
  
  console.error('❌ Could not wake up database after', MAX_RETRIES, 'attempts');
  return false;
}

async function resolveFailedMigrations() {
  try {
    // First, wake up the database
    const isAwake = await wakeDatabase();
    if (!isAwake) {
      process.exit(1);
    }

    console.log('🔍 Finding failed migrations...\n');
    
    // Get migration status
    let statusOutput;
    try {
      statusOutput = execSync(
        `npx prisma migrate status`,
        { 
          stdio: 'pipe',
          env: { ...process.env, DATABASE_URL },
          encoding: 'utf8'
        }
      );
    } catch (error) {
      statusOutput = error.stdout?.toString() || error.stderr?.toString() || '';
    }

    // Extract failed migration names
    const failedMigrations = [];
    const lines = statusOutput.split('\n');
    let inFailedSection = false;
    
    for (const line of lines) {
      if (line.includes('Following migration have failed:') || line.includes('Following migrations have failed:')) {
        inFailedSection = true;
        continue;
      }
      if (inFailedSection && line.trim() && !line.includes('During development')) {
        const match = line.match(/^(\d{14}_[a-zA-Z0-9_]+)/);
        if (match) {
          failedMigrations.push(match[1]);
        }
        if (line.includes('During development')) {
          break;
        }
      }
    }

    if (failedMigrations.length === 0) {
      // Try to parse from the error message format
      const statusMatch = statusOutput.match(/Following migration have failed:\s*(\d{14}_[a-zA-Z0-9_]+)/);
      if (statusMatch) {
        failedMigrations.push(statusMatch[1]);
      }
    }

    if (failedMigrations.length === 0) {
      console.log('✅ No failed migrations found!');
      return;
    }

    console.log(`Found ${failedMigrations.length} failed migration(s):`);
    failedMigrations.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
    console.log('');

    // Resolve each failed migration
    let successCount = 0;
    let errorCount = 0;

    for (const migrationName of failedMigrations) {
      try {
        console.log(`🔄 Resolving: ${migrationName}`);
        
        execSync(
          `npx prisma migrate resolve --applied "${migrationName}"`,
          { 
            stdio: 'inherit',
            env: { ...process.env, DATABASE_URL }
          }
        );
        
        console.log(`✅ Marked as applied: ${migrationName}\n`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error resolving ${migrationName}:`, error.message);
        errorCount++;
        console.log('');
      }
    }

    console.log('='.repeat(60));
    console.log('📊 Summary:');
    console.log(`✅ Successfully resolved: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    if (successCount > 0) {
      console.log('✅ All failed migrations have been marked as applied!\n');
      console.log('Next steps:');
      console.log('1. Run: npx prisma migrate deploy');
      console.log('2. This should now proceed without migration conflicts\n');
    }

    if (errorCount > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resolveFailedMigrations();





