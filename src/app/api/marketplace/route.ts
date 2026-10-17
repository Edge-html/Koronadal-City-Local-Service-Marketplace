import { NextRequest, NextResponse } from "next/server";
import { adminServices } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { escapeEmailHtml, sendTransactionalEmail } from "@/lib/server-email";
import { SKILLS_BY_CATEGORY } from "@/lib/constants";

export const runtime = "nodejs";

type JobEmailStage = "request_accepted" | "request_declined" | "quote_sent" | "quote_approved" | "work_completed" | "payment_proof_submitted" | "payment_confirmed" | "review_received";
type Operation = "notifyWorkerNewRequest" | "notifyJobStage" | "notifyWorkerApproval" | "updateWorkerSkills" | "acceptJob" | "approveQuote" | "completeJob" | "submitJobPayment" | "approveJobPayment" | "settleJob" | "submitReview" | "approveTopUp" | "rejectTopUp" | "migrateLegacyWorkers" | "resubmitCredentials" | "savePaymentSettings";

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * An error whose message is safe to show the caller.
 *
 * Anything thrown as a plain Error is treated as a bug: it is logged in full
 * and replaced with a generic message. That matters because this catch sits at
 * the top of a route that reaches an Admin SDK, and a thrown SDK error can
 * carry the project id, a collection path, or the text "FIREBASE_SERVICE_ACCOUNT
 * _JSON is not configured" straight into a customer-facing response. A caller
 * that needs a specific message says so by using this type.
 */
class MarketplaceError extends Error {}

/** Email the consumer their review link after the payment is confirmed. */
async function sendReviewLinkEmail(to: string, jobId: string, origin: string) {
  const reviewUrl = new URL(`/dashboard/customer?review=${encodeURIComponent(jobId)}`, origin).toString();
  const safeUrl = escapeEmailHtml(reviewUrl);
  return sendTransactionalEmail({
    to,
    subject: "How did your KoroHanap service go?",
    text: `Your payment is confirmed. Please rate your worker and leave a review: ${reviewUrl}`,
    html: `<p>Your payment is confirmed. Please take a moment to rate your worker and share a review.</p><p><a href="${safeUrl}">Leave a review</a></p><p>Thank you for using KoroHanap.</p>`,
  });
}

function jobRequestEmailHtml(job: { title: string; description: string; barangay: string; consumerName: string }, link: string) {
  const safeTitle = escapeEmailHtml(job.title);
  const safeDescription = escapeEmailHtml(job.description);
  const safeBarangay = escapeEmailHtml(job.barangay);
  const safeConsumer = escapeEmailHtml(job.consumerName);
  const safeLink = escapeEmailHtml(link);
  return `<div style="font-family:Arial,sans-serif;color:#171513;line-height:1.5"><h1 style="font-size:22px">A new service request is waiting</h1><p>${safeConsumer} sent you a request through KoroHanap.</p><h2 style="font-size:18px">${safeTitle}</h2><p>${safeDescription}</p><p><strong>Barangay:</strong> ${safeBarangay}</p><p><a href="${safeLink}" style="display:inline-block;background:#111;color:white;padding:12px 18px;border-radius:6px;text-decoration:none">Review request</a></p><p>Sign in to KoroHanap to accept or decline it.</p></div>`;
}

const JOB_EMAIL_COPY: Record<JobEmailStage, { recipient: "consumer" | "worker"; subject: (title: string) => string; heading: string; detail: string; path: string }> = {
  request_accepted: { recipient: "consumer", subject: (title) => `Worker accepted your request: ${title}`, heading: "Your request was accepted", detail: "The worker accepted your service request. Sign in to review the request and coordinate the next step.", path: "/dashboard/customer" },
  request_declined: { recipient: "consumer", subject: (title) => `Update on your service request: ${title}`, heading: "The worker can’t take this request", detail: "This request was declined. Sign in to KoroHanap to review its status and choose another worker if you wish.", path: "/dashboard/customer" },
  quote_sent: { recipient: "consumer", subject: (title) => `A quote is ready: ${title}`, heading: "Your worker sent a quote", detail: "Review the labor fee, materials, and notes in your request. If you agree, approve the quote in KoroHanap to begin the job.", path: "/dashboard/customer" },
  quote_approved: { recipient: "worker", subject: (title) => `The customer approved your quote: ${title}`, heading: "Your quote was approved", detail: "The customer approved the quote. You can coordinate and begin the agreed work.", path: "/dashboard/worker" },
  work_completed: { recipient: "consumer", subject: (title) => `Work marked complete: ${title}`, heading: "The worker marked the job complete", detail: "Check the job details and pay the worker using the agreed method. If you pay digitally, submit the payment proof in KoroHanap.", path: "/dashboard/customer" },
  payment_proof_submitted: { recipient: "worker", subject: (title) => `Payment proof submitted: ${title}`, heading: "The customer submitted payment proof", detail: "Review the payment in your job dashboard. Confirm it only after you have verified that you received the payment.", path: "/dashboard/worker" },
  payment_confirmed: { recipient: "consumer", subject: (title) => `Payment confirmed: ${title}`, heading: "Your payment was confirmed", detail: "The worker confirmed payment and the platform commission was settled. You can now leave a rating and review.", path: "/dashboard/customer" },
  review_received: { recipient: "worker", subject: (title) => `A customer reviewed your work: ${title}`, heading: "You received a customer review", detail: "The customer has submitted a rating and review for this job. Sign in to view your updated profile rating.", path: "/dashboard/worker" },
};

/** Claim and send a single stage email without making email availability a job-flow dependency. */
async function sendJobStageEmail(
  db: FirebaseFirestore.Firestore,
  auth: ReturnType<typeof adminServices>["auth"],
  jobId: string,
  stage: JobEmailStage,
  origin: string,
) {
  const jobRef = db.collection("jobs").doc(jobId);
  const sentField = `email_${stage}_sentAt`;
  const claimedField = `email_${stage}_claimedAt`;
  let job: FirebaseFirestore.DocumentData | undefined;
  try {
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(jobRef);
      const current = snap.data();
      if (!current) return null;
      if (current[sentField]) return null;
      const claimTime = Date.parse(String(current[claimedField] ?? ""));
      if (Number.isFinite(claimTime) && Date.now() - claimTime < 2 * 60 * 1000) return null;
      tx.update(jobRef, { [claimedField]: new Date().toISOString() });
      return current;
    });
    if (!claimed) return false;
    job = claimed;
    const copy = JOB_EMAIL_COPY[stage];
    const recipientUid = String(copy.recipient === "worker" ? job.workerUid ?? "" : job.consumerId ?? "");
    const account = recipientUid ? await auth.getUser(recipientUid) : null;
    const to = account?.email?.trim();
    if (!to) return false;
    const title = String(job.title ?? "service request");
    const link = new URL(copy.path, origin).toString();
    const html = `<div style="font-family:Arial,sans-serif;color:#171513;line-height:1.5"><h1 style="font-size:22px">${escapeEmailHtml(copy.heading)}</h1><p>${escapeEmailHtml(copy.detail)}</p><p><strong>Service:</strong> ${escapeEmailHtml(title)}</p><p><a href="${escapeEmailHtml(link)}" style="display:inline-block;background:#111;color:white;padding:12px 18px;border-radius:6px;text-decoration:none">Open KoroHanap</a></p></div>`;
    const delivered = await sendTransactionalEmail({
      to,
      subject: copy.subject(title),
      text: `${copy.heading}. ${copy.detail} Service: ${title}. Open KoroHanap: ${link}`,
      html,
    });
    if (delivered) await jobRef.update({ [sentField]: new Date().toISOString(), [claimedField]: FieldValue.delete() });
    else await jobRef.update({ [claimedField]: FieldValue.delete() });
    return delivered;
  } catch (error) {
    console.error(`[email] ${stage} alert failed.`, error);
    try { await jobRef.update({ [claimedField]: FieldValue.delete() }); } catch { /* keep the original action successful */ }
    return false;
  }
}

async function sendWorkerApprovalEmail(
  db: FirebaseFirestore.Firestore,
  auth: ReturnType<typeof adminServices>["auth"],
  workerId: string,
  origin: string,
) {
  const workerRef = db.collection("workers").doc(workerId);
  const sentField = "approvalEmailSentAt";
  const claimField = "approvalEmailClaimedAt";
  try {
    const worker = await db.runTransaction(async (tx) => {
      const snap = await tx.get(workerRef);
      const data = snap.data();
      if (!data?.verified || data.status !== "active" || data[sentField]) return null;
      const claimAt = Date.parse(String(data[claimField] ?? ""));
      if (Number.isFinite(claimAt) && Date.now() - claimAt < 2 * 60 * 1000) return null;
      tx.update(workerRef, { [claimField]: new Date().toISOString() });
      return data;
    });
    if (!worker) return false;
    const account = await auth.getUser(String(worker.uid ?? ""));
    const to = account.email?.trim();
    if (!to) {
      await workerRef.update({ [claimField]: FieldValue.delete() });
      return false;
    }
    const link = new URL("/dashboard/worker", origin).toString();
    const name = String(worker.fullName ?? "there");
    const delivered = await sendTransactionalEmail({
      to,
      subject: "Your KoroHanap worker application is approved",
      text: `Hi ${name}, your worker application has been approved. Your profile can now appear in the KoroHanap directory. Sign in to view your worker dashboard: ${link}`,
      html: `<div style="font-family:Arial,sans-serif;color:#171513;line-height:1.5"><h1 style="font-size:22px">Your worker application is approved</h1><p>Hi ${escapeEmailHtml(name)},</p><p>Your credentials have been reviewed and your KoroHanap worker profile is approved. You can now sign in and manage your services and requests.</p><p><a href="${escapeEmailHtml(link)}" style="display:inline-block;background:#111;color:white;padding:12px 18px;border-radius:6px;text-decoration:none">Open worker dashboard</a></p></div>`,
    });
    await workerRef.update(delivered
      ? { [sentField]: new Date().toISOString(), [claimField]: FieldValue.delete() }
      : { [claimField]: FieldValue.delete() });
    return delivered;
  } catch (error) {
    console.error("[email] worker approval alert failed.", error);
    try { await workerRef.update({ [claimField]: FieldValue.delete() }); } catch { /* best effort */ }
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { auth, db } = adminServices();
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return fail("Sign in to continue.", 401);
    const user = await auth.verifyIdToken(token);
    const input = await request.json() as {
      operation?: Operation;
      jobId?: string;
      emailStage?: JobEmailStage;
      workerId?: string;
      skills?: string[];
      requestId?: string;
      reviewNote?: string;
      rating?: number;
      text?: string;
      credentials?: Array<{ type: string; fileName: string; fileUrl: string; uploadedAt: string; reviewState: string }>;
      paymentSettings?: { gcashAccountName?: string; gcashNumber?: string; gcashQrPath?: string };
      payment?: { method?: string; instructions?: string; qrPath?: string };
      proofPath?: string;
      reference?: string;
    };
    const operation = input.operation;
    if (!operation) return fail("Missing operation.");

    if (operation === "savePaymentSettings") {
      const role = (await db.collection("users").doc(user.uid).get()).data()?.role;
      if (role !== "admin") return fail("Administrators only.", 403);
      const accountName = input.paymentSettings?.gcashAccountName?.trim() ?? "";
      const gcashNumber = (input.paymentSettings?.gcashNumber ?? "").replace(/\s+/g, "");
      const gcashQrPath = input.paymentSettings?.gcashQrPath?.trim() ?? "";
      if (!accountName || accountName.length > 100) return fail("Enter the GCash account name.");
      if (gcashNumber && !/^09\d{9}$/.test(gcashNumber)) return fail("Enter an 11-digit GCash number beginning with 09.");
      if (!gcashNumber && !gcashQrPath) return fail("Enter a GCash number or upload a QR code.");
      if (gcashQrPath && !/^payment-qr\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+$/.test(gcashQrPath)) return fail("Upload a valid QR code.");
      await db.collection("platformSettings").doc("payments").set({
        gcashAccountName: accountName,
        gcashNumber,
        gcashQrPath,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
      }, { merge: true });
      return NextResponse.json({ ok: true });
    }

    if (operation === "updateWorkerSkills") {
      if (!input.workerId || !Array.isArray(input.skills) || input.skills.length > 20
        || input.skills.some((skill) => typeof skill !== "string")) {
        return fail("Choose up to 20 skills.");
      }
      const userProfile = await db.collection("users").doc(user.uid).get();
      if (userProfile.data()?.role !== "worker") return fail("Only worker accounts can update these skills.", 403);
      const workerRef = db.collection("workers").doc(input.workerId);
      const workerSnap = await workerRef.get();
      const worker = workerSnap.data();
      if (!worker || worker.uid !== user.uid) return fail("This worker profile does not belong to you.", 403);
      const allowedSkills = SKILLS_BY_CATEGORY[String(worker.categoryId)] ?? [];
      const skills = [...new Set(input.skills.map((skill) => skill.trim()).filter(Boolean))];
      if (skills.some((skill) => !allowedSkills.includes(skill))) return fail("Choose skills from your listed trade.");
      await workerRef.update({ skills, updatedAt: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }

    if (operation === "notifyWorkerNewRequest") {
      if (!input.jobId) return fail("Missing job.");
      const jobRef = db.collection("jobs").doc(input.jobId);
      const shouldSend = await db.runTransaction(async (tx) => {
        const snap = await tx.get(jobRef);
        const job = snap.data();
        if (!job || job.consumerId !== user.uid || job.status !== "requested") {
          throw new MarketplaceError("This request is no longer available to notify.");
        }
        if (job.workerRequestEmailSentAt) return false;
        const claimedAt = Date.parse(String(job.workerRequestEmailClaimedAt ?? ""));
        if (Number.isFinite(claimedAt) && Date.now() - claimedAt < 2 * 60 * 1000) return false;
        tx.update(jobRef, { workerRequestEmailClaimedAt: new Date().toISOString() });
        return true;
      });
      if (!shouldSend) return NextResponse.json({ ok: true });

      const jobSnap = await jobRef.get();
      const job = jobSnap.data()!;
      try {
        const workerAccount = await auth.getUser(String(job.workerUid));
        const to = workerAccount.email?.trim();
        if (to) {
          const link = new URL("/dashboard/worker", request.nextUrl.origin).toString();
          const delivered = await sendTransactionalEmail({
            to,
            subject: `New service request: ${String(job.title ?? "KoroHanap")}`,
            text: `${String(job.consumerName ?? "A household")} sent you a new request: ${String(job.title ?? "Service request")} in ${String(job.barangay ?? "Koronadal City")}. Sign in to review it: ${link}`,
            html: jobRequestEmailHtml({
              title: String(job.title ?? "Service request"),
              description: String(job.description ?? ""),
              barangay: String(job.barangay ?? "Koronadal City"),
              consumerName: String(job.consumerName ?? "A household"),
            }, link),
          });
          if (delivered) {
            await jobRef.update({
              workerRequestEmailSentAt: new Date().toISOString(),
              workerRequestEmailClaimedAt: FieldValue.delete(),
            });
            return NextResponse.json({ ok: true, emailSent: true });
          }
        } else {
          console.warn("[email] worker account has no sign-up email.");
        }
      } catch (error) {
        console.error("[email] worker request alert failed.", error);
      }
      await jobRef.update({ workerRequestEmailClaimedAt: FieldValue.delete() });
      return NextResponse.json({ ok: true, emailSent: false });
    }

    if (operation === "notifyJobStage") {
      if (!input.jobId || !input.emailStage || !["request_declined", "quote_sent"].includes(input.emailStage)) return fail("Invalid job alert.");
      const job = (await db.collection("jobs").doc(input.jobId).get()).data();
      if (!job || job.workerUid !== user.uid) return fail("Only the assigned worker can send this update.", 403);
      if (input.emailStage === "request_declined" && (job.status !== "cancelled" || !job.cancelledAt)) return fail("This request has not been declined.");
      if (input.emailStage === "quote_sent" && (job.status !== "quoted" || !job.quotedAt || !job.quote)) return fail("A quote has not been sent for this request.");
      const emailSent = await sendJobStageEmail(db, auth, input.jobId, input.emailStage, request.nextUrl.origin);
      return NextResponse.json({ ok: true, emailSent });
    }

    if (operation === "notifyWorkerApproval") {
      if (!input.workerId) return fail("Missing worker.");
      const caller = await db.collection("users").doc(user.uid).get();
      if (caller.data()?.role !== "admin") return fail("Administrators only.", 403);
      const worker = await db.collection("workers").doc(input.workerId).get();
      if (worker.data()?.verified !== true || worker.data()?.status !== "active") return fail("This worker application is not approved yet.");
      const emailSent = await sendWorkerApprovalEmail(db, auth, input.workerId, request.nextUrl.origin);
      return NextResponse.json({ ok: true, emailSent });
    }

    if (operation === "acceptJob") {
      if (!input.jobId) return fail("Missing job.");
      const jobRef = db.collection("jobs").doc(input.jobId);
      await db.runTransaction(async (tx) => {
        const jobSnap = await tx.get(jobRef);
        const job = jobSnap.data();
        if (!job || job.workerUid !== user.uid || job.status !== "requested") {
          throw new Error("This request is no longer available.");
        }
        const workerRef = db.collection("workers").doc(job.workerId);
        const [workerSnap, workerUserSnap, customerUserSnap] = await Promise.all([
          tx.get(workerRef),
          tx.get(db.collection("users").doc(user.uid)),
          tx.get(db.collection("users").doc(job.consumerId)),
        ]);
        const worker = workerSnap.data();
        if (!worker || worker.uid !== user.uid || !worker.verified || worker.status !== "active") {
          throw new Error("Only an active, verified worker can accept.");
        }
        tx.update(jobRef, {
          status: "accepted",
          acceptedAt: new Date().toISOString(),
          workerPhone: workerUserSnap.data()?.phone ?? "",
          consumerPhone: customerUserSnap.data()?.phone ?? "",
        });
      });
      await sendJobStageEmail(db, auth, input.jobId, "request_accepted", request.nextUrl.origin);
      return NextResponse.json({ ok: true });
    }

    if (operation === "approveQuote") {
      if (!input.jobId) return fail("Missing job.");
      const jobRef = db.collection("jobs").doc(input.jobId);
      await db.runTransaction(async (tx) => {
        const jobSnap = await tx.get(jobRef);
        const job = jobSnap.data();
        if (!job || job.consumerId !== user.uid || job.status !== "quoted" || !job.quote) {
          throw new Error("This quote is no longer available for approval.");
        }
        const workerRef = db.collection("workers").doc(job.workerId);
        const workerSnap = await tx.get(workerRef);
        const worker = workerSnap.data();
        if (!worker || !worker.verified || worker.status !== "active" || worker.uid !== job.workerUid) {
          throw new Error("This worker is not active.");
        }
        const commission = money(Number(job.quote.laborFee) * 0.1);
        if (!Number.isFinite(commission) || commission < 0) throw new Error("Invalid quote.");
        const balance = Number(worker.walletBalance ?? 0);
        const locked = Number(worker.walletLocked ?? 0);
        if (money(balance - locked) < commission) {
          // A household cannot resolve this and should not be told about
          // somebody else's wallet. They get a stable, actionable message; the
          // diagnostic stays in the server log where an operator can act on it.
          //
          // The quote form refuses to send an un-coverable quote in the first
          // place, so reaching this means the worker's balance moved between
          // quoting and approval -- two quotes competing for the same funds.
          console.warn(
            `[approveQuote] worker ${job.workerUid} is ${money(commission - (balance - locked))} short ` +
            `on a ${money(commission)} commission (job ${input.jobId})`,
          );
          throw new MarketplaceError(
            "This worker needs to top up their platform balance before you can approve. " +
            "Message them to sort it out, or approve later once they have.",
          );
        }
        tx.update(jobRef, {
          status: "in_progress",
          quoteApprovedAt: new Date().toISOString(),
          commissionAmount: commission,
        });
        tx.update(workerRef, { walletLocked: money(locked + commission) });
        tx.create(db.collection("ledger").doc(), {
          workerId: job.workerId,
          workerUid: job.workerUid,
          jobId: input.jobId,
          kind: "commission_lock",
          amount: commission,
          balanceAfter: balance,
          note: "Commission reserved for " + job.title,
          createdAt: new Date().toISOString(),
        });
      });
      await sendJobStageEmail(db, auth, input.jobId, "quote_approved", request.nextUrl.origin);
      return NextResponse.json({ ok: true });
    }

    if (operation === "completeJob") {
      if (!input.jobId) return fail("Missing job.");
      const method = input.payment?.method;
      const instructions = input.payment?.instructions?.trim() ?? "";
      const qrPath = input.payment?.qrPath?.trim() ?? "";
      if (!["cash", "gcash", "qr", "bank_transfer", "other"].includes(method ?? "")) return fail("Choose how the finder should pay you.");
      if (instructions.length > 500) return fail("Payment instructions must be 500 characters or fewer.");
      if (method !== "cash" && instructions.length < 3) return fail("Add the account details or payment instructions the finder needs.");
      if (method === "qr" && !new RegExp(`^worker-payment-qr/${user.uid}/[A-Za-z0-9-]+$`).test(qrPath)) return fail("Upload your payment QR code.");
      if (method !== "qr" && qrPath) return fail("Unexpected QR image.");
      const jobRef = db.collection("jobs").doc(input.jobId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(jobRef);
        const job = snap.data();
        if (!job || job.workerUid !== user.uid || job.status !== "in_progress") throw new Error("This job cannot be marked complete.");
        tx.update(jobRef, {
          status: "completed",
          completedAt: new Date().toISOString(),
          paymentMethod: method,
          paymentInstructions: method === "cash" ? "Pay the worker in cash and ask for a receipt." : instructions,
          paymentQrPath: qrPath,
        });
      });
      await sendJobStageEmail(db, auth, input.jobId, "work_completed", request.nextUrl.origin);
      return NextResponse.json({ ok: true });
    }

    if (operation === "submitJobPayment") {
      if (!input.jobId) return fail("Missing job.");
      const proofPath = input.proofPath?.trim() ?? "";
      const reference = input.reference?.trim() ?? "";
      if (!new RegExp(`^job-payment-proofs/${input.jobId}/${user.uid}/[A-Za-z0-9-]+$`).test(proofPath)) return fail("Upload a valid payment proof image.");
      if (reference.length > 120) return fail("Payment reference must be 120 characters or fewer.");
      const jobRef = db.collection("jobs").doc(input.jobId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(jobRef);
        const job = snap.data();
        if (!job || job.consumerId !== user.uid || job.status !== "completed" || job.settledAt || job.paymentApprovedAt) throw new Error("This job is not waiting for a payment proof.");
        tx.update(jobRef, { paymentProofPath: proofPath, paymentReference: reference, paymentSubmittedAt: new Date().toISOString() });
      });
      await sendJobStageEmail(db, auth, input.jobId, "payment_proof_submitted", request.nextUrl.origin);
      return NextResponse.json({ ok: true });
    }

    if (operation === "approveJobPayment") {
      if (!input.jobId) return fail("Missing job.");
      const jobRef = db.collection("jobs").doc(input.jobId);
      const reviewRecipient = await db.runTransaction(async (tx) => {
        const jobSnap = await tx.get(jobRef);
        const job = jobSnap.data();
        if (!job || job.workerUid !== user.uid || job.status !== "completed" || job.settledAt
          || !job.paymentProofPath || !job.paymentSubmittedAt) throw new Error("This job has no payment proof to approve.");
        const workerRef = db.collection("workers").doc(job.workerId);
        const workerSnap = await tx.get(workerRef);
        const worker = workerSnap.data();
        if (!worker || worker.uid !== user.uid) throw new Error("Worker profile not found.");
        const commission = Number(job.commissionAmount);
        const locked = Number(worker.walletLocked ?? 0);
        if (!Number.isFinite(commission) || commission < 0 || locked < commission) throw new Error("The commission lock is missing.");
        const balance = money(Number(worker.walletBalance ?? 0) - commission);
        const isFirstJob = Number(worker.jobsCompleted ?? 0) === 0;
        const referrerQuery = isFirstJob && worker.referredBy
          ? await tx.get(db.collection("workers").where("referralCode", "==", worker.referredBy).limit(1))
          : null;
        const referrerDoc = referrerQuery?.docs[0];
        const referrer = referrerDoc?.data();
        const now = new Date().toISOString();
        tx.update(workerRef, {
          walletBalance: balance,
          walletLocked: money(locked - commission),
          jobsCompleted: Number(worker.jobsCompleted ?? 0) + 1,
          status: balance < 0 ? "paused_wallet" : worker.status,
        });
        tx.update(jobRef, { paymentApprovedAt: now, settledAt: now });
        tx.create(db.collection("ledger").doc(), {
          workerId: job.workerId, workerUid: user.uid, jobId: input.jobId,
          kind: "commission_settle", amount: -commission, balanceAfter: balance,
          note: "Commission settled after confirming finder payment for " + job.title, createdAt: now,
        });
        if (referrerDoc && referrer && referrerDoc.id !== job.workerId) {
          const credits = Number(referrer.referralCredits ?? 0) + 1;
          tx.update(referrerDoc.ref, { referralCredits: credits });
          tx.create(db.collection("ledger").doc(), {
            workerId: referrerDoc.id, workerUid: referrer.uid, jobId: input.jobId,
            kind: "referral_credit", amount: 1, balanceAfter: credits,
            note: "First settled job referral: " + worker.fullName, createdAt: now,
          });
        }
        return { consumerId: String(job.consumerId ?? ""), optedIn: job.reviewEmailOptIn === true };
      });
      if (reviewRecipient.optedIn) {
        const customer = await auth.getUser(reviewRecipient.consumerId);
        if (customer.email) await sendReviewLinkEmail(customer.email, input.jobId, request.nextUrl.origin);
      }
      await sendJobStageEmail(db, auth, input.jobId, "payment_confirmed", request.nextUrl.origin);
      return NextResponse.json({ ok: true });
    }

    if (operation === "settleJob") {
      if (!input.jobId) return fail("Missing job.");
      const jobRef = db.collection("jobs").doc(input.jobId);
      const reviewRecipient = await db.runTransaction(async (tx) => {
        const jobSnap = await tx.get(jobRef);
        const job = jobSnap.data();
        if (!job || job.workerUid !== user.uid || job.status !== "completed" || job.settledAt || job.paymentMethod) {
          throw new Error("This job cannot be settled.");
        }
        const workerRef = db.collection("workers").doc(job.workerId);
        const workerSnap = await tx.get(workerRef);
        const worker = workerSnap.data();
        if (!worker || worker.uid !== user.uid) throw new Error("Worker profile not found.");
        const commission = Number(job.commissionAmount);
        if (!Number.isFinite(commission) || commission < 0) throw new Error("This job has no valid commission lock.");
        const locked = Number(worker.walletLocked ?? 0);
        if (locked < commission) throw new Error("The commission lock is missing.");
        const balance = money(Number(worker.walletBalance ?? 0) - commission);
        const isFirstJob = Number(worker.jobsCompleted ?? 0) === 0;
        const referrerQuery = isFirstJob && worker.referredBy
          ? await tx.get(db.collection("workers").where("referralCode", "==", worker.referredBy).limit(1))
          : null;
        const referrerDoc = referrerQuery?.docs[0];
        const referrer = referrerDoc?.data();
        tx.update(workerRef, {
          walletBalance: balance,
          walletLocked: money(locked - commission),
          jobsCompleted: Number(worker.jobsCompleted ?? 0) + 1,
          status: balance < 0 ? "paused_wallet" : worker.status,
        });
        tx.update(jobRef, { settledAt: new Date().toISOString() });
        tx.create(db.collection("ledger").doc(), {
          workerId: job.workerId,
          workerUid: user.uid,
          jobId: input.jobId,
          kind: "commission_settle",
          amount: -commission,
          balanceAfter: balance,
          note: "Commission settled for " + job.title,
          createdAt: new Date().toISOString(),
        });
        if (referrerDoc && referrer && referrerDoc.id !== job.workerId) {
          const credits = Number(referrer.referralCredits ?? 0) + 1;
          tx.update(referrerDoc.ref, { referralCredits: credits });
          tx.create(db.collection("ledger").doc(), {
            workerId: referrerDoc.id,
            workerUid: referrer.uid,
            jobId: input.jobId,
            kind: "referral_credit",
            amount: 1,
            balanceAfter: credits,
            note: "First settled job referral: " + worker.fullName,
            createdAt: new Date().toISOString(),
          });
        }
        return { consumerId: String(job.consumerId ?? ""), optedIn: job.reviewEmailOptIn === true };
      });
      if (reviewRecipient.optedIn) {
        const customer = await auth.getUser(reviewRecipient.consumerId);
        if (customer.email) await sendReviewLinkEmail(customer.email, input.jobId, request.nextUrl.origin);
      }
      await sendJobStageEmail(db, auth, input.jobId, "payment_confirmed", request.nextUrl.origin);
      return NextResponse.json({ ok: true });
    }

    if (operation === "submitReview") {
      const submittedRating = input.rating;
      if (!input.jobId || typeof submittedRating !== "number" || !Number.isInteger(submittedRating) || submittedRating < 1 || submittedRating > 5) {
        return fail("Choose a rating from 1 to 5.");
      }
      const text = input.text?.trim() ?? "";
      if (text.length < 5 || text.length > 2000) return fail("Review must be 5 to 2000 characters.");
      const jobRef = db.collection("jobs").doc(input.jobId);
      const reviewRef = db.collection("reviews").doc(input.jobId);
      await db.runTransaction(async (tx) => {
        const jobSnap = await tx.get(jobRef);
        const job = jobSnap.data();
        if (!job || job.consumerId !== user.uid || job.status !== "completed" || !job.settledAt) {
          throw new Error("Only the customer can review a settled job.");
        }
        const existing = await tx.get(reviewRef);
        if (existing.exists) throw new Error("This job has already been reviewed.");
        const workerRef = db.collection("workers").doc(job.workerId);
        const workerSnap = await tx.get(workerRef);
        const worker = workerSnap.data();
        if (!worker || worker.uid !== job.workerUid) throw new Error("Worker profile not found.");
        const previousReviews = await tx.get(db.collection("reviews").where("workerId", "==", job.workerId));
        const count = previousReviews.size;
        const total = previousReviews.docs.reduce((sum, row) => sum + Number(row.data().rating ?? 0), submittedRating);
        const rating = money(total / (count + 1));
        tx.create(reviewRef, {
          jobId: input.jobId,
          workerId: job.workerId,
          consumerId: user.uid,
          consumerName: job.consumerName,
          rating: submittedRating,
          text,
          createdAt: new Date().toISOString(),
        });
        tx.update(jobRef, { status: "reviewed", rating: submittedRating, reviewText: text });
        tx.update(workerRef, { rating, reviewCount: count + 1 });
      });
      await sendJobStageEmail(db, auth, input.jobId, "review_received", request.nextUrl.origin);
      return NextResponse.json({ ok: true });
    }

    if (operation === "resubmitCredentials") {
      const docs = input.credentials;
      const required = ["government_id", "barangay_clearance", "recommendation_letter"];
      if (!Array.isArray(docs) || !required.every((type) => docs.some((item) => item.type === type))
        || docs.some((item) => !["government_id", "barangay_clearance", "recommendation_letter", "tesda_certificate"].includes(item.type)
          || !item.fileUrl.startsWith("credentials/" + user.uid + "/"))) {
        return fail("Upload all three required documents.");
      }
      const workers = await db.collection("workers").where("uid", "==", user.uid).limit(1).get();
      if (workers.empty) return fail("Worker profile not found.");
      const workerRef = workers.docs[0].ref;
      const privateRef = db.collection("workerCredentials").doc(workerRef.id);
      await db.runTransaction(async (tx) => {
        const workerSnap = await tx.get(workerRef);
        if (workerSnap.data()?.uid !== user.uid) throw new Error("Access denied.");
        tx.set(privateRef, {
          uid: user.uid,
          verificationDocs: docs.map((item) => ({
            type: item.type,
            fileName: item.fileName,
            fileUrl: item.fileUrl,
            uploadedAt: item.uploadedAt,
            reviewState: "pending",
          })),
        }, { merge: true });
        tx.update(workerRef, {
          verified: false,
          status: "pending_verification",
          tesdaCertified: false,
        });
      });
      return NextResponse.json({ ok: true });
    }

    if (operation === "migrateLegacyWorkers") {
      const roleSnap = await db.collection("users").doc(user.uid).get();
      if (roleSnap.data()?.role !== "admin") return fail("Administrators only.", 403);
      const workers = await db.collection("workers").get();
      let migrated = 0;
      for (const row of workers.docs) {
        const worker = row.data();
        const hasPrivateFields = "phone" in worker || "email" in worker
          || "verificationDocs" in worker
          || (worker.resume && ("rawText" in worker.resume || "phone" in worker.resume || "email" in worker.resume));
        if (!hasPrivateFields) continue;
        const privateRef = db.collection("workerCredentials").doc(row.id);
        const privateSnap = await privateRef.get();
        const current = privateSnap.data();
        const resume = worker.resume;
        const privateResume = resume ? {
          rawText: resume.rawText ?? "",
          phone: resume.phone ?? "",
          email: resume.email ?? "",
          fileUrl: resume.fileUrl ?? "",
        } : null;
        const publicResume = resume ? { ...resume } : null;
        if (publicResume) {
          delete publicResume.rawText;
          delete publicResume.phone;
          delete publicResume.email;
          delete publicResume.fileUrl;
        }
        const docs = current?.verificationDocs ?? worker.verificationDocs ?? [];
        const needsFreshFiles = docs.length < 3 || docs.some((item: { fileUrl?: string }) =>
          !item.fileUrl?.startsWith("credentials/"));
        const batch = db.batch();
        batch.set(privateRef, {
          uid: worker.uid,
          verificationDocs: docs,
          resumePrivate: current?.resumePrivate ?? privateResume,
        }, { merge: true });
        const publicPatch: Record<string, unknown> = {
          phone: FieldValue.delete(),
          email: FieldValue.delete(),
          verificationDocs: FieldValue.delete(),
        };
        if (publicResume) publicPatch.resume = publicResume;
        if (needsFreshFiles) {
          publicPatch.verified = false;
          publicPatch.status = "pending_verification";
          publicPatch.tesdaCertified = false;
        }
        batch.update(row.ref, publicPatch);
        await batch.commit();
        migrated++;
      }
      return NextResponse.json({ ok: true, migrated });
    }

    if (operation === "approveTopUp" || operation === "rejectTopUp") {
      if (!input.requestId) return fail("Missing top-up request.");
      const roleSnap = await db.collection("users").doc(user.uid).get();
      if (roleSnap.data()?.role !== "admin") return fail("Administrators only.", 403);
      const topUpRef = db.collection("topupRequests").doc(input.requestId);
      await db.runTransaction(async (tx) => {
        const requestSnap = await tx.get(topUpRef);
        const topUp = requestSnap.data();
        if (!topUp || topUp.status !== "pending") throw new Error("This request has already been processed.");
        if (operation === "rejectTopUp") {
          const reviewNote = input.reviewNote?.trim() ?? "";
          if (reviewNote.length < 5 || reviewNote.length > 500) throw new MarketplaceError("Add a short reason so the worker knows what to correct.");
          tx.update(topUpRef, { status: "rejected", reviewNote, reviewedBy: user.uid, reviewedAt: new Date().toISOString() });
          return;
        }
        if (typeof topUp.receiptPath !== "string"
          || !topUp.receiptPath.startsWith(`topup-receipts/${topUp.workerUid}/`)) {
          throw new MarketplaceError("This request has no valid receipt. Reject it and ask the worker to submit a new request.");
        }
        const matchingReferences = await tx.get(
          db.collection("topupRequests").where("reference", "==", topUp.reference),
        );
        if (matchingReferences.docs.some((row) => row.id !== input.requestId
          && row.data().status === "approved" && row.data().method === topUp.method)) {
          throw new Error("This payment reference has already been credited.");
        }
        const amount = Number(topUp.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new Error("Invalid top-up amount.");
        const workerRef = db.collection("workers").doc(topUp.workerId);
        const workerSnap = await tx.get(workerRef);
        const worker = workerSnap.data();
        if (!worker || worker.uid !== topUp.workerUid) throw new Error("Worker profile not found.");
        const balance = money(Number(worker.walletBalance ?? 0) + amount);
        tx.update(workerRef, {
          walletBalance: balance,
          status: worker.status === "paused_wallet" && balance >= 0 ? "active" : worker.status,
        });
        tx.update(topUpRef, { status: "approved", reviewedBy: user.uid, reviewedAt: new Date().toISOString() });
        tx.create(db.collection("ledger").doc(), {
          workerId: topUp.workerId,
          workerUid: topUp.workerUid,
          kind: "top_up",
          amount,
          balanceAfter: balance,
          method: topUp.method,
          note: "Verified top-up: " + topUp.reference,
          createdAt: new Date().toISOString(),
        });
      });
      return NextResponse.json({ ok: true });
    }

    return fail("Unknown operation.");
  } catch (error) {
    if (error instanceof MarketplaceError) {
      // An expected refusal. Logged at a glance, message passed through.
      console.warn("[marketplace] refused:", error.message);
      return fail(error.message);
    }

    // Everything else is a bug or a transient fault, including anything the
    // Admin SDK throws. Its text can name the project, a collection, or a
    // missing server-side secret, none of which belongs in a response body.
    console.error("[marketplace]", error);
    return fail("Could not complete the action. Please try again.", 500);
  }
}
