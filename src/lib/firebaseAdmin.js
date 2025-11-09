import admin from 'firebase-admin';

const globalForFirebase = globalThis;

function initFirebaseAdmin() {
  if (globalForFirebase.firebaseAdmin) {
    return globalForFirebase.firebaseAdmin;
  }

  if (!admin.apps.length) {
    try {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (!serviceAccountJson) {
        console.warn('Firebase admin not initialized: FIREBASE_SERVICE_ACCOUNT_KEY missing');
        return null;
      }

      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin:', error);
      return null;
    }
  }

  globalForFirebase.firebaseAdmin = admin;
  return admin;
}

export function getFirebaseAdmin() {
  return initFirebaseAdmin();
}

export async function verifyFirebaseToken(request) {
  const app = initFirebaseAdmin();
  if (!app) {
    throw new Error('Firebase admin not configured');
  }

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

export async function optionallyVerifyFirebaseToken(request) {
  try {
    return await verifyFirebaseToken(request);
  } catch {
    return null;
  }
}

export async function getUserByUID(uid) {
  const app = initFirebaseAdmin();
  if (!app) {
    throw new Error('Firebase admin not configured');
  }

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

export async function createCustomToken(uid, additionalClaims = {}) {
  const app = initFirebaseAdmin();
  if (!app) {
    throw new Error('Firebase admin not configured');
  }

  return app.auth().createCustomToken(uid, additionalClaims);
}

