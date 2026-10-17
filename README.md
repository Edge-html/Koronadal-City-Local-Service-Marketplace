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
file is hosted. The confirmed summary is public on the worker's profile;
raw extracted text, phone and email stay in the private worker credential record.

Resume images have no text layer, so there is nothing to parse. Workers enter
those fields themselves. Real OCR needs Cloud Vision, which requires putting the
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
| `/dashboard` | Redirects to the role-aware home page or admin review queue |
| `/dashboard/customer` | Requests, quote approval, reviews, dispute filing |
| `/dashboard/worker` | Full lifecycle: job inbox, quoting, completion, settlement |
| `/dashboard/worker/onboarding` | Three-step digital self-registration |
| `/dashboard/worker/credentials` | Replace expired or rejected verification files |
| `/dashboard/wallet` | Prepaid balance, top-ups, ledger |
| `/dashboard/worker/profile` | Public listing, resume editor, referral code |
| `/admin` | Credential review queue, disputes, price-floor monitoring |

---

## The transaction lifecycle

Six stages, each a discrete state transition:

| # | Stage | State | What happens |
| --- | --- | --- | --- |
| 1 | Browse & select | — | Filter the directory by category, barangay, rating, verified badges |
| 2 | Request sent | `requested` | In-app request in the worker dashboard |
| 3 | Acceptance | `accepted` | **Contact details unlock** — phone, SMS, Messenger |
| 4 | Quote approved | `quoted` → `in_progress` | Two-part quote; approval **locks 10% of labor** against the wallet |
| 5 | Completion and payment confirmation | `completed` | Worker sets the direct payment method; finder uploads proof; worker confirms receipt and the reserved commission settles |
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
balance. After work is complete, the finder pays the worker directly and uploads
proof; the worker confirms receipt, which settles the reserved commission. The
platform never collects that job payment. If a balance falls below ₱0 the worker is
paused from receiving new requests until they reload. GCash and CliQQ top-up
requests enter an admin queue and credit the wallet only after payment verification.

All arithmetic lives in `src/lib/commission.ts` — `computeTotals` is the single
source of truth used by the UI, the quote form, and the write path.

---

## Design system

The visual language is an editorial broadsheet crossed with a product UI: a
warm newsprint canvas (`#ececea`), hairline borders (`#d4d2d1`), a two-tier radius
hierarchy (12px cards, 6px controls, 4px badges), and **no color at all** — the
palette is strictly achromatic, so hierarchy is carried by lightness, weight and
texture instead of by hue.

- **Display serif** (Playfair Display) appears exactly once per page, on the
  hero, at `0.80` line-height for dramatic overlap.
- **UI sans** (Inter) handles nav, buttons, card titles, and data labels.
- **The primary action is solid ink** (`--color-char`, `#0c0a09`). It is the
  darkest thing on the page, which is what makes it the primary. This replaced a
  single Volt Blue `#0b64e9`, and is also a contrast win: 19.4:1 against white
  versus 4.6:1 for the blue, which sat on the edge of the WCAG AA floor.
- **Status is encoded by four independent achromatic channels** — fill weight,
  border weight, border style, and texture — giving seven distinguishable badge
  tiers. Read the ladder as descending emphasis: `verified` (solid ink),
  `action` (hatched), `alert` (heavy outline), `active` (soft fill + hairline),
  `new` (dashed outline), then `neutral` and `muted`.

  This is a deliberate improvement, not a compromise. Hue was doing work it
  cannot do reliably: colour-coded status is indistinguishable in greyscale
  print, illegible on a washed-out projector, and inaccessible to the roughly 1
  in 12 men with a colour vision deficiency. A hatch and a dashed rule survive
  all three, so dropping the hues made the status system more robust rather than
  merely plainer.
- The paper cast in the greys (`#ececea`, `#d4d2d1`, …) is kept. Its chroma is
  under 1.2% at 8-bit, so it reads as newsprint rather than as beige, and it is
  what stops the canvas looking like flat `#ededed`. Set the `--color-*` values
  to pure greys if you want literal zero tint.

Tokens live in `src/app/globals.css` under `@theme`. Any new chromatic token
would need a reason that survives greyscale printing.

---

## Data model

```
users/{uid}        role, fullName, email, phone
workers/{id}       public profile, resume summary, rating, wallet, referralCode
workerCredentials/{id} private verification documents and resume details
topupRequests/{id} worker payment references awaiting admin verification
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

### Two role-based home pages

A household and a provider are different jobs, so they open different screens:
households land on the worker finder, while providers land on incoming job
requests. Service offers and inquiries are not shown on the worker home. The
home page
and sign-in redirect use the account's role. Workers can still browse and hire another worker using the
Find a worker link; the view links do not change their role or home page.

The marketing pitch lives at `/landing`, not `/`. Putting a hero on the home
page would mean scrolling past persuasion to reach the thing a returning account
came for. The wordmark links to `/landing` as the brand's front door, and a
signed-out visitor to `/` is redirected there.

## Compliance notes

- **Data Privacy Act (RA 10173)** — new worker records keep phone numbers and
  credentials outside the public directory document. Contact numbers are copied
  to a job only when its assigned worker accepts. Run the admin migration once
  after deployment to remove legacy public fields.
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
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `173000508891` |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:173000508891:web:eab4e1b8b120b70a8693fe` |
   | `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `G-4MF8DRVBVR` |

3. Add `FIREBASE_SERVICE_ACCOUNT_JSON` as a **private** variable containing
   the Firebase service-account JSON (raw JSON or base64 JSON). Apply it to
   Production and to Preview if preview builds need working marketplace actions.
   Never prefix it with `NEXT_PUBLIC_` or commit its value.
4. Redeploy. Environment changes apply only to new builds.
5. Publish the rules with `npx firebase-tools deploy --only firestore:rules`
   from this repository (after `firebase login` and selecting the correct
   project). GitHub/Vercel pushes do not publish Firestore rules.
6. Sign in as an administrator and run **Migrate legacy records** once to move
   existing public contact and credential fields into private documents.
   Older browser blob URLs cannot be recovered; affected workers are placed back
   in the review queue and can upload fresh credentials from their dashboard.

> The `NEXT_PUBLIC_FIREBASE_*` values are Firebase **client** keys. They are
> designed to be public; access is governed by `firestore.rules`. Keep the
> service account key only in the private `FIREBASE_SERVICE_ACCOUNT_JSON`
> environment variable, and never commit it or expose it with `NEXT_PUBLIC_`.

### Private file uploads (Supabase Storage)

Firebase remains responsible for accounts, roles, and marketplace records.
Receipt screenshots for worker top-ups and finder-to-worker job payments,
payment QR images, profile photos, and worker credential files are stored in a
**private** Supabase Storage bucket named `private-files`. Profile photos are
served through a narrow public image route; credentials and payment proofs
remain restricted to the job parties or administrators who need them.

1. Create a Supabase project and a private bucket named `private-files`.
2. Limit the bucket to 4 MB per file. Allow `image/jpeg`, `image/png`,
   `image/webp`, and `application/pdf`.
3. In Vercel, add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` for Production,
   Preview, and Development. Find both in Supabase Project Settings → API.
   The secret key stays server-side; never prefix it with `NEXT_PUBLIC_` or put
   it in browser code.
4. Redeploy Vercel. The server verifies Firebase sign-in and role before it
   reads or writes files, so keep the bucket private.

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
| Approve fails and the worker insists they funded it | Worker underfunded the commission lock | See "Why a quote can be un-approvable" below |

The rules in this repo must be published for the app to work. A GitHub push
does not update them; use the Firebase CLI command above or publish the file
in Firebase Console → Firestore Database → Rules.

### Why a quote can be un-approvable

The platform locks 10% of the labor fee out of the worker's **prepaid wallet**
at the moment a household approves. Materials are exempt. If the worker's
unlocked balance cannot cover that commission, `approveQuote` refuses and the
job cannot start.

That creates a trap, because the symptom looks like a bug and is not one:

- A worker with an empty wallet could quote work they could never fund. The
  household would click Approve and be told the problem was the worker's
  balance — something they cannot fix, top up, or usefully report.
- The worker had no way to know in advance. The quote form checked the price
  *floor* but never the worker's *coverage*.

Both are closed now:

- **The quote form blocks it.** It computes the commission on the labor fee as
  you type, compares it against unlocked headroom, refuses to enable the
  button, and names the exact shortfall with a link to the wallet.
- **The rules refuse it too.** The `accepted -> quoted` transition calls
  `workerCanCoverLabor()`, so an un-coverable quote cannot be written even from
  the console. A client check is a guardrail; this is the guarantee.
- **The household is told what to do.** `approveQuote` returns a message about
  contacting the worker, not a readout of somebody else's wallet ledger.
  `MarketplaceError` in `src/app/api/marketplace/route.ts` marks messages safe
  to show a caller; anything else is logged server-side and replaced with a
  generic message, so an SDK error cannot leak the project id or a missing
  secret into a response body.

`commissionFor()` in the rules carries a one-cent tolerance, and it is
load-bearing. The app rounds the locked commission to two decimals while the
rule compares the raw product, and rounding goes *down* for over 1.2 million of
the possible two-decimal labor fees — a worker holding exactly what they were
quoted would otherwise be denied their own quote. `npm test` covers this, and
pins the invariant that actually matters: the client must never be *more*
lenient than the rules, or a worker would pass the form's check and get a bare
permission-denied on submit.

The remaining race is legitimate: two quotes competing for the same funds, with
the second worker topping up in between. That surfaces as the household
message, and the worker sees the shortfall on their own quote.

---

## Notes for production

This build ships the marketplace logic end to end. A few integrations are
deliberately stubbed at the edges and need wiring before real traffic:

- **SMS alerts** — job requests and quote notifications create Firestore
  records but do not dispatch SMS. Add a provider (Semaphore, Infobip, or an
  SMS gateway) behind a Cloud Function triggered on `jobs` writes.
- **Payments** — workers submit a reference and an administrator independently
  verifies it before crediting. Provider webhooks remain future work.
- **File uploads** — verification documents upload to private Firebase Storage
  through an authenticated server route. Job photos still use a URL and need a
  proper upload path.
- **Admin roles** — `users/{uid}.role` is trusted as written. Gate admin
  routes with Firebase custom claims.
