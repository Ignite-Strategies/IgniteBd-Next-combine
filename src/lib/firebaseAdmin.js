/**
 * Firebase Admin SDK - SERVER-ONLY
 * 
 * ⚠️ NEVER import this file in client components or client-side code
 * Only use in /app/api/**/route.js or other server modules
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountJson) {
      console.warn('⚠️ Firebase admin not initialized: FIREBASE_SERVICE_ACCOUNT_KEY missing');
    } else {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
  }
}

// Export admin instance
export { admin };

// Helper to get admin instance (for backwards compatibility)
export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    throw new Error('Firebase admin not initialized. Check FIREBASE_SERVICE_ACCOUNT_KEY.');
  }
  return admin;
}

// Verify Firebase ID token from request
export async function verifyFirebaseToken(request) {
  const app = getFirebaseAdmin();
  
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization token provided');
  }

  const idToken = authHeader.split('Bearer ')[1];
  const decodedToken = await app.auth().verifyIdToken(idToken);

  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
    name: decodedToken.name,
    picture: decodedToken.picture,
    emailVerified: decodedToken.email_verified,
  };
}

// Optionally verify token (returns null if invalid)
export async function optionallyVerifyFirebaseToken(request) {
  try {
    return await verifyFirebaseToken(request);
  } catch {
    return null;
  }
}

// Get user by UID
export async function getUserByUID(uid) {
  const app = getFirebaseAdmin();
  const userRecord = await app.auth().getUser(uid);
  return {
    uid: userRecord.uid,
    email: userRecord.email,
    displayName: userRecord.displayName,
    photoURL: userRecord.photoURL,
    emailVerified: userRecord.emailVerified,
    disabled: userRecord.disabled,
    metadata: userRecord.metadata,
  };
}

// Create custom token
export async function createCustomToken(uid, additionalClaims = {}) {
  const app = getFirebaseAdmin();
  return app.auth().createCustomToken(uid, additionalClaims);
}
