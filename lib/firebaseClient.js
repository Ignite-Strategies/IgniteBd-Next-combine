/**
 * Firebase Client SDK - CLIENT-ONLY
 * 
 * ⚠️ Only import this in client components (files with 'use client')
 * Never use in server routes or API handlers
 */

'use client';

import { initializeApp, getApps } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDNsO_LnQ7t3L_KWejjCuUQxxkI3r0iRxM',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'ignite-strategies-313c0.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ignite-strategies-313c0',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'ignite-strategies-313c0.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '252461468255',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:252461468255:web:0d62b1a63e3e8da77329ea',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-J2YCGRF1ZJ',
};

// Initialize only if not already initialized
export const firebaseClientApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

