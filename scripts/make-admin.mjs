/**
 * Promotes an account to platform administrator.
 *
 *   npm run make-admin -- you@example.com
 *   npm run make-admin -- you@example.com --create
 *
 * Admin is the platform-wide override that unlocks every Firestore
 * collection, so it can never be self-assigned from the client — the rules
 * permit only customer -> worker. This script is the intended way to grant it,
 * via the Admin SDK with a service account key.
 *
 * Service account setup:
 *   Firebase console -> Project settings -> Service accounts
 *   "Generate new private key", save as service-account.json in the repo root
 *   then set FIREBASE_SERVICE_ACCOUNT=./service-account.json in .env.local
 */

import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (!process.env[key]) {
      process.env[key] = raw.replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const shouldCreate = args.includes("--create");

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(
    [
      "",
      "Usage:",
      "  npm run make-admin -- you@example.com",
      "  npm run make-admin -- you@example.com --create   (create if missing)",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const keyPathRaw =
  process.env.FIREBASE_SERVICE_ACCOUNT ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
const keyPath = keyPathRaw
  ? isAbsolute(keyPathRaw)
    ? keyPathRaw
    : join(ROOT, keyPathRaw)
  : join(ROOT, "service-account.json");

if (!existsSync(keyPath)) {
  console.error(
    [
      "",
      `Missing Firebase service account key. Looked for: ${keyPath}`,
      "",
      "How to fix:",
      "  1. Firebase console -> Project settings -> Service accounts",
      "  2. 'Generate new private key', save it as service-account.json",
      "  3. Add to .env.local:",
      "       FIREBASE_SERVICE_ACCOUNT=./service-account.json",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const app = initializeApp({
  credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))),
});
const adminAuth = getAuth(app);
const db = getFirestore(app);

async function main() {
  console.log(`Project: ${app.options.projectId ?? "unknown"}`);
  console.log(`Target:  ${email}\n`);

  let uid;
  let generatedPassword = null;

  try {
    const existing = await adminAuth.getUserByEmail(email);
    uid = existing.uid;
    console.log("Found an existing auth account.");
  } catch (err) {
    if (err?.code !== "auth/user-not-found") {
      throw err;
    }
    if (!shouldCreate) {
      console.error(
        [
          "",
          `No auth account exists for ${email}.`,
          "",
          "Re-run with --create to create it:",
          `  npm run make-admin -- ${email} --create`,
          "",
        ].join("\n"),
      );
      process.exit(1);
    }
    generatedPassword = `kor-${randomBytes(9).toString("base64url")}`;
    uid = (
      await adminAuth.createUser({
        email,
        password: generatedPassword,
        emailVerified: true,
      })
    ).uid;
    console.log("Created a new auth account.");
  }

  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        uid,
        email,
        role: "admin",
        fullName: email,
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    );

  console.log(`\nPromoted ${email} to admin (uid ${uid}).`);
  if (generatedPassword) {
    console.log(`\nGenerated password: ${generatedPassword}`);
    console.log("Sign in at /login and change it afterwards.");
  }
  console.log("\nThe Review queue is at /admin.\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nFailed:", err?.message ?? err);
    process.exit(1);
  });