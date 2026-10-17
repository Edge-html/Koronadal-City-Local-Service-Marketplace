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
  writeBatch,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";

/** Resolved per call so an unconfigured environment fails at use, not import. */
const db = getFirebaseDb;

type MarketplaceActionResult = { error?: string; emailSent?: boolean; configured?: boolean; reason?: string | null; recipient?: string };

async function marketplaceAction(payload: Record<string, unknown>): Promise<MarketplaceActionResult> {
  const token = await getFirebaseAuth().currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to continue.");
  const response = await fetch("/api/marketplace", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + token },
    body: JSON.stringify(payload),
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const result = isJson
    ? await response.json().catch(() => null) as MarketplaceActionResult | null
    : null;
  if (!response.ok) {
    throw new Error(result?.error || `The server could not complete this action (HTTP ${response.status}). Please try again.`);
  }
  if (!result) throw new Error("The server returned an unexpected response. Please try again.");
  return result;
}

import { computeTotals, pesos } from "@/lib/commission";
import { makeReferralCode } from "@/lib/utils";
import type {
  Inquiry,
  Job,
  JobStatus,
  LedgerEntry,
  PortfolioEntry,
  Resume,
  Review,
  ServiceOffer,
  VerificationDoc,
  Worker,
} from "@/lib/types";

const workersCol = () => collection(db(), "workers");
const jobsCol = () => collection(db(), "jobs");
const reviewsCol = () => collection(db(), "reviews");
const ledgerCol = () => collection(db(), "ledger");

const byNewest = (a: string, b: string) =>
  new Date(b).getTime() - new Date(a).getTime();

/**
 * Drop undefined values from a payload before it reaches Firestore.
 *
 * Firestore rejects the entire write if any field is undefined ("Unsupported
 * field value: undefined"), and optional inputs are routinely passed as
 * undefined — a blank referral code, an absent phone number. Stripping here
 * means callers do not have to remember to.
 */
function stripUndefined<T extends Record<string, unknown>>(draft: T) {
  return Object.fromEntries(
    Object.entries(draft).filter(([, value]) => value !== undefined),
  ) as { [K in keyof T]: Exclude<T[K], undefined> };
}

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
    photoUrl: data.photoUrl ?? "",
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
    resume: data.resume ?? null,
    skills: Array.isArray(data.skills) ? data.skills : [],
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
  if (snap.empty) return null;
  const worker = toWorker(snap.docs[0].id, snap.docs[0].data());
  const [userSnap, credentialsSnap] = await Promise.all([
    getDoc(doc(db(), "users", uid)),
    getDoc(doc(db(), "workerCredentials", worker.id)),
  ]);
  const privateResume = credentialsSnap.data()?.resumePrivate as Partial<Resume> | undefined;
  return {
    ...worker,
    phone: (userSnap.data()?.phone as string) ?? worker.phone,
    email: (userSnap.data()?.email as string) ?? worker.email,
    verificationDocs: (credentialsSnap.data()?.verificationDocs as VerificationDoc[]) ?? worker.verificationDocs,
    resume: worker.resume && privateResume ? { ...worker.resume, ...privateResume } : worker.resume,
  };
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
  // An empty referral code means "none entered", not "referrer is blank string".
  if (typeof draft.referredBy === "string" && !draft.referredBy.trim()) {
    draft = { ...draft, referredBy: undefined };
  }

  const verificationDocs = draft.verificationDocs;
  const publicDraft = Object.fromEntries(
    Object.entries(draft).filter(([key]) => !["phone", "email", "verificationDocs"].includes(key)),
  );
  const defined = stripUndefined(publicDraft);
  const workerRef = doc(workersCol());
  const batch = writeBatch(db());
  batch.set(workerRef, {
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
  batch.set(doc(db(), "workerCredentials", workerRef.id), {
    uid: draft.uid,
    verificationDocs,
    createdAt: new Date().toISOString(),
  });
  await batch.commit();
  return workerRef.id;
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

/** Save selected skills through the authenticated server so the write remains available when deployed Firestore rules lag behind. */
export async function saveWorkerSkills(workerId: string, skills: string[]) {
  await marketplaceAction({ operation: "updateWorkerSkills", workerId, skills });
}

/**
 * Persist the worker's resume.
 *
 * The parsed text and confirmed fields live on the worker document so they are
 * readable from the public profile. The binary is not stored in Firestore:
 * documents are capped at 1 MB and resumes routinely exceed that. The file
 * URL here is a session-local object URL, so what persists is the reading of
 * the resume rather than the file itself. Wiring Firebase Storage is the
 * follow-up, and the UI says as much rather than implying the file is hosted.
 */
export async function saveResume(workerId: string, resume: Resume) {
  const { rawText, email, phone, fileUrl, ...publicResume } = resume;
  const batch = writeBatch(db());
  batch.update(doc(db(), "workers", workerId), { resume: publicResume });
  batch.update(doc(db(), "workerCredentials", workerId), {
    resumePrivate: { rawText, email: email ?? "", phone: phone ?? "", fileUrl },
  });
  await batch.commit();
}

export async function clearResume(workerId: string) {
  const batch = writeBatch(db());
  batch.update(doc(db(), "workers", workerId), { resume: null });
  batch.update(doc(db(), "workerCredentials", workerId), { resumePrivate: null });
  await batch.commit();
}

/* ------------------------------------------------------------------ */
/* Service offers and inquiries                                         */
/* ------------------------------------------------------------------ */
/*
 * An Offer is work a worker broadcasts to whoever wants it; a Job is one
 * household asking one assigned worker to do something specific. They are
 * separate collections because the audiences differ: offers are discovered by
 * browsing, jobs are addressed.
 *
 * Inquiry counts are NOT denormalised onto the offer document. The obvious
 * shortcut -- a household bumps inquiryCount on the offer as it writes its own
 * inquiry -- does not survive contact with the rules: the household is not the
 * offer's owner, so the offer's update rule correctly rejects its write. It
 * also splits one logical action across two documents, which can half-succeed.
 *
 * Instead a worker's console reads every inquiry addressed to them once and
 * groups by offer in memory. One query, one read of the whole picture, and no
 * counter the client can tamper with.
 */

const offersCol = () => collection(db(), "offers");
const inquiriesCol = () => collection(db(), "inquiries");

function toOffer(id: string, data: DocumentData): ServiceOffer {
  return {
    id,
    workerId: data.workerId ?? "",
    workerUid: data.workerUid ?? "",
    workerName: data.workerName ?? "",
    title: data.title ?? "",
    categoryId: data.categoryId ?? "",
    description: data.description ?? "",
    priceFrom: data.priceFrom ?? 0,
    barangay: data.barangay ?? "",
    status: data.status ?? "open",
    createdAt: data.createdAt ?? "",
  };
}

/** Everything a given worker has posted, newest first. */
export async function listOffersForWorker(workerUid: string) {
  const snap = await getDocs(query(offersCol(), where("workerUid", "==", workerUid)));
  return snap.docs
    .map((d) => toOffer(d.id, d.data()))
    .sort((a, b) => byNewest(a.createdAt, b.createdAt));
}

/** Open offers in one trade, for the public "what is on offer" listing. */
export async function listOpenOffers(categoryId?: string) {
  const snap = await getDocs(query(offersCol(), where("status", "==", "open")));
  return snap.docs
    .map((d) => toOffer(d.id, d.data()))
    .filter((offer) => !categoryId || offer.categoryId === categoryId)
    .sort((a, b) => byNewest(a.createdAt, b.createdAt));
}

/** Public profile view: only open offers can be read by visitors. */
export async function listOpenOffersForWorker(workerUid: string) {
  const offers = await listOpenOffers();
  return offers.filter((offer) => offer.workerUid === workerUid);
}

/** Post work to the marketplace as an offer. */
export async function createOffer(
  worker: Worker,
  input: {
    title: string;
    categoryId: string;
    description: string;
    priceFrom: number;
    barangay: string;
  },
) {
  const ref = await addDoc(offersCol(), stripUndefined({
    workerId: worker.id,
    workerUid: worker.uid,
    workerName: worker.fullName,
    title: input.title.trim(),
    categoryId: input.categoryId,
    description: input.description.trim(),
    priceFrom: input.priceFrom,
    barangay: input.barangay,
    status: "open",
    createdAt: new Date().toISOString(),
  }));
  return ref.id;
}

export async function setOfferStatus(offerId: string, status: "open" | "closed") {
  await updateDoc(doc(db(), "offers", offerId), { status });
}

/**
 * A household responds to an offer.
 *
 * The document id is derived from the offer and the household, which is what
 * makes "one response per household" a property of the write instead of a
 * convention: a second attempt collides on the existing document and is
 * rejected by the rules before it can overwrite the first message.
 */
export async function createInquiry(
  offer: ServiceOffer,
  consumer: { id: string; name: string },
  message: string,
) {
  await setDoc(
    doc(db(), "inquiries", `${offer.id}_${consumer.id}`),
    stripUndefined({
      offerId: offer.id,
      workerId: offer.workerId,
      workerUid: offer.workerUid,
      consumerId: consumer.id,
      consumerName: consumer.name,
      message: message.trim(),
      createdAt: new Date().toISOString(),
    }),
  );
}

/**
 * Every inquiry addressed to this worker, newest first.
 *
 * A single equality filter on workerUid, so it needs no composite index, and
 * the caller groups by offerId.
 */
export async function listInquiriesForWorker(workerUid: string) {
  const snap = await getDocs(query(inquiriesCol(), where("workerUid", "==", workerUid)));
  return snap.docs
    .map((d) => ({ ...(d.data() as Inquiry), id: d.id }))
    .sort((a, b) => byNewest(a.createdAt, b.createdAt));
}
/* ------------------------------------------------------------------ */
/* Jobs — the six-stage lifecycle                                       */
/* ------------------------------------------------------------------ */

export function toJob(id: string, data: DocumentData): Job {
  return {
    id,
    consumerId: data.consumerId ?? "",
    consumerName: data.consumerName ?? "",
    consumerPhotoUrl: data.consumerPhotoUrl ?? "",
    workerId: data.workerId ?? "",
    workerUid: data.workerUid ?? "",
    workerName: data.workerName ?? "",
    workerPhotoUrl: data.workerPhotoUrl ?? "",
    workerPhone: data.workerPhone ?? "",
    consumerPhone: data.consumerPhone ?? "",
    reviewEmailOptIn: data.reviewEmailOptIn === true,
    workerRequestEmailSentAt: data.workerRequestEmailSentAt,
    categoryId: data.categoryId ?? "",
    title: data.title ?? "",
    description: data.description ?? "",
    photoUrl: data.photoUrl ?? "",
    photoPath: data.photoPath ?? "",
    barangay: data.barangay ?? "",
    status: data.status ?? "requested",
    quote: data.quote,
    quoteApprovedAt: data.quoteApprovedAt,
    requestedAt: data.requestedAt ?? "",
    acceptedAt: data.acceptedAt,
    completedAt: data.completedAt,
    settledAt: data.settledAt,
    paymentMethod: data.paymentMethod,
    paymentInstructions: data.paymentInstructions ?? "",
    paymentQrPath: data.paymentQrPath ?? "",
    paymentProofPath: data.paymentProofPath ?? "",
    paymentReference: data.paymentReference ?? "",
    paymentSubmittedAt: data.paymentSubmittedAt,
    paymentApprovedAt: data.paymentApprovedAt,
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

export async function listJobsForWorker(workerUid: string) {
  const snap = await getDocs(query(jobsCol(), where("workerUid", "==", workerUid)));
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
  consumerPhotoUrl?: string;
  reviewEmailOptIn?: boolean;
  worker: Worker;
  categoryId: string;
  title: string;
  description: string;
  photoUrl?: string;
  photoPath?: string;
  barangay: string;
}

/** Stage 1 -> 2. Creates the request and reports whether the worker email was sent. */
export async function createJobRequest(input: NewJob) {
  const ref = await addDoc(jobsCol(), {
    consumerId: input.consumerId,
    consumerName: input.consumerName,
    consumerPhotoUrl: input.consumerPhotoUrl ?? "",
    reviewEmailOptIn: input.reviewEmailOptIn === true,
    workerId: input.worker.id,
    workerUid: input.worker.uid,
    workerName: input.worker.fullName,
    workerPhotoUrl: input.worker.photoUrl ?? "",
    categoryId: input.categoryId,
    title: input.title,
    description: input.description,
    photoUrl: input.photoUrl ?? "",
    photoPath: input.photoPath ?? "",
    barangay: input.barangay,
    status: "requested",
    requestedAt: new Date().toISOString(),
    createdAt: serverTimestamp(),
  });
  try {
    const notification = await marketplaceAction({ operation: "notifyWorkerNewRequest", jobId: ref.id });
    return { id: ref.id, emailSent: notification.emailSent === true };
  } catch (error) {
    // The request is already saved in Firestore and remains visible in-app.
    // A mail provider outage must not make the household think it was lost.
    console.warn("[email] worker request alert could not be sent:", error);
  }
  return { id: ref.id, emailSent: false };
}

export async function checkEmailDiagnostics(sendTest = false) {
  return marketplaceAction({ operation: "emailDiagnostics", sendTest });
}

export async function retryWorkerRequestEmail(jobId: string) {
  return marketplaceAction({ operation: "notifyWorkerNewRequest", jobId });
}

/** Stage 3. Accepting is what unlocks the parties' contact details. */
export async function acceptJob(jobId: string) {
  await marketplaceAction({ operation: "acceptJob", jobId });
}

export async function declineJob(jobId: string, reason: string) {
  await updateDoc(doc(db(), "jobs", jobId), {
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    cancelReason: reason,
  });
  try {
    await marketplaceAction({ operation: "notifyJobStage", jobId, emailStage: "request_declined" });
  } catch (error) {
    console.warn("[email] finder decline alert could not be sent:", error);
  }
}

/** Stage 4. Worker submits the mandatory two-part quote. */
export async function submitQuote(jobId: string, quote: NonNullable<Job["quote"]>) {
  await updateDoc(doc(db(), "jobs", jobId), {
    quote,
    status: "quoted",
    quotedAt: new Date().toISOString(),
  });
  try {
    await marketplaceAction({ operation: "notifyJobStage", jobId, emailStage: "quote_sent" });
  } catch (error) {
    console.warn("[email] finder quote alert could not be sent:", error);
  }
}

/**
 * Stage 4, consumer side. Approval locks 10% of the labor fee against the
 * worker's prepaid balance and moves the job into execution.
 */
export async function approveQuote(job: Job) {
  await marketplaceAction({ operation: "approveQuote", jobId: job.id });
}

/** Stage 5. Worker marks the job complete and records how the finder can pay directly. */
export async function completeJob(jobId: string, payment: {
  method: NonNullable<Job["paymentMethod"]>;
  instructions: string;
  qrPath?: string;
}) {
  await marketplaceAction({ operation: "completeJob", jobId, payment });
}

/**
 * Stage 5 settlement. The locked commission is drawn down.
 *
 * Legacy jobs without finder payment proof can still settle using the earlier
 * flow. New jobs settle only through approveJobPayment after the worker checks
 * the finder’s uploaded proof.
 */
export async function settleJob(job: Job) {
  await marketplaceAction({ operation: "settleJob", jobId: job.id });
}

export async function submitJobPayment(jobId: string, proofPath: string, reference: string) {
  await marketplaceAction({ operation: "submitJobPayment", jobId, proofPath, reference });
}

export async function approveJobPayment(jobId: string) {
  await marketplaceAction({ operation: "approveJobPayment", jobId });
}


/* ------------------------------------------------------------------ */
/* Stage 6 — review & portfolio                                         */
/* ------------------------------------------------------------------ */

export async function submitReview(
  job: Job,
  rating: number,
  text: string,
) {
  await marketplaceAction({ operation: "submitReview", jobId: job.id, rating, text });
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
  reference: string,
  receiptPath: string,
) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    throw new Error("Enter an amount between ₱1 and ₱100,000.");
  }
  if (reference.trim().length < 4) throw new Error("Enter the payment reference.");
  if (!receiptPath.startsWith(`topup-receipts/${worker.uid}/`)) {
    throw new Error("Upload the payment receipt screenshot.");
  }
  await addDoc(collection(db(), "topupRequests"), {
    workerId: worker.id,
    workerUid: worker.uid,
    amount: pesos(amount),
    method,
    reference: reference.trim(),
    receiptPath,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}

export interface TopUpRequest {
  id: string;
  workerId: string;
  workerUid: string;
  amount: number;
  method: "gcash" | "cliqq";
  reference: string;
  receiptPath: string;
  status: "pending" | "approved" | "rejected";
  reviewNote?: string;
  createdAt: string;
}

export interface PaymentSettings {
  gcashAccountName: string;
  gcashNumber: string;
  gcashQrPath: string;
  updatedAt?: string;
}

export async function getPaymentSettings(): Promise<PaymentSettings | null> {
  const snap = await getDoc(doc(db(), "platformSettings", "payments"));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    gcashAccountName: String(data.gcashAccountName ?? ""),
    gcashNumber: String(data.gcashNumber ?? ""),
    gcashQrPath: String(data.gcashQrPath ?? ""),
    updatedAt: data.updatedAt,
  };
}

export async function savePaymentSettings(settings: PaymentSettings) {
  await marketplaceAction({ operation: "savePaymentSettings", paymentSettings: settings });
}

export async function listTopUpRequestsForWorker(workerUid: string): Promise<TopUpRequest[]> {
  const snap = await getDocs(query(collection(db(), "topupRequests"), where("workerUid", "==", workerUid)));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<TopUpRequest, "id">), id: d.id }))
    .sort((a, b) => byNewest(a.createdAt, b.createdAt));
}

export async function listPendingTopUpRequests(): Promise<TopUpRequest[]> {
  const snap = await getDocs(query(collection(db(), "topupRequests"), where("status", "==", "pending")));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<TopUpRequest, "id">), id: d.id }))
    .sort((a, b) => byNewest(a.createdAt, b.createdAt));
}

export async function resubmitCredentials(credentials: VerificationDoc[]) {
  await marketplaceAction({ operation: "resubmitCredentials", credentials });
}

export async function migrateLegacyWorkers() {
  await marketplaceAction({ operation: "migrateLegacyWorkers" });
}

export async function decideTopUp(requestId: string, approve: boolean, reviewNote = "") {
  await marketplaceAction({ operation: approve ? "approveTopUp" : "rejectTopUp", requestId, reviewNote });
}

export async function listLedger(workerUid: string) {
  const snap = await getDocs(query(ledgerCol(), where("workerUid", "==", workerUid)));
  return snap.docs
    .map((d) => ({ ...(d.data() as LedgerEntry), id: d.id }))
    .sort((a, b) => byNewest(a.createdAt as string, b.createdAt as string));
}

/**
 * Ledger entries carry `workerUid` as well as `workerId` so security rules can
 * grant a worker read access to their own history without a cross-document
 * lookup: the Firestore doc is auto-id, and the auth uid is the join key.
 */

/* Admin                                                               */
/* ------------------------------------------------------------------ */

export async function listPendingWorkers() {
  const snap = await getDocs(query(workersCol(), where("status", "==", "pending_verification")));
  const workers = await Promise.all(snap.docs.map(async (row) => {
    const worker = toWorker(row.id, row.data());
    const [credentials, user] = await Promise.all([
      getDoc(doc(db(), "workerCredentials", row.id)),
      getDoc(doc(db(), "users", worker.uid)),
    ]);
    return {
      ...worker,
      verificationDocs: (credentials.data()?.verificationDocs as VerificationDoc[]) ?? worker.verificationDocs,
      phone: (user.data()?.phone as string) ?? worker.phone,
      email: (user.data()?.email as string) ?? worker.email,
    };
  }));
  return workers.sort((a, b) => byNewest(a.createdAt, b.createdAt));
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

  const batch = writeBatch(db());
  batch.update(doc(db(), "workerCredentials", worker.id), { verificationDocs: docs });
  batch.update(doc(db(), "workers", worker.id), {
    verificationNotes: notes,
    verified: approve,
    tesdaCertified:
      approve && worker.verificationDocs.some((d) => d.type === "tesda_certificate"),
    status: approve ? "active" : "suspended",
    reviewedAt: new Date().toISOString(),
  });
  await batch.commit();
  if (approve) {
    try {
      await marketplaceAction({ operation: "notifyWorkerApproval", workerId: worker.id });
    } catch (error) {
      // The credential decision is already saved; an email outage must not
      // make the admin think it failed or cause a duplicate review action.
      console.warn("[email] worker approval alert could not be sent:", error);
    }
  }
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
