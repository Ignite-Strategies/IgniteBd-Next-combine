#!/usr/bin/env node

/**
 * Keep Neon Database Awake
 * 
 * This script pings the database every 4 minutes to prevent it from going to sleep.
 * Run this in the background during development or in a separate process.
 * 
 * Usage:
 *   node scripts/keep-db-awake.js
 * 
 * Or run in background:
 *   nohup node scripts/keep-db-awake.js > keep-awake.log 2>&1 &
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const PING_INTERVAL = 4 * 60 * 1000; // 4 minutes (Neon free tier sleeps after 5 min)

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 30000,
});

let isConnected = false;

async function pingDatabase() {
  try {
    if (!isConnected) {
      await client.connect();
      isConnected = true;
      console.log(`[${new Date().toISOString()}] ✅ Connected to database`);
    }
    
    await client.query('SELECT 1');
    console.log(`[${new Date().toISOString()}] 💓 Ping successful - database is awake`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Ping failed:`, error.message);
    isConnected = false;
    
    // Try to reconnect
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    
    const newClient = new Client({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 30000,
    });
    Object.assign(client, newClient);
  }
}

// Initial ping
pingDatabase();

// Set up interval
const interval = setInterval(pingDatabase, PING_INTERVAL);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down keep-alive...');
  clearInterval(interval);
  if (isConnected) {
    await client.end();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down keep-alive...');
  clearInterval(interval);
  if (isConnected) {
    await client.end();
  }
  process.exit(0);
});

console.log(`🌙 Keep-alive started. Pinging database every ${PING_INTERVAL / 1000 / 60} minutes...`);
console.log('Press Ctrl+C to stop\n');





