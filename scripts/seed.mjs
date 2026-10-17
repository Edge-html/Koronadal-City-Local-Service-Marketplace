/**
 * Seeds Firestore and Firebase Auth with realistic Koronadal City demo data.
 *
 * Uses the Admin SDK, which bypasses security rules, so the script needs a
 * service account key rather than the public web config.
 *
 *   1. Firebase console -> Project settings -> Service accounts
 *   2. Generate new private key, save as `service-account.json` in the repo root
 *   3. Add the path to .env.local: FIREBASE_SERVICE_ACCOUNT=./service-account.json
 *
 * Then:
 *   npm run seed           # add demo data
 *   npm run seed -- --wipe # clear seeded collections first
 */

import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---- Minimal .env.local loader ------------------------------------- */

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
      "Missing Firebase service account key.",
      "",
      `Looked for: ${keyPath}`,
      "",
      "How to fix:",
      "  1. Firebase console -> Project settings -> Service accounts",
      "  2. 'Generate new private key', save it as service-account.json",
      "  3. Add this line to .env.local:",
      "       FIREBASE_SERVICE_ACCOUNT=./service-account.json",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));

const app = initializeApp({ credential: cert(serviceAccount) });
const adminAuth = getAuth(app);
const db = getFirestore(app);

const WIPE = process.argv.includes("--wipe");
const PASSWORD = "koronadal123";

/* ---- Demo data ------------------------------------------------------ */

const WORKERS = [
  {
    key: "rodrigo",
    name: "Rodrigo Abella",
    trade: "carpentry",
    brgy: "San Roque",
    years: 14,
    rate: 520,
    rating: 4.9,
    reviews: 47,
    jobs: 112,
    tesda: true,
    wallet: 4200,
    bio: "Structural woodwork and built-in cabinetry for fifteen years. I take ceiling joister repairs, flush door installation, and full kitchen cabinet runs. Materials itemised separately so you know exactly what you are paying for.",
  },
  {
    key: "marisol",
    name: "Marisol Tiongson",
    trade: "plumbing",
    brgy: "Paraiso",
    years: 9,
    rate: 460,
    rating: 4.8,
    reviews: 39,
    jobs: 96,
    tesda: true,
    wallet: 3850,
    bio: "Leak diagnostics, fixture mounting, and drainage work. Most of my calls are pressurised line leaks and blocked septic connections. I carry my own common fittings, and anything beyond that is itemised before I start.",
  },
  {
    key: "jomar",
    name: "Jomar Pangandaman",
    trade: "electrical",
    brgy: "Magsaysay",
    years: 11,
    rate: 580,
    rating: 4.9,
    reviews: 41,
    jobs: 88,
    tesda: true,
    wallet: 5100,
    bio: "Residential wiring and breaker panel upgrades. I handle short-circuit troubleshooting, tripping main breakers, and outlet network installs in renovated extensions. Permit-ready work with a clean panel at the end.",
  },
  {
    key: "elena",
    name: "Elena Concepcion",
    trade: "roofing",
    brgy: "Santo Niño (Barrio II)",
    years: 18,
    rate: 640,
    rating: 4.7,
    reviews: 28,
    jobs: 74,
    tesda: false,
    wallet: 3400,
    bio: "Corrugated sheet replacement and leak sealing. Monsoon ridge cap work, downspout clearing, and waterproofing coats. I work after rainfall when leaks are still visible so I can find the actual entry point.",
  },
  {
    key: "danilo",
    name: "Danilo Regalado",
    trade: "welding",
    brgy: "Zone III (Poblacion)",
    years: 12,
    rate: 500,
    rating: 4.8,
    reviews: 33,
    jobs: 81,
    tesda: true,
    wallet: 2900,
    bio: "Gate hinges, window security grilles, and structural iron spot repairs. Fabrication and metal frame assembly. On-site welding where the job sits, or bring it to my shop in Ecol.",
  },
  {
    key: "rodel",
    name: "Rodel Magsaysay",
    trade: "painting",
    brgy: "Saravia (Barrio VIII)",
    years: 7,
    rate: 380,
    rating: 4.6,
    reviews: 24,
    jobs: 62,
    tesda: false,
    wallet: 2200,
    bio: "Interior and exterior repainting, surface prep, and anti-rust coating for gates. I quote by surface area after a walkthrough so the number you approve is the number you pay.",
  },
  {
    key: "arnel",
    name: "Arnel Bayot",
    trade: "aircon-appliance",
    brgy: "Avanceña (Barrio III)",
    years: 10,
    rate: 550,
    rating: 4.9,
    reviews: 44,
    jobs: 103,
    tesda: true,
    wallet: 4650,
    bio: "Split-type chemical cleaning and freon recharge, plus refrigerator and washing machine diagnostics. Motor replacements and compressor repairs quoted before any part is ordered.",
  },
  {
    key: "teodoro",
    name: "Teodoro Villanueva",
    trade: "masonry",
    brgy: "Morales",
    years: 20,
    rate: 600,
    rating: 4.7,
    reviews: 31,
    jobs: 69,
    tesda: false,
    wallet: 3100,
    bio: "Block laying, plastering, and tile setting. Concrete cracking repair and perimeter wall work. Twenty years on residential projects across the city.",
  },
  {
    key: "benigno",
    name: "Benigno Uy",
    trade: "mechanical",
    brgy: "Rotonda",
    years: 6,
    rate: 350,
    rating: 4.8,
    reviews: 52,
    jobs: 134,
    tesda: true,
    wallet: 2600,
    bio: "On-site motorcycle and small engine servicing. Carburetor cleaning, oil changes, brake overhaul, and water pump fixes. I go to your house, which is usually faster than towing it anywhere.",
  },
  {
    key: "norberto",
    name: "Norberto Lim",
    trade: "groundskeeping",
    brgy: "San Isidro",
    years: 8,
    rate: 300,
    rating: 4.6,
    reviews: 19,
    jobs: 57,
    tesda: false,
    wallet: 1800,
    bio: "Tree trimming, lawn mowing, and lot clearing. I clear overgrown mango trees near power lines with the proper clearance, and handle brush and perimeter debris.",
  },
  {
    key: "cristobal",
    name: "Cristobal Yap",
    trade: "carpentry",
    brgy: "Carpenter Hill",
    years: 5,
    rate: 440,
    rating: 0,
    reviews: 0,
    jobs: 0,
    tesda: false,
    status: "pending_verification",
    wallet: 0,
    bio: "Furniture repair and door fitting. Recently moved into the city and looking to build a regular client base.",
  },
  {
    key: "alvin",
    name: "Alvin Dimas",
    trade: "electrical",
    brgy: "General Paulino Santos (Barrio I)",
    years: 4,
    rate: 420,
    rating: 0,
    reviews: 0,
    jobs: 0,
    tesda: false,
    status: "pending_verification",
    wallet: 0,
    bio: "Residential lighting installation and outlet repairs. TESDA NC II in electrical installation, certificate pending upload.",
  },
];

const CUSTOMERS = [
  { key: "maria", name: "Maria Santos", brgy: "San Roque" },
  { key: "jose", name: "Josefa Rivera", brgy: "Paraiso" },
];

const REVIEW_TEXT = [
  "Came on time, explained what he found before starting, and the total matched the approved quote exactly.",
  "Very transparent about materials. Explained which parts were still good and which had to go.",
  "Fair price and tidy work. Already booked the next job with him.",
  "Responded to my request within minutes. Work was done the same week.",
  "Recommended them to my neighbour. The before and after difference is obvious.",
  "Handled a problem I had been putting off for two years. No surprises on the bill.",
];

const JOBS = [
  {
    consumer: "maria",
    worker: "rodrigo",
    title: "Repair leaking kitchen cabinet",
    description:
      "Base cabinet under the sink is swollen at the bottom joint. Needs the panel replaced and re-sealed.",
    status: "completed",
    labor: 1800,
    materials: 950,
    rating: 5,
    review: REVIEW_TEXT[0],
    daysAgo: 12,
  },
  {
    consumer: "maria",
    worker: "marisol",
    title: "Replace kitchen faucet and check under-sink line",
    description:
      "Faucet drips constantly and there is dampness under the sink when the tap runs.",
    status: "quoted",
    labor: 1200,
    materials: 1450,
    daysAgo: 2,
  },
  {
    consumer: "jose",
    worker: "jomar",
    title: "Main breaker trips when aircon starts",
    description:
      "The main breaker trips whenever the living room aircon kicks in. Needs diagnosis and probably a panel upgrade.",
    status: "requested",
    daysAgo: 0,
  },
  {
    consumer: "jose",
    worker: "elena",
    title: "Roof leak above the master bedroom",
    description:
      "Water stain on the ceiling after heavy rain. Appears to be along the ridge cap on that side.",
    status: "accepted",
    daysAgo: 1,
  },
  {
    consumer: "maria",
    worker: "arnel",
    title: "Split-type AC chemical cleaning",
    description:
      "Two split-type units, both blowing warm air. Last cleaned about fourteen months ago.",
    status: "in_progress",
    labor: 1600,
    materials: 0,
    daysAgo: 3,
  },
  {
    consumer: "jose",
    worker: "danilo",
    title: "Weld broken gate hinge",
    description:
      "Lower hinge on the main gate snapped. Gate is heavy steel, needs a reinforced weld.",
    status: "completed",
    labor: 1400,
    materials: 350,
    rating: 5,
    review: REVIEW_TEXT[4],
    daysAgo: 20,
  },
  {
    consumer: "maria",
    worker: "benigno",
    title: "Service water pump and replace impeller",
    description:
      "Pump runs but no water comes out. Makes a grinding noise. Used for the laundry area.",
    status: "reviewed",
    labor: 950,
    materials: 1100,
    rating: 5,
    review: REVIEW_TEXT[2],
    daysAgo: 34,
  },
  {
    consumer: "jose",
    worker: "rodel",
    title: "Repaint exterior gate, treat rust first",
    description:
      "Steel gate has surface rust across the lower half. Needs sanding, anti-rust primer, then finish coat.",
    status: "reviewed",
    labor: 3200,
    materials: 1600,
    rating: 4,
    review: REVIEW_TEXT[5],
    daysAgo: 41,
  },
];

/* ---- Helpers ------------------------------------------------------- */

const now = Date.now();
const iso = (daysAgo, hours = 0) =>
  new Date(now - daysAgo * 86400000 - hours * 3600000).toISOString();

/** Unambiguous alphabet, matching makeReferralCode in the app. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function referralCode(seed) {
  let out = "";
  let x = seed;
  for (let i = 0; i < 6; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out += ALPHABET[x % ALPHABET.length];
  }
  return out;
}

const peso = (n) => Math.round(n * 100) / 100;

/**
 * Creates the auth account, or resets the password if it already exists.
 * The role lives on the Firestore user document, which the caller writes.
 */
async function ensureUser(email, fullName) {
  try {
    return (await adminAuth.createUser({
      email,
      password: PASSWORD,
      displayName: fullName,
      emailVerified: true,
    })).uid;
  } catch (err) {
    if (err?.code === "auth/email-already-exists") {
      const existing = await adminAuth.getUserByEmail(email);
      await adminAuth.updateUser(existing.uid, { password: PASSWORD });
      return existing.uid;
    }
    throw err;
  }
}

const COLLECTIONS = [
  "workers",
  "jobs",
  "reviews",
  "ledger",
  "disputes",
  "users",
];

async function wipe(name) {
  // Recursive delete: subcollection deletes cap at 500 documents per batch.
  let deleted = 0;
  const walk = async (docRef) => {
    const snap = await docRef.listCollections();
    for (const sub of snap) await walk(sub.doc());
    const bulk = await docRef.deleteFiles({ batchSize: 400 });
    deleted += bulk.successCount;
  };
  for (const ref of await db.collection(name).listCollections()) await walk(ref);
  const snap = await db.collection(name).limit(400).get();
  for (const doc of snap.docs) await doc.ref.delete();
  deleted += snap.size;
  return deleted;
}

/* ---- Seed ---------------------------------------------------------- */

async function main() {
  console.log(`Seeding project: ${serviceAccount.project_id}\n`);

  if (WIPE) {
    console.log("Wiping existing data...");
    for (const name of COLLECTIONS) {
      const n = await wipe(name);
      console.log(`  cleared ${n} documents from ${name}`);
    }
  }

  // Auth accounts
  const customerUids = {};
  for (const c of CUSTOMERS) {
    const uid = await ensureUser(
      `demo.${c.key}@koronadal.demo`,
      c.name,
    );
    customerUids[c.key] = uid;
    await db.collection("users").doc(uid).set({
      uid,
      fullName: c.name,
      email: `demo.${c.key}@koronadal.demo`,
      phone: `0917${String(1000000 + c.key.length * 3571).slice(0, 7)}`,
      role: "customer",
      createdAt: iso(60),
    });
    console.log(`  customer  ${c.name}`);
  }

  await ensureUser("admin@koronadal.demo", "Platform Administrator");
  console.log("  admin     Platform Administrator");

  const workerIds = {};
  const workerUids = {};
  let seed = 7;

  for (const w of WORKERS) {
    const email = `worker.${w.key}@koronadal.demo`;
    const uid = await ensureUser(email, w.name);
    await db.collection("users").doc(uid).set({
      uid,
      fullName: w.name,
      email,
      phone: "",
      role: "worker",
      createdAt: iso(45),
    });

    const workerRef = db.collection("workers").doc();
    seed += 13;
    const pending = w.status === "pending_verification";

    const docs = [
      ["government_id", "PhilID-front.jpg"],
      ["barangay_clearance", "barangay-clearance.pdf"],
      ["recommendation_letter", "recommendation-letter.pdf"],
    ];
    if (w.tesda || w.key === "alvin") {
      docs.push(["tesda_certificate", "tesda-nc-ii.pdf"]);
    }

    await workerRef.set({
      uid,
      fullName: w.name,
      email,
      phone: `0917${String(1000000 + seed * 7919).slice(0, 7)}`,
      categoryId: w.trade,
      barangay: w.brgy,
      bio: w.bio,
      yearsExperience: w.years,
      hourlyRate: w.rate,
      rating: w.rating,
      reviewCount: w.reviews,
      jobsCompleted: w.jobs,
      verified: !pending,
      tesdaCertified: w.tesda,
      referralCode: referralCode(seed),
      referralCredits: 0,
      walletBalance: w.wallet,
      walletLocked: 0,
      status: w.status ?? "active",
      portfolio: [],
      verificationDocs: docs.map(([type, fileName], i) => ({
        type,
        fileName,
        fileUrl: "",
        uploadedAt: iso(pending ? 1 : 45 - i, i * 3),
        reviewState: pending ? "pending" : "approved",
      })),
      createdAt: iso(45),
    });

    workerIds[w.key] = workerRef.id;
    workerUids[w.key] = uid;
    console.log(
      `  worker    ${w.name} (${pending ? "pending review" : "active"})`,
    );
  }

  // Jobs, quotes, reviews, ledger
  const batch = db.batch();
  let jobCount = 0;
  let reviewCount = 0;
  let ledgerCount = 0;

  for (const j of JOBS) {
    const workerId = workerIds[j.worker];
    if (!workerId) continue;

    const worker = WORKERS.find((w) => w.key === j.worker);
    const consumer = CUSTOMERS.find((c) => c.key === j.consumer);

    const hasQuote = typeof j.labor === "number";
    const commission = hasQuote ? peso(j.labor * 0.1) : 0;
    const settled = ["completed", "reviewed"].includes(j.status);
    const approved = ["in_progress", "completed", "reviewed"].includes(j.status);
    const accepted = [
      "accepted",
      "quoted",
      "in_progress",
      "completed",
      "reviewed",
    ].includes(j.status);

    const jobRef = db.collection("jobs").doc();
    jobCount++;

    batch.set(jobRef, {
      consumerId: customerUids[j.consumer],
      consumerName: consumer.name,
      workerId,
      workerUid: workerUids[j.worker],
      workerName: worker.name,
      categoryId: worker.trade,
      title: j.title,
      description: j.description,
      photoUrl: "",
      barangay: consumer.brgy,
      status: j.status,
      quote: hasQuote
        ? {
            laborFee: j.labor,
            materialsCost: j.materials ?? 0,
            notes:
              "Materials itemised. Anything beyond this scope is quoted separately before work continues.",
            validDays: 7,
          }
        : null,
      quoteApprovedAt: approved ? iso(j.daysAgo - 0.4) : null,
      requestedAt: iso(j.daysAgo),
      acceptedAt: accepted ? iso(j.daysAgo - 0.2) : null,
      completedAt: settled ? iso(j.daysAgo - 1) : null,
      rating: j.rating ?? null,
      reviewText: j.review ?? null,
      createdAt: iso(j.daysAgo),
    });

    if (settled) {
      // Keyed by jobId, matching submitReview in src/lib/data.ts so the
      // one-review-per-job rule holds for seeded data too.
      batch.set(db.collection("reviews").doc(jobRef.id), {
        jobId: jobRef.id,
        workerId,
        consumerId: customerUids[j.consumer],
        consumerName: consumer.name,
        rating: j.rating ?? 5,
        text: j.review ?? REVIEW_TEXT[0],
        createdAt: iso(j.daysAgo - 1, 2),
      });
      reviewCount++;

      // Lock then settle, so the ledger reads like the real lifecycle.
      batch.set(db.collection("ledger").doc(), {
        workerId,
        workerUid: workerUids[j.worker],
        jobId: jobRef.id,
        kind: "commission_lock",
        amount: commission,
        balanceAfter: worker.wallet,
        note: `10% labor commission locked on ${j.title}`,
        createdAt: iso(j.daysAgo - 0.4),
      });
      batch.set(db.collection("ledger").doc(), {
        workerId,
        workerUid: workerUids[j.worker],
        jobId: jobRef.id,
        kind: "commission_settle",
        amount: -commission,
        balanceAfter: worker.wallet,
        note: `Commission settled on ${j.title}`,
        createdAt: iso(j.daysAgo - 1),
      });
      ledgerCount += 2;
    } else if (approved) {
      batch.set(db.collection("ledger").doc(), {
        workerId,
        workerUid: workerUids[j.worker],
        jobId: jobRef.id,
        kind: "commission_lock",
        amount: commission,
        balanceAfter: worker.wallet,
        note: `10% labor commission locked on ${j.title}`,
        createdAt: iso(j.daysAgo - 0.4),
      });
      ledgerCount++;
    }

    // Firestore caps a batch at 500 operations.
    if (jobCount % 100 === 0) {
      await batch.commit();
    }
  }

  await batch.commit();

  console.log(
    `\nSeeded ${jobCount} jobs, ${reviewCount} reviews, ${ledgerCount} ledger entries.\n`,
  );
  console.log(`Demo sign-in credentials — password: ${PASSWORD}`);
  console.log("  admin@koronadal.demo              administrator");
  for (const c of CUSTOMERS) {
    console.log(
      `  demo.${c.key}@koronadal.demo          household (${c.name})`,
    );
  }
  for (const w of WORKERS) {
    console.log(`  worker.${w.key}@koronadal.demo        worker (${w.name})`);
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nSeed failed:", err?.message ?? err);
    process.exit(1);
  });
