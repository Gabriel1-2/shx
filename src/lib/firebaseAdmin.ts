import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } else {
            console.warn("FIREBASE_SERVICE_ACCOUNT_KEY is not set. Analytics backend will fail.");
        }
    } catch (error) {
        console.error("Firebase admin initialization error", error);
    }
}

export const adminDb = admin.apps.length ? admin.firestore() : null;
