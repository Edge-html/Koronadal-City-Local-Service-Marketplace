# Koronadal City Local Service Marketplace

A verified marketplace connecting Koronadal City households with vetted,
accountable blue-collar trade professionals across ten essential service
categories.

Built to the **Complete Platform Specification & Operational Framework**:
non-custodial payment, a 10% commission on labor only, single-tier job-verified
referrals, and a regulatory posture aligned with the Philippine Labor Code,
DOLE guidelines, the Data Privacy Act of 2012 (RA 10173), and the Consumer
Protection Act (RA 7394).

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS v4 with the Rox editorial design system |
| Database | Cloud Firestore |
| Auth | Firebase Authentication (email + password) |
| Hosting | Vercel |

---

## Getting started

```bash
npm install
cp .env.example .env.local     # then paste in your Firebase web config
npm run dev
```

The app is live at <http://localhost:3000>.

### Firebase setup

1. In the [Firebase console](https://console.firebase.google.com), open your
   project and add a **Web app**.
2. Copy the `firebaseConfig` object into `.env.local` using the
   `NEXT_PUBLIC_` names in `.env.example`.
3. Under **Authentication → Sign-in method**, enable **Email/Password**.
   Without this, sign-up returns `auth/operation-not-allowed`.
4. Create a Firestore database, then deploy the security rules:

   ```bash
   npx firebase-tools login
   npx firebase-tools use <your-project-id>
   npx firebase-tools deploy --only firestore:rules
   ```

### Seed demo data

The seed script uses the Firebase **Admin** SDK, which bypasses security rules,
so it needs its own service account key rather than the public web config.

```bash
# 1. Firebase console -> Project settings -> Service accounts
# 2. "Generate new private key", save it as service-account.json in the repo root
# 3. Uncomment in .env.local:
#    FIREBASE_SERVICE_ACCOUNT=./service-account.json

npm run seed            # add demo workers, jobs, reviews
npm run seed -- --wipe  # clear seeded data first
```

This creates 12 workers across all ten trades, 2 households, an administrator,
8 jobs spread across every pipeline stage, matching reviews, and the wallet
ledger entries for each settled job.

> `service-account.json` grants full project access. It is gitignored — never
> commit it.

All demo accounts use the password `koronadal123`:

| Email | Role |
| --- | --- |
| `admin@koronadal.demo` | Administrator |
| `demo.maria@koronadal.demo` | Household (Maria Santos) |
| `demo.jose@koronadal.demo` | Household (Josefa Rivera) |
| `worker.rodrigo@koronadal.demo` | Worker (Rodrigo Abella, carpentry) |
| `worker.jomar@koronadal.demo` | Worker (Jomar Pangandaman, electrical) |
| `worker.cristobal@koronadal.demo` | Worker (pending verification) |

---

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Marketing site: categories, workflow, commission, onboarding, compliance |
| `/browse` | Searchable directory, filterable by trade, barangay, rating, credentials |
| `/worker/[id]` | Public profile, portfolio, reviews, job-request form |
| `/signup`, `/login` | Role-aware auth |
| `/dashboard/customer` | Requests, quote approval, reviews, dispute filing |
| `/dashboard/worker` | Job inbox, quoting, completion, settlement |
| `/dashboard/worker/onboarding` | Three-step digital self-registration |
| `/dashboard/wallet` | Prepaid balance, top-ups, ledger |
| `/dashboard/worker/profile` | Public listing and referral code |
| `/admin` | Credential review queue, disputes, price-floor monitoring |

---

## The transaction lifecycle

Six stages, each a discrete state transition:

| # | Stage | State | What happens |
| --- | --- | --- | --- |
| 1 | Browse & select | — | Filter the directory by category, barangay, rating, verified badges |
| 2 | Request sent | `requested` | SMS alert to the worker plus an in-app notification |
| 3 | Acceptance | `accepted` | **Contact details unlock** — phone, SMS, Messenger |
| 4 | Quote approved | `quoted` → `in_progress` | Two-part quote; approval **locks 10% of labor** against the wallet |
| 5 | Completion | `completed` | Cash/GCash paid direct to worker; commission settles |
| 6 | Review | `reviewed` | Portfolio entry plus a 1–5 star rating and text review |

---

## Money model

The platform is **non-custodial**. Household funds never touch the platform.

```
household ──cash / GCash──▶ worker          (100% of labor + materials)
worker     ──10% of labor──▶ platform       (drawn from prepaid wallet)
platform   ──0% of materials──▶             (pass-through, no commission)
```

On quote approval, 10% of the labor fee is **locked** from the worker's prepaid
balance and settled on completion. If a balance falls below ₱0 the worker is
paused from receiving new requests until they reload. Top-ups arrive through
GCash in-app or 7-Eleven CliQQ terminals.

All arithmetic lives in `src/lib/commission.ts` — `computeTotals` is the single
source of truth used by the UI, the quote form, and the write path.

---

## Design system

The visual language is an editorial broadsheet crossed with a product UI:
a warm newsprint canvas (`#ececea`), hairline borders (`#d4d2d1`), a two-tier
radius hierarchy (12px cards, 6px controls, 4px badges), and **one** saturated
color — Volt Blue `#0b64e9` — reserved exclusively for the primary action.

- **Display serif** (Playfair Display) appears exactly once per page, on the
  hero, at `0.80` line-height for dramatic overlap.
- **UI sans** (Inter) handles nav, buttons, card titles, and data labels.
- **Status badges** are the only place chromatic colors appear, always at
  11px, never as fills or decoration.
- Every section sits on the same warm canvas; no colored section backgrounds.

Tokens live in `src/app/globals.css` under `@theme`.

---

## Data model

```
users/{uid}        role, fullName, email, phone
workers/{id}       profile, credentials, rating, wallet, referralCode
jobs/{id}          consumer ⇄ worker, status, quote{ laborFee, materialsCost }
reviews/{id}       jobId, workerId, rating, text
ledger/{id}        top_up | commission_lock | commission_settle | referral_credit
disputes/{id}      RA 7394 recourse log
```

Reads use at most one equality filter and sort in memory. Firestore requires a
composite index for a `where` + `orderBy` pair across different fields, and a
directory that hard-fails on a missing index is worse than a few milliseconds
of JavaScript.

---

## Compliance notes

- **Data Privacy Act (RA 10173)** — phone numbers are masked on every public
  profile and revealed only after a request is formally accepted.
- **Consumer Protection Act (RA 7394)** — quotes are mandatory two-part
  (labor vs. materials); disputes are logged with the platform.
- **Labor Code / DOLE** — the platform is an intermediary and establishes no
  employer-employee relationship. Workers retain full autonomy.
- **Anti-exploitation** — per-trade price floors are monitored and surfaced in
  the admin console; referrals are single-tier and disburse only after an
  invitee's first job settles; ratings are recomputed from the full review set
  rather than nudged incrementally.

---

## Deploying to Vercel

The repository is connected to Vercel. Add the `NEXT_PUBLIC_FIREBASE_*`
variables under **Project → Settings → Environment Variables** and deploy.

```bash
npm run build
```

---

## Notes for production

This build ships the marketplace logic end to end. A few integrations are
deliberately stubbed at the edges and need wiring before real traffic:

- **SMS alerts** — job requests and quote notifications create Firestore
  records but do not dispatch SMS. Add a provider (Semaphore, Infobip, or an
  SMS gateway) behind a Cloud Function triggered on `jobs` writes.
- **Payments** — GCash and CliQQ top-ups credit the wallet immediately. In
  production, reconcile via provider webhooks before crediting.
- **File uploads** — credentials and job photos accept a URL rather than a
  direct upload. Wire Firebase Storage with signed upload URLs.
- **Admin roles** — `users/{uid}.role` is trusted as written. Gate admin
  routes with Firebase custom claims.