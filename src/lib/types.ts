/**
 * Domain model for the Koronadal City Local Service Marketplace.
 * Mirrors the six-stage transaction lifecycle defined in the platform
 * specification.
 */

export type Role = "customer" | "worker" | "admin";
/**
 * Which console a dual-role account opens by default.
 * A worker can still hire services, so the two views are switchable rather
 * than exclusive.
 */

export type WorkerStatus =
  | "pending_verification"
  | "active"
  | "paused_wallet"
  | "suspended";

/** The six-stage booking lifecycle from the specification. */
export type JobStatus =
  | "requested" // Step 2 — request sent to the worker dashboard
  | "accepted" // Step 3 — contact channels unlocked
  | "quoted" // Step 4 — official quote awaiting approval
  | "in_progress" // Step 5 — execution underway
  | "completed" // Step 5 — settled in cash / GCash
  | "reviewed" // Step 6 — portfolio + review
  | "cancelled"
  | "disputed";

/** Two-part quotation mandated by RA 7394 (Consumer Protection Act). */
export interface Quote {
  laborFee: number;
  materialsCost: number;
  notes: string;
  /** Estimate validity window in days. */
  validDays: number;
}

/**
 * A worker's uploaded resume and whatever could be read from it.
 *
 * The extracted fields are suggestions the worker confirms; rawText is kept so
 * the reading can be audited rather than trusted blindly.
 */
export interface Resume {
  fileName: string;
  /** Object URL for the current session; not stable across devices. */
  fileUrl: string;
  /** Text extracted from the file, empty for images. */
  rawText: string;
  fullName?: string;
  email?: string;
  phone?: string;
  skills: string[];
  yearsExperience?: number;
  certifications: string[];
  confidence: "none" | "low" | "medium" | "high";
  uploadedAt: string;
}
export interface Worker {
  id: string;
  /** Firebase auth uid. The Firestore doc is auto-id, so this is the join key. */
  uid: string;
  fullName: string;
  /** Masked until a job request is formally accepted. */
  phone: string;
  email: string;
  photoUrl?: string;
  categoryId: string;
  barangay: string;
  bio: string;
  yearsExperience: number;
  rating: number;
  reviewCount: number;
  jobsCompleted: number;
  verified: boolean;
  tesdaCertified: boolean;
  referralCode: string;
  referralCredits: number;
  /** Prepaid platform balance that funds the 10% labor commission. */
  walletBalance: number;
  /** Commission locked when a quote is approved, released on completion. */
  walletLocked: number;
  status: WorkerStatus;
  hourlyRate: number;
  /** Code of the worker who referred this one, if any. */
  referredBy?: string;
  resume?: Resume | null;
  portfolio: PortfolioEntry[];
  verificationDocs: VerificationDoc[];
  createdAt: string;
}

export interface PortfolioEntry {
  id: string;
  jobTitle: string;
  categoryId: string;
  beforeUrl?: string;
  afterUrl?: string;
  note: string;
  createdAt: string;
}

export type DocType =
  | "government_id"
  | "barangay_clearance"
  | "recommendation_letter"
  | "tesda_certificate";

export const DOC_TYPES: Record<
  DocType,
  { label: string; requirement: "mandatory" | "optional"; purpose: string }
> = {
  government_id: {
    label: "Standard Government Photo ID",
    requirement: "mandatory",
    purpose:
      "Verification of legal identity (UMID, Driver's License, PhilID, Voter's ID).",
  },
  barangay_clearance: {
    label: "Barangay or Police Clearance",
    requirement: "mandatory",
    purpose:
      "Screening for legal records and neighborhood standing within the past 6 months.",
  },
  recommendation_letter: {
    label: "Letter of Recommendation",
    requirement: "mandatory",
    purpose:
      "Written endorsement from a former employer, local community leader, or Barangay Official.",
  },
  tesda_certificate: {
    label: "TESDA National Certificate (NC II/III)",
    requirement: "optional",
    purpose:
      'Skills certification; grants an official "TESDA Certified" badge on the profile.',
  },
};

export interface VerificationDoc {
  type: DocType;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  reviewState: "pending" | "approved" | "rejected";
}

/**
 * A service a worker has posted to the marketplace: work they are offering
 * rather than work they have been asked to do.
 *
 * Distinct from a Job. A Job is a household asking one assigned worker to do
 * something; an Offer is broadcast by a worker to whoever wants it, and
 * collects Inquiries from households that see it.
 */
export interface ServiceOffer {
  id: string;
  workerId: string;
  workerUid: string;
  workerName: string;
  title: string;
  categoryId: string;
  description: string;
  priceFrom: number;
  barangay: string;
  status: "open" | "closed";
  createdAt: string;
}

/**
 * A household responding to an offer. One per household per offer, enforced
 * by the document id being "{offerId}_{consumerId}" rather than auto-generated.
 *
 * workerUid is carried alongside workerId so the rules can check ownership
 * off this document alone, without a cross-document read.
 */
export interface Inquiry {
  id: string;
  offerId: string;
  workerId: string;
  workerUid: string;
  consumerId: string;
  consumerName: string;
  message: string;
  createdAt: string;
}

export interface Job {
  id: string;
  consumerId: string;
  consumerName: string;
  consumerPhotoUrl?: string;
  workerId: string;
  workerUid: string;
  workerName: string;
  workerPhotoUrl?: string;
  workerPhone?: string;
  consumerPhone?: string;
  categoryId: string;
  title: string;
  description: string;
  photoUrl?: string;
  barangay: string;
  status: JobStatus;
  quote?: Quote;
  quoteApprovedAt?: string;
  requestedAt: string;
  acceptedAt?: string;
  completedAt?: string;
  settledAt?: string;
  paymentMethod?: "cash" | "gcash" | "qr" | "bank_transfer" | "other";
  paymentInstructions?: string;
  paymentQrPath?: string;
  paymentProofPath?: string;
  paymentReference?: string;
  paymentSubmittedAt?: string;
  paymentApprovedAt?: string;
  rating?: number;
  reviewText?: string;
}

export interface LedgerEntry {
  id: string;
  workerId: string;
  /** Auth uid of the worker, denormalised so rules avoid a cross-document get. */
  workerUid: string;
  jobId?: string;
  kind: "top_up" | "commission_lock" | "commission_settle" | "referral_credit";
  amount: number;
  balanceAfter: number;
  method?: "gcash" | "cliqq";
  note: string;
  createdAt: string;
}

/** RA 7394 recourse log. Written by either party on a live job. */
export interface Dispute {
  id: string;
  jobId: string;
  workerId: string;
  workerUid: string;
  consumerId: string;
  consumerName: string;
  workerName: string;
  quote: Job["quote"];
  reason: string;
  raisedBy: "consumer" | "worker" | "admin";
  status: "open" | "resolved";
  createdAt: string;
}

export interface Review {
  id: string;
  jobId: string;
  workerId: string;
  consumerId: string;
  consumerName: string;
  rating: number;
  text: string;
  createdAt: string;
}
