/**
 * Centralized CORS Configuration
 * 
 * Handles CORS headers for all API routes
 * Supports multiple allowed origins via environment variable
 */

import { NextResponse } from 'next/server';

// Get allowed origins from environment variable
// Format: comma-separated list of origins
// Example: "https://clientportal.ignitegrowth.biz,https://app.ignitegrowth.biz"
const getAllowedOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN;
  
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim());
  }
  
  // Default fallback
  return ['https://clientportal.ignitegrowth.biz'];
};

// CORS headers configuration
export function getCorsHeaders(origin = null) {
  const allowedOrigins = getAllowedOrigins();
  
  // If origin is provided, check if it's allowed
  // Otherwise, allow the first origin (for same-origin requests)
  const allowedOrigin = origin && allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Handle OPTIONS preflight request
 * Returns 204 No Content with CORS headers
 */
export function handleCorsPreflight(request) {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin);
  
  return NextResponse.json(null, {
    status: 204,
    headers,
  });
}

/**
 * Wrap a NextResponse with CORS headers
 */
export function withCors(response, request = null) {
  const origin = request?.headers?.get('origin');
  const headers = getCorsHeaders(origin);
  
  // Merge CORS headers with existing response headers
  const responseHeaders = new Headers(response.headers);
  Object.entries(headers).forEach(([key, value]) => {
    responseHeaders.set(key, value);
  });
  
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

/**
 * Create a CORS-enabled response
 */
export function corsResponse(data, status = 200, request = null) {
  try {
    const origin = request?.headers?.get('origin');
    const headers = getCorsHeaders(origin);
    
    return NextResponse.json(data, {
      status,
      headers,
    });
  } catch (error) {
    console.error('❌ CORS utility error:', error);
    // Fallback: return response without CORS if utility fails
    return NextResponse.json(data, {
      status,
    });
  }
}

