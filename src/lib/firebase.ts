import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Firebase bootstrap.
 *
 * Auth and Firestore are created lazily rather than at module scope. `getAuth`
 * validates its apiKey immediately and throws `auth/invalid-api-key` if the
 * environment is incomplete — and because a client component's module graph is
 * still evaluated while Next.js prerenders, an eager `getAuth()` at import
 * time takes the entire build down whenever `NEXT_PUBLIC_FIREBASE_*` is
 * missing, surfacing as an opaque error on whichever route happened to
 * prerender first (`/_not-found`, in practice).
 *
 * Deferring initialization keeps a missing key a runtime concern limited to the
 * features that actually need Firebase, and turns a cryptic build failure into
 * a named, actionable message.
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/** Env-var name -> the config field Firebase actually reads it into. */
const REQUIRED_KEYS = [
  ["NEXT_PUBLIC_FIREBASE_API_KEY", "apiKey"],
  ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "authDomain"],
  ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", "projectId"],
  ["NEXT_PUBLIC_FIREBASE_APP_ID", "appId"],
] as const satisfies ReadonlyArray<readonly [string, keyof typeof config]>;

export const missingFirebaseKeys = REQUIRED_KEYS.filter(
  ([, field]) => !config[field],
).map(([name]) => name);

export const firebaseConfigured = missingFirebaseKeys.length === 0;

function configurationError(): Error {
  const where =
    typeof window === "undefined" ? "the build environment" : "this deployment";
  return new Error(
    [
      `Firebase is not configured in ${where}.`,
      "",
      "Missing environment variables:",
      ...missingFirebaseKeys.map((key) => `  - ${key}`),
      "",
      "Local development: add them to .env.local (see .env.example).",
      "Vercel: Project -> Settings -> Environment Variables, then redeploy.",
      "",
      "Firebase client keys are public by design and safe to commit to",
      ".env.example. Access is controlled by firestore.rules, not by them.",
    ].join("\n"),
  );
}

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

let authInstance: Auth | null = null;

/** Lazily resolved Firebase Auth. Browser-scoped by nature. */
export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    if (!firebaseConfigured) throw configurationError();
    authInstance = getAuth(app());
  }
  return authInstance;
}

let firestoreInstance: Firestore | null = null;

/** Lazily resolved Firestore handle. */
export function getFirebaseDb(): Firestore {
  if (!firestoreInstance) {
    if (!firebaseConfigured) throw configurationError();
    firestoreInstance = getFirestore(app());
  }
  return firestoreInstance;
}