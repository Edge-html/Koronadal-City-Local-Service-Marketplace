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

### Resumes

Workers upload a PDF or image from the worker console or their profile
settings. PDFs are parsed in the browser with `pdf.js`: the text layer is read
out and heuristics pull a name, mobile number, email, skills, years of
experience and mentioned credentials into editable fields. The worker confirms
or corrects each field before anything is saved, and a "what was read from the
file" panel lets them audit the extraction rather than trust it.

Parsed skills map onto the marketplace categories, so a resume mentioning
plumbing and tiling suggests the right service category automatically.

What is persisted is the *reading* of the resume, not the file. The binary is
not uploaded: Firestore documents cap at 1 MB and resumes exceed that, and
Firebase Storage is not yet wired up. The UI says so rather than implying the
file is hosted. The parsed summary is public on the worker's profile, which is
what households actually read when deciding whom to book.

Images have no text layer, so there is nothing to parse. They upload with the
fields typed in. Real OCR needs Cloud Vision, which requires putting the
Firebase project on a billing plan.

The `pdf.js` worker is copied into `public/` by `scripts/copy-pdf-worker.mjs`
on `postinstall` and served from this origin, so resume parsing does not
depend on a CDN being reachable.
### Promote an account to admin

Admin is the platform-wide override that unlocks every Firestore collection,
so it can never be self-assigned from the client; the rules permit only
`customer -> worker`. The intended way to grant it is the Admin SDK:

```bash
npm run make-admin -- you@example.com            # promote an existing account
npm run make-admin -- you@example.com --create   # create it if missing
```

This writes `role: 'admin'` to `users/{uid}`. Sign in and open **/admin** for the
credential review queue. With `--create`, a random password is generated and
printed once.

Use this instead of re-running `npm run seed` when you want admin access
without wiping the demo data.

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

`/` is the working home; `/landing` is the pitch. They are separate on purpose —
see "Two consoles" below.

| Route | Purpose |
| --- | --- |
| `/` | Working home. Households: the ten trades, then the directory. Providers: requests waiting on them, then the work they have on offer. A signed-out visitor is sent to `/landing`. |
| `/landing` | Marketing: hero, trust bar, categories, how-it-works, closing CTA |
| `/browse` | Full directory — filter by trade, barangay, rating, credentials |
| `/worker/[id]` | Public profile: resume, services on offer, portfolio, reviews, request form |
| `/signup`, `/login` | Role-aware auth |
| `/dashboard` | Redirects to the right console for the account's mode |
| `/dashboard/customer` | Requests, quote approval, reviews, dispute filing |
| `/dashboard/worker` | Full lifecycle: job inbox, quoting, completion, settlement |
| `/dashboard/worker/onboarding` | Three-step digital self-registration |
| `/dashboard/wallet` | Prepaid balance, top-ups, ledger |
| `/dashboard/worker/profile` | Public listing, resume editor, referral code |
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
users/{uid}        role, activeMode, fullName, email, phone
workers/{id}       profile, credentials, resume, rating, wallet, referralCode
offers/{id}        workerId, workerUid, title, categoryId, priceFrom, status
inquiries/{id}     id = "{offerId}_{consumerId}", offerId, workerUid, consumerId, message
jobs/{id}          consumer ⇄ worker, status, quote{ laborFee, materialsCost }
reviews/{id}       jobId, workerId, rating, text
ledger/{id}        top_up | commission_lock | commission_settle | referral_credit
disputes/{id}      RA 7394 recourse log
```

An **offer** is work a worker broadcasts to whoever wants it. A **job** is one
household asking one assigned worker for something specific. They are separate
collections because their audiences differ: offers are discovered by browsing,
jobs are addressed.

Three details in that model are load-bearing:

- **Inquiry counts are derived, not stored.** The obvious shortcut — a household
  bumps a counter on the offer as it writes its own inquiry — does not survive
  contact with the rules: the household is not the offer's owner, so the offer's
  update rule correctly rejects the write. It also splits one action across two
  documents, which can half-succeed. Instead the worker's console reads every
  inquiry addressed to them once and groups by offer in memory.
- **Inquiry document ids are deterministic** (`{offerId}_{consumerId}`). That
  makes "one response per household" a property of the write rather than a
  convention — a second attempt collides and is rejected. With an auto-generated
  id there is no field holding the id, so a rule has nothing to check.
- **Inquiries denormalise `workerUid`.** Reading ownership off the document
  avoids a `get()` on the hot path, which is the same circular-read shape that
  broke the job rules earlier.

Reads use at most one equality filter and sort in memory. Firestore requires a
composite index for a `where` + `orderBy` pair across different fields, and a
directory that hard-fails on a missing index is worse than a few milliseconds
of JavaScript.

---

### Two consoles, switchable

A household and a provider are different jobs, so they open different screens:
households land on the trades and then the directory, providers land on their
incoming requests and then the work they have on offer. Neither is exclusive. A
plumber can hire an electrician, and a household can decide to start offering
services, so the mode switcher changes which console an account opens on rather
than granting or removing capability. The choice is stored as `activeMode` on
the user document and defaults by role.

The marketing pitch lives at `/landing`, not `/`. Putting a hero on the home
page would mean scrolling past persuasion to reach the thing a returning account
came for. The wordmark links to `/landing` as the brand's front door, and a
signed-out visitor to `/` is redirected there.

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

The repository is connected to Vercel.

1. **Project → Settings → Environment Variables**
2. Add each variable below for **all three** environments (Production,
   Preview, Development). Ticking only "Production" is the usual cause of a
   build that succeeds locally and fails in CI.

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyBG1wcxGu6blff0neiewvqWraKQzOssJdU` |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `cycu-trip-planner.firebaseapp.com` |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `cycu-trip-planner` |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `cycu-trip-planner.firebasestorage.app` |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `173000508891` |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:173000508891:web:eab4e1b8b120b70a8693fe` |
   | `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `G-4MF8DRVBVR` |

3. Redeploy — **Deployments → ⋯ → Redeploy**. Environment changes only apply
   to new builds, so an existing failed build will not self-heal.

> These are Firebase **client** keys. They are designed to be public and are
> already in `.env.local`; access is governed by `firestore.rules`, not by
> keeping them secret. Never put a service account key in Vercel.

### If the build fails with `auth/invalid-api-key`

Firebase is initialized lazily, so a missing variable no longer takes the build
down. Instead the deployment renders a **Preview mode** banner and a panel
listing the exact keys to set, rather than a blank page. If the build itself
still fails, check that every variable is scoped to the environment you are
deploying.

### Post-deploy checklist

The app degrades gracefully when Firebase is absent, so a green build is not
the same as a working marketplace. Work through these in order:

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Preview mode" banner | `NEXT_PUBLIC_FIREBASE_*` unset | Add in Vercel, redeploy |
| "Directory not readable" | Firestore rules not deployed | `npx firebase-tools deploy --only firestore:rules` |
| "Offers are not readable…" on a worker profile | Rules predate the `offers` / `inquiries` collections | Publish `firestore.rules` from this repo — the offers section hides itself otherwise |
| "My services" empty with a permissions error | Same as above | Publish `firestore.rules` |
| "No workers listed yet" | Database genuinely empty | `npm run seed` (needs a service account key) |
| Sign-up `operation-not-allowed` | Email/Password provider disabled | Firebase console -> Authentication -> Sign-in method |
| Stuck on "Checking your account" | Firebase Auth never settled | Should self-resolve after 8s; check the console for a `[auth] session check did not settle` warning |

The rules in this repo must be published for the app to work, and the deployed
copy is not updated by a push — pasting the file into Firebase console ->
Firestore Database -> Rules and hitting Publish is the only step that changes
it.

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
