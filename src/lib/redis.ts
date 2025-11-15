/**
 * Redis Helper for Enrichment Data
 * Stores enriched contact data in Redis - just let it chill there
 */

import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (redis) {
    return redis;
  }

  // Use Upstash Redis REST API
  // Automatically reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env
  try {
    redis = Redis.fromEnv();
    console.log('✅ Upstash Redis client initialized');
    return redis;
  } catch (error: any) {
    // Fallback to manual initialization if fromEnv() fails
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Upstash Redis configuration is missing. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.'
      );
    }

    redis = new Redis({
      url,
      token,
    });
    console.log('✅ Upstash Redis client initialized (manual)');
    return redis;
  }
}

/**
 * Store enriched contact data in Redis
 * Just let it chill there - no database writes
 * 
 * @param linkedinUrl - LinkedIn URL (used as key)
 * @param enrichedData - Enriched contact data from Apollo
 * @param ttl - Time to live in seconds (default: 7 days)
 * @returns Promise<string> - Redis key
 */
export async function storeEnrichedContact(
  linkedinUrl: string,
  enrichedData: any,
  ttl: number = 7 * 24 * 60 * 60 // 7 days
): Promise<string> {
  try {
    const redisClient = getRedis();
    const key = `apollo:enriched:${linkedinUrl}`;
    
    // Store enriched data with TTL using Upstash Redis
    // setex(key, seconds, value) - standard Redis command
    const dataToStore = JSON.stringify({
      linkedinUrl,
      enrichedData,
      enrichedAt: new Date().toISOString(),
    });
    
    await redisClient.setex(key, ttl, dataToStore);
    
    console.log(`✅ Enriched data stored in Upstash Redis: ${key} (TTL: ${ttl}s)`);
    return key;
  } catch (error: any) {
    console.error('❌ Upstash Redis store error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
    });
    // Don't throw - just log, we don't want to break the flow
    return '';
  }
}

/**
 * Get enriched contact data from Redis
 * 
 * @param keyOrLinkedInUrl - Redis key (e.g., "apollo:enriched:...") or LinkedIn URL
 * @returns Promise<any | null> - Enriched data or null
 */
export async function getEnrichedContact(keyOrLinkedInUrl: string): Promise<any | null> {
  try {
    const redisClient = getRedis();
    // If it's already a full Redis key, use it; otherwise construct the key
    const key = keyOrLinkedInUrl.startsWith('apollo:enriched:') 
      ? keyOrLinkedInUrl 
      : `apollo:enriched:${keyOrLinkedInUrl}`;
    const data = await redisClient.get(key);
    
    if (!data) {
      return null;
    }
    
    // Upstash Redis returns data as-is, parse if string
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (error: any) {
    console.error('❌ Upstash Redis get error:', error);
    return null;
  }
}

/**
 * List all enriched contacts in Redis
 * 
 * @returns Promise<string[]> - Array of Redis keys
 */
export async function listEnrichedContacts(): Promise<string[]> {
  try {
    const redisClient = getRedis();
    const keys = await redisClient.keys('apollo:enriched:*');
    return keys as string[];
  } catch (error: any) {
    console.error('❌ Upstash Redis list error:', error);
    return [];
  }
}

/**
 * Delete enriched contact from Redis
 * 
 * @param linkedinUrl - LinkedIn URL (used as key)
 * @returns Promise<boolean> - Success status
 */
export async function deleteEnrichedContact(linkedinUrl: string): Promise<boolean> {
  try {
    const redisClient = getRedis();
    const key = `apollo:enriched:${linkedinUrl}`;
    await redisClient.del(key);
    return true;
  } catch (error: any) {
    console.error('❌ Upstash Redis delete error:', error);
    return false;
  }
}

