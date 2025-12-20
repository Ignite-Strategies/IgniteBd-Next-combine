/**
 * Axios API Client - CLIENT-ONLY
 * 
 * ⚠️ Only import this in client components (files with 'use client')
 * Never use in server routes or API handlers
 * 
 * This sets up global axios interceptors that run in the browser.
 * If imported server-side, it can interfere with serverless function execution.
 */

'use client';

import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Step 2: Split Axios usage - only register interceptors in browser
// Prevent interceptors from running in serverless runtime
if (typeof window !== 'undefined') {
  // Request interceptor - adds Firebase token to requests
  api.interceptors.request.use(
  async (config) => {
    // CRITICAL: OAuth login is navigation, not data fetching
    // Axios is FORBIDDEN for OAuth login
    // Hard guard: NEVER intercept OAuth navigation
    if (config.url?.includes('/api/microsoft/login')) {
      return config; // NEVER intercept OAuth navigation
    }

    // Ensure /api/* routes always use current origin (local Next.js routes)
    // Don't send them to external backend URL
    if (config.url && config.url.startsWith('/api/')) {
      config.baseURL = window.location.origin;
    }

    try {
      const user = auth.currentUser;

      if (user) {
        try {
          const token = await user.getIdToken();
          config.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
          // Token fetch failed - will be handled by response interceptor
        }
      }
      // No user - request will fail with 401, handled by response interceptor
    } catch (error) {
      // Firebase not initialized yet - skip token for now
      // This can happen on initial page load before Firebase is ready
    }

    return config;
  },
  (error) => Promise.reject(error),
  );

  // Response interceptor - transforms errors into structured format
  // CRITICAL: Axios errors must NEVER be thrown raw - always transform to structured format
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Network errors (no response)
      if (!error.response) {
        return Promise.reject({
          type: 'NETWORK_ERROR',
          action: 'RETRY',
          message: 'Check your internet connection',
          status: 0,
        });
      }

      const { status, data } = error.response;

      // Transform backend error response to structured format
      return Promise.reject({
        type: data?.error || 'UNKNOWN_ERROR',
        action: data?.action || 'RETRY',
        status,
        message: data?.message || data?.error || 'Something went wrong',
      });
    },
  );
}

export default api;

