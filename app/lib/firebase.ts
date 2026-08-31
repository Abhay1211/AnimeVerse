/**
 * Firebase client (Web SDK) initialization for AnimeVerse.
 *
 * Only the browser-side SDK is used here — never the Admin SDK. Configuration
 * comes from `NEXT_PUBLIC_FIREBASE_*` env vars (see `.env.local`); nothing is
 * hardcoded. The Firebase web API key is not a server secret, but the config
 * still lives in the environment and `.env.local` stays out of git.
 *
 * Auth and Firestore are initialized lazily via `getFirebaseAuth()` /
 * `getFirebaseDb()` so they only ever run in the browser (called from form
 * submit handlers) — never during server rendering or static prerendering.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
    browserLocalPersistence,
    getAuth,
    setPersistence,
    type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** The Firebase app, created once and reused (survives Fast Refresh). */
function firebaseApp(): FirebaseApp {
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

let authInstance: Auth | null = null;

/**
 * Returns the Firebase Auth instance, initializing it on first use.
 *
 * Keeps the user signed in across refreshes / reopened tabs using Firebase's
 * own browser persistence (IndexedDB, falling back to localStorage). We do not
 * roll our own token storage.
 */
export function getFirebaseAuth(): Auth {
    if (authInstance) return authInstance;

    authInstance = getAuth(firebaseApp());

    if (typeof window !== "undefined") {
        setPersistence(authInstance, browserLocalPersistence).catch(() => {
            // Non-fatal: Firebase falls back to its default persistence.
        });
    }

    return authInstance;
}

let dbInstance: Firestore | null = null;

/**
 * Returns the Firestore instance, initializing it on first use against the same
 * Firebase app. Call this only from the browser (e.g. the sign-up handler).
 */
export function getFirebaseDb(): Firestore {
    if (dbInstance) return dbInstance;

    dbInstance = getFirestore(firebaseApp());

    return dbInstance;
}
