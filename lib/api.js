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
import { onAuthStateChanged } from 'firebase/auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Auth-ready promise - waits for Firebase auth to initialize
// This is a global, one-time promise that resolves when auth is ready
let authReadyPromise = null;

function waitForAuth() {
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      // If auth is already ready, resolve immediately
      if (auth.currentUser) {
        resolve();
        return;
      }

      // Otherwise, wait for auth state change
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          unsubscribe();
          resolve();
        }
      });

      // Timeout after 5 seconds to prevent hanging
      setTimeout(() => {
        unsubscribe();
        if (!auth.currentUser) {
          console.warn('⚠️ Auth ready timeout - proceeding without auth');
        }
        resolve(); // Resolve anyway to prevent hanging
      }, 5000);
    });
  }
  return authReadyPromise;
}

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
      // Wait for auth to be ready (handles initial load case)
      await waitForAuth();

      const user = auth.currentUser;
      if (!user) {
        // No user after waiting - request will fail with 401
        // This is expected if user is truly logged out
        return config;
      }

      try {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        // Token fetch failed - will be handled by response interceptor
        console.warn('⚠️ Failed to get ID token:', error);
      }
    } catch (error) {
      // Auth wait failed - proceed without token (will get 401)
      console.warn('⚠️ Auth wait failed:', error);
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

