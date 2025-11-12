import { getFirebaseAdmin } from './firebaseAdmin';

/**
 * Ensure Firebase user exists for email
 * Returns existing user or creates new one
 */
export async function ensureFirebaseUser(email) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    throw new Error('Firebase admin not configured');
  }

  const auth = admin.auth();
  
  try {
    // Try to get existing user
    return await auth.getUserByEmail(email);
  } catch (err) {
    // User doesn't exist - create new
    if (err.code === 'auth/user-not-found') {
      return await auth.createUser({
        email,
        emailVerified: false,
        disabled: false,
      });
    }
    throw err;
  }
}

