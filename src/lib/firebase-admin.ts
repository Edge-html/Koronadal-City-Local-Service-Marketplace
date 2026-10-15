import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function adminServices() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      || (process.env.FIREBASE_SERVICE_ACCOUNT
        ? readFileSync(resolve(process.env.FIREBASE_SERVICE_ACCOUNT), "utf8")
        : "");
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
    const value = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    const key = JSON.parse(value);
    if (key.project_id !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      throw new Error("The private Firebase key belongs to a different project.");
    }
    initializeApp({ credential: cert(key) });
  }
  return { auth: getAuth(), db: getFirestore() };
}
