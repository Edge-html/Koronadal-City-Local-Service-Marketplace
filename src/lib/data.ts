/**
 * Firestore data access.
 *
 * The spec keeps this platform deliberately narrow: a household posts a job,
 * a worker quotes, money moves directly between the two parties, and the
 * platform books a 10% labor commission against the worker's prepaid wallet.
 * Every write below encodes one step of that lifecycle.
 *
 * Query note: every read here uses at most one equality filter and sorts in
 * memory. Firestore demands a composite index for a `where` + `orderBy` pair
 * across different fields, and a directory that hard-fails on a missing index
 * is a far worse outcome than a few milliseconds of JavaScript.
 */

import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

/** Resolved per call so an unconfigured environment fails at use, not import. */
const db = getFirebaseDb;
import { commissionOn, computeTotals, pesos } from "@/lib/commission";
import { makeReferralCode } from "@/lib/utils";
import type {
  Job,
  JobStatus,
  LedgerEntry,
  PortfolioEntry,
  Review,
  VerificationDoc,
  Worker,
} from "@/lib/types";

const workersCol = () => collection(db(), "workers");
const jobsCol = () => collection(db(), "jobs");
const reviewsCol = () => collection(db(), "reviews");
const ledgerCol = () => collection(db(), "ledger");

const byNewest = (a: string, b: string) =>
  new Date(b).getTime() - new Date(a).getTime();

/* ------------------------------------------------------------------ */
/* Workers                                                             */
/* ------------------------------------------------------------------ */

function toWorker(id: string, data: DocumentData): Worker {
  return {
    id,
    uid: data.uid ?? "",
    fullName: data.fullName ?? "",
    phone: data.phone ?? "",
    email: data.email ?? "",
    categoryId: data.categoryId ?? "",
    barangay: data.barangay ?? "",
    bio: data.bio ?? "",
    yearsExperience: data.yearsExperience ?? 0,
    rating: data.rating ?? 0,
    reviewCount: data.reviewCount ?? 0,
    jobsCompleted: data.jobsCompleted ?? 0,
    verified: data.verified ?? false,
    tesdaCertified: data.tesdaCertified ?? false,
    referralCode: data.referralCode ?? "",
    referralCredits: data.referralCredits ?? 0,
    walletBalance: data.walletBalance ?? 0,
    walletLocked: data.walletLocked ?? 0,
    status: data.status ?? "pending_verification",
    hourlyRate: data.hourlyRate ?? 0,
    referredBy: data.referredBy,
    portfolio: data.portfolio ?? [],
    verificationDocs: data.verificationDocs ?? [],
    createdAt: data.createdAt ?? "",
  };
}

export async function listWorkers(constraints: QueryConstraint[] = []) {
  const snap = await getDocs(query(workersCol(), ...constraints));
  return snap.docs.map((d) => toWorker(d.id, d.data()));
}

/**
 * Public directory: verified and active, best rated first.
 *
 * Workers whose prepaid balance has gone negative are held in `paused_wallet`
 * rather than removed, so they drop out of the directory until they reload
 * without losing their history or rating.
 */
export async function listDirectoryWorkers() {
  const snap = await getDocs(query(workersCol(), where("verified", "==", true)));
  return snap.docs
    .map((d) => toWorker(d.id, d.data()))
    .filter((w) => w.status === "active")
    .sort((a, b) => b.rating - a.rating || b.jobsCompleted - a.jobsCompleted);
}

export async function getWorker(id: string): Promise<Worker | null> {
  const snap = await getDoc(doc(db(), "workers", id));
  return snap.exists() ? toWorker(id, snap.data()) : null;
}

export async function getWorkerByUid(uid: string): Promise<Worker | null> {
  const snap = await getDocs(query(workersCol(), where("uid", "==", uid), limit(1)));
  return snap.empty ? null : toWorker(snap.docs[0].id, snap.docs[0].data());
}

export interface WorkerDraft {
  uid: string;
  fullName: string;
  phone: string;
  email: string;
  categoryId: string;
  barangay: string;
  bio: string;
  yearsExperience: number;
  hourlyRate: number;
  verificationDocs: VerificationDoc[];
  tesdaCertified: boolean;
  referredBy?: string;
}

/** Creates the worker profile at the end of the 3-step self-registration. */
export async function createWorkerProfile(draft: WorkerDraft) {
  /**
   * Firestore rejects the whole write if any field is undefined
   * ("Unsupported field value: undefined"), and optional inputs are routinely
   * passed as undefined - a blank referral code, an absent phone number.
   * Strip them rather than requiring every caller to remember.
   */
  // An empty referral code means "none entered", not "referrer is blank string".
  if (typeof draft.referredBy === "string" && !draft.referredBy.trim()) {
    draft = { ...draft, referredBy: undefined };
  }

  const defined = Object.fromEntries(
    Object.entries(draft).filter(([, value]) => value !== undefined),
  );

  const ref = await addDoc(workersCol(), {
    ...defined,
    rating: 0,
    reviewCount: 0,
    jobsCompleted: 0,
    verified: false,
    referralCode: makeReferralCode(),
    referralCredits: 0,
    walletBalance: 0,
    walletLocked: 0,
    status: "pending_verification",
    portfolio: [],
    createdAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Patch a worker document.
 *
 * Undefined fields are dropped rather than sent, because Firestore rejects a
 * write that contains one. To actually clear a value, pass deleteField().
 */
export async function updateWorker(
  id: string,
  patch: Partial<Worker> & Record<string, unknown>,
) {
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );
  await updateDoc(doc(db(), "workers", id), {
    ...defined,
    updatedAt: serverTimestamp(),
  });
}

/* ------------------------------------------------------------------ */
/* Jobs — the six-stage lifecycle                                       */
/* ------------------------------------------------------------------ */

function toJob(id: string, data: DocumentData): Job {
  return {
    id,
    consumerId: data.consumerId ?? "",
    consumerName: data.consumerName ?? "",
    workerId: data.workerId ?? "",
    workerUid: data.workerUid ?? "",
    workerName: data.workerName ?? "",
    categoryId: data.categoryId ?? "",
    title: data.title ?? "",
    description: data.description ?? "",
    photoUrl: data.photoUrl ?? "",
    barangay: data.barangay ?? "",
    status: data.status ?? "requested",
    quote: data.quote,
    quoteApprovedAt: data.quoteApprovedAt,
    requestedAt: data.requestedAt ?? "",
    acceptedAt: data.acceptedAt,
    completedAt: data.completedAt,
    rating: data.rating,
    reviewText: data.reviewText,
  };
}

export async function listJobs(constraints: QueryConstraint[] = []) {
  const snap = await getDocs(query(jobsCol(), ...constraints));
  return snap.docs
    .map((d) => toJob(d.id, d.data()))
    .sort((a, b) => byNewest(a.requestedAt, b.requestedAt));
}

export async function listConsumerJobs(uid: string) {
  const snap = await getDocs(query(jobsCol(), where("consumerId", "==", uid)));
  return snap.docs
    .map((d) => toJob(d.id, d.data()))
    .sort((a, b) => byNewest(a.requestedAt, b.requestedAt));
}

export async function listJobsForWorker(workerId: string) {
  const snap = await getDocs(query(jobsCol(), where("workerId", "==", workerId)));
  return snap.docs
    .map((d) => toJob(d.id, d.data()))
    .sort((a, b) => byNewest(a.requestedAt, b.requestedAt));
}

export async function getJob(id: string): Promise<Job | null> {
  const snap = await getDoc(doc(db(), "jobs", id));
  return snap.exists() ? toJob(id, snap.data()) : null;
}

export interface NewJob {
  consumerId: string;
  consumerName: string;
  worker: Worker;
  categoryId: string;
  title: string;
  description: string;
  photoUrl?: string;
  barangay: string;
}

/** Stage 1 -> 2. Fires an SMS alert to the worker alongside the in-app record. */
export async function createJobRequest(input: NewJob) {
  const ref = await addDoc(jobsCol(), {
    consumerId: input.consumerId,
    consumerName: input.consumerName,
    workerId: input.worker.id,
    workerUid: input.worker.uid,
    workerName: input.worker.fullName,
    categoryId: input.categoryId,
    title: input.title,
    description: input.description,
    photoUrl: input.photoUrl ?? "",
    barangay: input.barangay,
    status: "requested",
    requestedAt: new Date().toISOString(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Stage 3. Accepting is what unlocks the parties' contact details. */
export async function acceptJob(jobId: string, worker: Worker) {
  await updateDoc(doc(db(), "jobs", jobId), {
    status: "accepted",
    acceptedAt: new Date().toISOString(),
  });
  await releasePausedIfCleared(worker);
}

export async function declineJob(jobId: string, reason: string) {
  await updateDoc(doc(db(), "jobs", jobId), {
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    cancelReason: reason,
  });
}

/** Stage 4. Worker submits the mandatory two-part quote. */
export async function submitQuote(jobId: string, quote: NonNullable<Job["quote"]>) {
  await updateDoc(doc(db(), "jobs", jobId), {
    quote,
    status: "quoted",
    quotedAt: new Date().toISOString(),
  });
}

/**
 * Stage 4, consumer side. Approval locks 10% of the labor fee against the
 * worker's prepaid balance and moves the job into execution.
 */
export async function approveQuote(job: Job, worker: Worker) {
  if (!job.quote) throw new Error("Cannot approve a job with no quote.");

  const commission = commissionOn(job.quote.laborFee);
  const nextBalance = pesos(worker.walletBalance + commission);
  const nextLocked = pesos(worker.walletLocked + commission);

  await updateDoc(doc(db(), "jobs", job.id), {
    status: "in_progress",
    quoteApprovedAt: new Date().toISOString(),
  });

  await updateDoc(doc(db(), "workers", worker.id), {
    walletBalance: nextBalance,
    walletLocked: nextLocked,
  });

  await writeLedger({
    workerId: worker.id,
    workerUid: worker.uid,
    jobId: job.id,
    kind: "commission_lock",
    amount: commission,
    balanceAfter: nextBalance,
    note: `10% labor commission locked on ${job.title}`,
  });
}

/** Stage 5. Worker marks the job complete. */
export async function completeJob(jobId: string) {
  await updateDoc(doc(db(), "jobs", jobId), {
    status: "completed",
    completedAt: new Date().toISOString(),
  });
}

/**
 * Stage 5 settlement. The locked commission is drawn down.
 *
 * The household's cash or GCash transfer to the worker already happened
 * outside the platform, so nothing further moves here — this only books the
 * commission against the prepaid balance and counters the job.
 */
export async function settleJob(job: Job, worker: Worker) {
  if (!job.quote) throw new Error("Cannot settle a job with no quote.");

  const commission = commissionOn(job.quote.laborFee);
  const nextBalance = pesos(worker.walletBalance - commission);
  const nextLocked = pesos(Math.max(0, worker.walletLocked - commission));
  const breached = nextBalance < 0;

  await updateDoc(doc(db(), "workers", worker.id), {
    walletBalance: nextBalance,
    walletLocked: nextLocked,
    jobsCompleted: (worker.jobsCompleted ?? 0) + 1,
    // A negative balance pauses the worker from receiving new requests.
    status: breached ? "paused_wallet" : worker.status,
  });

  await writeLedger({
    workerId: worker.id,
    workerUid: worker.uid,
    jobId: job.id,
    kind: "commission_settle",
    amount: -commission,
    balanceAfter: nextBalance,
    note: `Commission settled on ${job.title}`,
  });

  // Referral credits clear only on a completed, paid first job.
  await maybeAwardReferral(worker, job);
}

async function releasePausedIfCleared(worker: Worker) {
  if (worker.status === "paused_wallet" && worker.walletBalance >= 0) {
    await updateDoc(doc(db(), "workers", worker.id), { status: "active" });
  }
}

/* ------------------------------------------------------------------ */
/* Stage 6 — review & portfolio                                         */
/* ------------------------------------------------------------------ */

export async function submitReview(
  job: Job,
  worker: Worker,
  rating: number,
  text: string,
) {
  // Keyed by jobId rather than auto-id: this is what lets the security rules
  // enforce one review per job with a plain exists() probe, and it makes a
  // duplicate submission fail loudly instead of silently double-rating.
  await setDoc(doc(db(), "reviews", job.id), {
    jobId: job.id,
    workerId: worker.id,
    consumerId: job.consumerId,
    consumerName: job.consumerName,
    rating,
    text,
    createdAt: new Date().toISOString(),
  });

  await updateDoc(doc(db(), "jobs", job.id), {
    status: "reviewed",
    rating,
    reviewText: text,
  });

  // Recompute from the full set rather than nudging a running average, so a
  // removed or flagged review cannot leave the score drifting (RA 7394).
  const snap = await getDocs(query(reviewsCol(), where("workerId", "==", worker.id)));
  const rows = snap.docs.map((d) => d.data());
  const total = rows.reduce((sum, r) => sum + (r.rating ?? 0), 0);
  const count = rows.length;

  await updateDoc(doc(db(), "workers", worker.id), {
    rating: count ? pesos(total / count) : 0,
    reviewCount: count,
  });
}

export async function addPortfolioEntry(
  workerId: string,
  entry: PortfolioEntry,
) {
  await updateDoc(doc(db(), "workers", workerId), {
    portfolio: arrayUnion(entry),
  });
}

export async function listReviews(workerId: string) {
  const snap = await getDocs(query(reviewsCol(), where("workerId", "==", workerId)));
  return snap.docs
    .map((d) => ({ ...(d.data() as Review), id: d.id }))
    .sort((a, b) => byNewest(a.createdAt as string, b.createdAt as string));
}

/* ------------------------------------------------------------------ */
/* Wallet & ledger                                                      */
/* ------------------------------------------------------------------ */

export async function topUpWallet(
  worker: Worker,
  amount: number,
  method: "gcash" | "cliqq",
) {
  const nextBalance = pesos(worker.walletBalance + amount);

  await updateDoc(doc(db(), "workers", worker.id), {
    walletBalance: nextBalance,
    // A top-up clears a breach and returns the worker to the active pool.
    status: worker.status === "paused_wallet" ? "active" : worker.status,
  });

  await writeLedger({
    workerId: worker.id,
    workerUid: worker.uid,
    kind: "top_up",
    amount,
    balanceAfter: nextBalance,
    method,
    note: method === "gcash" ? "GCash in-app top-up" : "7-Eleven CliQQ deposit",
  });
}

export async function listLedger(workerId: string) {
  const snap = await getDocs(query(ledgerCol(), where("workerId", "==", workerId)));
  return snap.docs
    .map((d) => ({ ...(d.data() as LedgerEntry), id: d.id }))
    .sort((a, b) => byNewest(a.createdAt as string, b.createdAt as string));
}

/**
 * Ledger entries carry `workerUid` as well as `workerId` so security rules can
 * grant a worker read access to their own history without a cross-document
 * lookup: the Firestore doc is auto-id, and the auth uid is the join key.
 */
async function writeLedger(
  entry: Omit<LedgerEntry, "id" | "createdAt" | "workerUid"> & {
    workerUid: string;
  },
) {
  await addDoc(ledgerCol(), {
    ...entry,
    createdAt: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------ */
/* Referrals                                                            */
/* ------------------------------------------------------------------ */

/**
 * Credits disburse only once the invitee's first job has been settled, which
 * is what keeps the program single-tier and job-verified.
 */
async function maybeAwardReferral(worker: Worker, job: Job) {
  if ((worker.jobsCompleted ?? 0) + 1 !== 1) return; // not their first job
  if (!worker.referredBy) return;

  const inviterSnap = await getDocs(
    query(workersCol(), where("referralCode", "==", worker.referredBy), limit(1)),
  );
  if (inviterSnap.empty) return;

  const inviterDoc = inviterSnap.docs[0];
  const inviter = toWorker(inviterDoc.id, inviterDoc.data());
  const nextCredits = (inviter.referralCredits ?? 0) + 1;

  await updateDoc(inviterDoc.ref, { referralCredits: nextCredits });
  await writeLedger({
    workerId: inviter.id,
    workerUid: inviter.uid,
    jobId: job.id,
    kind: "referral_credit",
    amount: 1,
    balanceAfter: nextCredits,
    note: `Referral credit: ${worker.fullName} completed their first job`,
  });
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export async function listPendingWorkers() {
  const snap = await getDocs(query(workersCol(), where("status", "==", "pending_verification")));
  return snap.docs
    .map((d) => toWorker(d.id, d.data()))
    .sort((a, b) => byNewest(a.createdAt, b.createdAt));
}

/** Admin decision on the three mandatory credentials. */
export async function decideVerification(
  worker: Worker,
  approve: boolean,
  notes: string,
) {
  const docs = worker.verificationDocs.map((d) => ({
    ...d,
    reviewState: approve ? ("approved" as const) : ("rejected" as const),
  }));

  await updateDoc(doc(db(), "workers", worker.id), {
    verificationDocs: docs,
    verificationNotes: notes,
    verified: approve,
    tesdaCertified:
      approve && worker.verificationDocs.some((d) => d.type === "tesda_certificate"),
    status: approve ? "active" : "suspended",
    reviewedAt: new Date().toISOString(),
  });
}

export async function listAllJobs(max = 200) {
  const snap = await getDocs(query(jobsCol(), limit(max)));
  return snap.docs
    .map((d) => toJob(d.id, d.data()))
    .sort((a, b) => byNewest(a.requestedAt, b.requestedAt));
}

/** Built-in dispute logging, required by RA 7394 recourse obligations. */
export async function logDispute(job: Job, reason: string, raisedBy: string) {
  await addDoc(collection(db(), "disputes"), {
    jobId: job.id,
    workerId: job.workerId,
    workerUid: job.workerUid,
    consumerId: job.consumerId,
    consumerName: job.consumerName,
    workerName: job.workerName,
    quote: job.quote ?? null,
    reason,
    raisedBy,
    status: "open",
    createdAt: new Date().toISOString(),
  });
  await updateDoc(doc(db(), "jobs", job.id), { status: "disputed" });
}

/* ------------------------------------------------------------------ */
/* Reporting helpers                                                    */
/* ------------------------------------------------------------------ */

export function quoteSummary(job: Job) {
  if (!job.quote) return null;
  return computeTotals(job.quote.laborFee, job.quote.materialsCost);
}

export const nextStatusLabel: Record<JobStatus, string> = {
  requested: "Accept request",
  accepted: "Submit quote",
  quoted: "Awaiting approval",
  in_progress: "Mark complete",
  completed: "Settle commission",
  reviewed: "Closed",
  cancelled: "Closed",
  disputed: "Under review",
};