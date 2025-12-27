/**
 * Redis Helper for Enrichment Data
 * Stores enriched contact data in Redis - just let it chill there
 */

import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (redis) {
    return redis;
  }

  // Use Upstash Redis REST API
  // Automatically reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env
  try {
    // Try fromEnv first - it handles quote stripping internally
    redis = Redis.fromEnv();
    console.log('✅ Upstash Redis client initialized');
    return redis;
  } catch (error: any) {
    // Fallback to manual initialization if fromEnv() fails
    let url = process.env.UPSTASH_REDIS_REST_URL;
    let token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Upstash Redis configuration is missing. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.\n\n' +
        'Note: These should be REST API credentials, not Redis CLI connection strings.\n' +
        'Get them from: https://console.upstash.com/redis -> Your Database -> REST API'
      );
    }

    // Strip quotes from URL and token (common issue when env vars are set with quotes in .env files)
    // Handles: "https://..." or 'https://...' or ""https://..."" or ''https://...''
    url = url.trim().replace(/^["']+|["']+$/g, '');
    token = token.trim().replace(/^["']+|["']+$/g, '');

    // Validate URL format
    if (!url.startsWith('https://')) {
      throw new Error(
        `Invalid UPSTASH_REDIS_REST_URL format. Expected https:// URL, got: ${url}\n\n` +
        'Note: UPSTASH_REDIS_REST_URL should be the REST API URL (https://...), not a Redis CLI connection string (redis://...).\n' +
        'Get the correct URL from: https://console.upstash.com/redis -> Your Database -> REST API'
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
 * Store enriched contact data in Redis by contactId
 * 
 * @param contactId - Contact ID
 * @param rawEnrichmentPayload - Raw Apollo JSON payload
 * @param ttl - Time to live in seconds (default: 7 days)
 * @returns Promise<string> - Redis key
 */
export async function storeEnrichedContactByContactId(
  contactId: string,
  rawEnrichmentPayload: any,
  ttl: number = 7 * 24 * 60 * 60 // 7 days
): Promise<string> {
  try {
    const redisClient = getRedis();
    const timestamp = Date.now();
    const key = `apollo:contact:${contactId}:${timestamp}`;
    
    // Store raw enrichment payload
    const dataToStore = JSON.stringify({
      contactId,
      rawEnrichmentPayload,
      enrichedAt: new Date().toISOString(),
    });
    
    await redisClient.setex(key, ttl, dataToStore);
    
    console.log(`✅ Enriched data stored in Redis: ${key} (TTL: ${ttl}s)`);
    return key;
  } catch (error: any) {
    console.error('❌ Redis store error:', error);
    return '';
  }
}

/**
 * Get enriched contact data from Redis by key
 * 
 * @param redisKey - Full Redis key (e.g., "apollo:contact:123:timestamp")
 * @returns Promise<any | null> - Enriched data or null
 */
export async function getEnrichedContactByKey(redisKey: string): Promise<any | null> {
  try {
    const redisClient = getRedis();
    const data = await redisClient.get(redisKey);
    
    if (!data) {
      return null;
    }
    
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (error: any) {
    console.error('❌ Redis get error:', error);
    return null;
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

/**
 * Get preview intelligence data from Redis by previewId
 * 
 * @param previewId - Preview ID (e.g., "preview:123:abc")
 * @returns Promise<any | null> - Preview data or null
 */
export async function getPreviewIntelligence(previewId: string): Promise<any | null> {
  try {
    const redisClient = getRedis();
    const data = await redisClient.get(previewId);
    
    if (!data) {
      return null;
    }
    
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (error: any) {
    console.error('❌ Redis get preview error:', error);
    return null;
  }
}

/**
 * Store Microsoft Outlook contact preview in Redis
 * 
 * @param previewId - Preview ID (e.g., "preview:123:abc")
 * @param outlookContacts - Array of ContactCandidate from Outlook messages
 * @param rawMessages - Raw Microsoft Graph messages response
 * @param ttl - Time to live in seconds (default: 7 days)
 * @returns Promise<string> - Redis key
 */
export async function storeMicrosoftContactPreview(
  previewId: string,
  outlookContacts: any[],
  rawMessages: any,
  ttl: number = 7 * 24 * 60 * 60 // 7 days
): Promise<string> {
  try {
    const redisClient = getRedis();
    const redisKey = `microsoft:${previewId}`;
    
    // Store raw Microsoft Graph messages
    await redisClient.setex(
      redisKey,
      ttl,
      JSON.stringify({
        rawMessages,
        previewId,
        fetchedAt: new Date().toISOString(),
      })
    );
    
    // Store normalized contact candidates under previewId
    await redisClient.setex(
      previewId,
      ttl,
      JSON.stringify({
        previewId,
        redisKey,
        outlookContacts,
        contactCount: outlookContacts.length,
        createdAt: new Date().toISOString(),
      })
    );
    
    console.log(`✅ Microsoft contact preview stored in Redis: ${previewId}`);
    return redisKey;
  } catch (error: any) {
    console.error('❌ Redis store Microsoft preview error:', error);
    throw error;
  }
}

/**
 * Get Microsoft contact preview from Redis by previewId
 * 
 * @param previewId - Preview ID (e.g., "preview:123:abc")
 * @returns Promise<any | null> - Preview data or null
 */
export async function getMicrosoftContactPreview(previewId: string): Promise<any | null> {
  try {
    const redisClient = getRedis();
    const data = await redisClient.get(previewId);
    
    if (!data) {
      return null;
    }
    
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (error: any) {
    console.error('❌ Redis get Microsoft preview error:', error);
    return null;
  }
}

/**
 * Store presentation outline in Redis
 * 
 * @param outline - Generated presentation outline
 * @param title - Optional title
 * @param description - Optional description
 * @param ttl - Time to live in seconds (default: 1 hour)
 * @returns Promise<string> - Redis key
 */
export async function storePresentationOutline(
  outline: any,
  title?: string,
  description?: string,
  ttl: number = 60 * 60 // 1 hour
): Promise<string> {
  try {
    const redisClient = getRedis();
    const timestamp = Date.now();
    const key = `presentation:outline:${timestamp}`;
    
    const dataToStore = JSON.stringify({
      outline,
      title,
      description,
      storedAt: new Date().toISOString(),
    });
    
    await redisClient.setex(key, ttl, dataToStore);
    
    console.log(`✅ Presentation outline stored in Redis: ${key} (TTL: ${ttl}s)`);
    return key;
  } catch (error: any) {
    console.error('❌ Redis store outline error:', error);
    throw error;
  }
}

/**
 * Get presentation outline from Redis by key
 * 
 * @param redisKey - Full Redis key (e.g., "presentation:outline:1234567890")
 * @returns Promise<any | null> - Outline data or null
 */
export async function getPresentationOutline(redisKey: string): Promise<any | null> {
  try {
    const redisClient = getRedis();
    const data = await redisClient.get(redisKey);
    
    if (!data) {
      return null;
    }
    
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (error: any) {
    console.error('❌ Redis get outline error:', error);
    return null;
  }
}

/**
 * Delete presentation outline from Redis
 * 
 * @param redisKey - Full Redis key
 * @returns Promise<boolean> - Success status
 */
export async function deletePresentationOutline(redisKey: string): Promise<boolean> {
  try {
    const redisClient = getRedis();
    await redisClient.del(redisKey);
    return true;
  } catch (error: any) {
    console.error('❌ Redis delete outline error:', error);
    return false;
  }
}

/**
 * Store blog draft in Redis
 * 
 * @param blogDraft - Generated blog draft (BlogDraft)
 * @param title - Optional title
 * @param subtitle - Optional subtitle
 * @param ttl - Time to live in seconds (default: 1 hour / 3600 seconds)
 * @returns Promise<string> - Redis key
 */
export async function storeBlogDraft(
  blogDraft: any,
  title?: string,
  subtitle?: string,
  ttl: number = 60 * 60
): Promise<string> {
  try {
    const redisClient = getRedis();
    const timestamp = Date.now();
    const key = `blog:draft:${timestamp}`;
    
    const dataToStore = JSON.stringify({
      blogDraft,
      title,
      subtitle,
      storedAt: new Date().toISOString(),
    });
    
    await redisClient.setex(key, ttl, dataToStore);
    
    console.log(`✅ Blog draft stored in Redis: ${key} (TTL: ${ttl}s)`);
    return key;
  } catch (error: any) {
    console.error('❌ Redis store blog draft error:', error);
    throw error;
  }
}

/**
 * Get blog draft from Redis by key
 * 
 * @param redisKey - Full Redis key (e.g., "blog:draft:1234567890")
 * @returns Promise<any | null> - Blog draft data or null
 */
export async function getBlogDraft(redisKey: string): Promise<any | null> {
  try {
    const redisClient = getRedis();
    const data = await redisClient.get(redisKey);
    
    if (!data) {
      return null;
    }
    
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (error: any) {
    console.error('❌ Redis get blog draft error:', error);
    return null;
  }
}

/**
 * Delete blog draft from Redis
 * 
 * @param redisKey - Full Redis key
 * @returns Promise<boolean> - Success status
 */
export async function deleteBlogDraft(redisKey: string): Promise<boolean> {
  try {
    const redisClient = getRedis();
    await redisClient.del(redisKey);
    return true;
  } catch (error: any) {
    console.error('❌ Redis delete outline error:', error);
    return false;
  }
}

/**
 * Outreach Payload Storage Functions
 * Store email payloads for preview/send flow
 */

/**
 * Generate Redis key for payload storage
 */
function getPayloadKey(ownerId: string, requestId: string): string {
  return `outreach:payload:${ownerId}:${requestId}`;
}

/**
 * Write payload to Redis
 * @param ownerId - Owner ID
 * @param requestId - Request ID (UUID)
 * @param payload - SendGrid message payload
 * @param ttl - Time to live in seconds (default: 1 hour)
 */
export async function writePayload(
  ownerId: string,
  requestId: string,
  payload: any,
  ttl: number = 3600 // 1 hour
): Promise<void> {
  try {
    const redisClient = getRedis();
    const key = getPayloadKey(ownerId, requestId);
    await redisClient.setex(key, ttl, JSON.stringify(payload));
    console.log('💾 Payload written to Redis:', key);
  } catch (error: any) {
    console.error('❌ Redis write payload error:', error);
    throw new Error(`Failed to save payload to Redis: ${error.message}`);
  }
}

/**
 * Read payload from Redis
 * @param ownerId - Owner ID
 * @param requestId - Request ID (UUID)
 * @returns Payload object or null if not found
 */
export async function readPayload(ownerId: string, requestId: string): Promise<any | null> {
  try {
    const redisClient = getRedis();
    const key = getPayloadKey(ownerId, requestId);
    const data = await redisClient.get(key);
    
    if (!data) {
      console.log('❌ Payload not found in Redis:', key);
      return null;
    }
    
    console.log('📖 Payload read from Redis:', key);
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (error: any) {
    console.error('❌ Redis read payload error:', error);
    return null;
  }
}

/**
 * Delete payload from Redis (after send)
 * @param ownerId - Owner ID
 * @param requestId - Request ID (UUID)
 */
export async function deletePayload(ownerId: string, requestId: string): Promise<void> {
  try {
    const redisClient = getRedis();
    const key = getPayloadKey(ownerId, requestId);
    await redisClient.del(key);
    console.log('🗑️  Payload deleted from Redis:', key);
  } catch (error: any) {
    console.error('❌ Redis delete payload error:', error);
    // Don't throw - cleanup failure shouldn't break the flow
  }
}

