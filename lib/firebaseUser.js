/**
 * Firebase User Helper - SERVER-ONLY
 * 
 * ⚠️ NEVER import this file in client components
 * Only use in /app/api routes or other server modules
 */

import { admin } from './firebaseAdmin';

/**
 * Ensure Firebase user exists for email
 * Returns { user, wasCreated: boolean }
 */
export async function ensureFirebaseUser(email, displayName = null) {
  if (!admin.apps.length) {
    throw new Error('Firebase admin not configured. Check FIREBASE_SERVICE_ACCOUNT_KEY.');
  }

  const auth = admin.auth();
  
  try {
    // Try to get existing user
    const user = await auth.getUserByEmail(email);
    return { user, wasCreated: false };
  } catch (err) {
    // User doesn't exist - create new
    if (err.code === 'auth/user-not-found') {
      const userData = {
        email,
        emailVerified: false,
        disabled: false,
      };
      
      // Add displayName if provided
      if (displayName) {
        userData.displayName = displayName;
      }
      
      const user = await auth.createUser(userData);
      return { user, wasCreated: true };
    }
    throw err;
  }
}

