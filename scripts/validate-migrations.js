#!/usr/bin/env node

/**
 * Migration Validator
 * 
 * Validates all migration directories to ensure:
 * - No malformed names (shell variables not expanded)
 * - All migrations have migration.sql files
 * - No duplicate migrations
 * - Proper naming format
 * 
 * Usage:
 *   node scripts/validate-migrations.js
 */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');

// Check for malformed migration names
function checkMalformedNames() {
  const issues = [];
  
  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ prisma/migrations directory not found');
    return issues;
  }
  
  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const name = entry.name;
    
    // Check for shell variable syntax that wasn't expanded
    if (name.includes('$(date') || name.includes('${date') || name.includes('$(')) {
      issues.push({
        type: 'malformed_name',
        name: name,
        issue: 'Contains shell variable syntax that was not expanded',
        fix: `Rename or delete: ${name}`
      });
    }
    
    // Check for proper timestamp format (should start with YYYYMMDDHHMMSS)
    if (!/^\d{14}_/.test(name) && !name.startsWith('add_product_fields')) {
      // Allow some legacy migrations
      if (!name.match(/^\d{8}_/) && !name.startsWith('add_product_fields')) {
        issues.push({
          type: 'invalid_format',
          name: name,
          issue: 'Does not start with timestamp (YYYYMMDDHHMMSS)',
          fix: `Rename to: YYYYMMDDHHMMSS_${name.replace(/^\d+_/, '')}`
        });
      }
    }
    
    // Check if migration.sql exists
    const migrationFile = path.join(migrationsDir, name, 'migration.sql');
    if (!fs.existsSync(migrationFile)) {
      issues.push({
        type: 'missing_file',
        name: name,
        issue: 'Missing migration.sql file',
        fix: `Create migration.sql or remove directory: ${name}`
      });
    }
  }
  
  return issues;
}

// Check for duplicate migrations
function checkDuplicates() {
  const duplicates = [];
  const seen = new Map();
  
  if (!fs.existsSync(migrationsDir)) return duplicates;
  
  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const name = entry.name;
    // Extract base name (without timestamp)
    const baseName = name.replace(/^\d+_/, '').replace(/^\$\(date[^)]+\)_/, '');
    
    if (seen.has(baseName)) {
      duplicates.push({
        type: 'duplicate',
        name: name,
        baseName: baseName,
        existing: seen.get(baseName),
        fix: `Keep one, remove the other: ${name} or ${seen.get(baseName)}`
      });
    } else {
      seen.set(baseName, name);
    }
  }
  
  return duplicates;
}

// Main validation
function validateMigrations() {
  console.log('🔍 Validating migrations...\n');
  
  const malformedIssues = checkMalformedNames();
  const duplicateIssues = checkDuplicates();
  const allIssues = [...malformedIssues, ...duplicateIssues];
  
  if (allIssues.length === 0) {
    console.log('✅ All migrations are valid!');
    return 0;
  }
  
  console.log(`❌ Found ${allIssues.length} issue(s):\n`);
  
  for (const issue of allIssues) {
    console.log(`[${issue.type.toUpperCase()}] ${issue.name}`);
    console.log(`   Issue: ${issue.issue}`);
    console.log(`   Fix: ${issue.fix}`);
    console.log('');
  }
  
  console.log('💡 To fix malformed migrations:');
  console.log('   1. Delete malformed migration directories');
  console.log('   2. Mark them as resolved in database:');
  console.log('      npx prisma migrate resolve --applied "migration_name"');
  console.log('   3. Run validation again:');
  console.log('      node scripts/validate-migrations.js');
  
  return 1;
}

const exitCode = validateMigrations();
process.exit(exitCode);

