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
import { getAuth } from 'firebase/auth';

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
    try {
      const firebaseAuth = getAuth();
      const user = firebaseAuth.currentUser;

      if (user) {
        try {
          const token = await user.getIdToken();
          config.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
          console.error('Failed to fetch Firebase token:', error);
        }
      }
    } catch (error) {
      // Firebase not initialized yet - skip token for now
      // This can happen on initial page load before Firebase is ready
      if (error.code !== 'app/no-app') {
        console.warn('Firebase auth not available:', error.message);
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
  );

  // Response interceptor - handles errors globally
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Silently handle 401s - they're expected when user isn't authenticated yet
      // Only log in development mode for debugging
      if (error.response?.status === 401 && process.env.NODE_ENV === 'development') {
        // Suppress console warnings for 401s - they're handled by components
      }
      // Silently handle 404s - they're expected for missing resources
      if (error.response?.status === 404) {
        // Suppress console warnings for 404s
      }
      return Promise.reject(error);
    },
  );
}

export default api;

