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

export default api;

