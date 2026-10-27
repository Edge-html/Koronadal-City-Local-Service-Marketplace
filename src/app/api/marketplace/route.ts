import { NextRequest, NextResponse } from "next/server";
import { adminServices } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { emailRelayConfigured, emailRelayMissingVariables, escapeEmailHtml, sendTransactionalEmail, sendTransactionalEmailDetailed } from "@/lib/server-email";
import { CATEGORIES, SKILLS_BY_CATEGORY } from "@/lib/constants";
import { downloadPrivateFile } from "@/lib/supabase-storage";

export const runtime = "nodejs";

type JobEmailStage = "request_accepted" | "request_declined" | "quote_sent" | "quote_approved" | "agreement_confirmed" | "agreement_confirmed_customer" | "work_completed" | "payment_proof_submitted" | "payment_confirmed" | "review_received";
type Operation = "emailDiagnostics" | "notifyWorkerNewRequest" | "notifyJobStage" | "notifyWorkerApproval" | "updateWorkerSkills" | "setWorkerServices" | "getProPaymentInfo" | "saveProPaymentSettings" | "submitProPaymentRequest" | "reviewProPaymentRequest" | "addService" | "acceptJob" | "confirmJobAgreement" | "approveQuote" | "completeJob" | "submitJobPayment" | "approveJobPayment" | "settleJob" | "submitReview" | "approveTopUp" | "rejectTopUp" | "migrateLegacyWorkers" | "resubmitCredentials" | "savePaymentSettings" | "setServiceEnabled";

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Resolve the email address recorded for this account at sign-up. */
async function getSignupEmail(
  db: FirebaseFirestore.Firestore,
  auth: ReturnType<typeof adminServices>["auth"],
  uid: string,
) {
  if (!uid) return "";
  const profile = await db.collection("users").doc(uid).get();
  const signupEmail = String(profile.data()?.email ?? "").trim();
  if (signupEmail) return signupEmail;
  const authUser = await auth.getUser(uid);
  return authUser.email?.trim() ?? "";
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

/** Email the consumer their review link after the job is completed. */
async function sendReviewLinkEmail(to: string, jobId: string, origin: string) {
  const reviewUrl = new URL(`/dashboard/customer?review=${encodeURIComponent(jobId)}`, origin).toString();
  const safeUrl = escapeEmailHtml(reviewUrl);
  return sendTransactionalEmail({
    to,
    subject: "How did your KoroHanap service go?",
    text: `Your job is complete. Please rate your worker and leave a review: ${reviewUrl}`,
    html: `<p>Your job is complete. Please take a moment to rate your worker and share a review.</p><p><a href="${safeUrl}">Leave a review</a></p><p>Thank you for using KoroHanap.</p>`,
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
  agreement_confirmed: { recipient: "worker", subject: (title) => `You both agreed to proceed: ${title}`, heading: "The job agreement is confirmed", detail: "Both you and the household confirmed the plan in chat. You can now begin the agreed work.", path: "/dashboard/worker" },
  agreement_confirmed_customer: { recipient: "consumer", subject: (title) => `You both agreed to proceed: ${title}`, heading: "The job agreement is confirmed", detail: "Both you and the worker confirmed the plan in chat. The worker can now begin the agreed work.", path: "/dashboard/customer" },
  work_completed: { recipient: "consumer", subject: (title) => `Work marked complete: ${title}`, heading: "The worker marked the job complete", detail: "The worker marked the job complete. Review the chat agreement, settle payment directly with the worker, and leave a review.", path: "/dashboard/customer" },
  payment_proof_submitted: { recipient: "worker", subject: (title) => `Payment proof submitted: ${title}`, heading: "The customer submitted payment proof", detail: "Review the payment in your job dashboard. Confirm it only after you have verified that you received the payment.", path: "/dashboard/worker" },
  payment_confirmed: { recipient: "consumer", subject: (title) => `Payment confirmed: ${title}`, heading: "Your payment was confirmed", detail: "The worker confirmed that payment arrived. You can now leave a rating and review.", path: "/dashboard/customer" },
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
    const to = await getSignupEmail(db, auth, recipientUid);
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
    const to = await getSignupEmail(db, auth, String(worker.uid ?? ""));
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
      serviceIds?: string[];
      skills?: string[];
      requestId?: string;
      reviewNote?: string;
      rating?: number;
      text?: string;
      credentials?: Array<{ type: string; fileName: string; fileUrl: string; uploadedAt: string; reviewState: string }>;
      paymentSettings?: { gcashAccountName?: string; gcashNumber?: string; gcashQrPath?: string };
      proPaymentSettings?: { gcashAccountName?: string; gcashNumber?: string; gcashQrPath?: string; proFee?: number };
      payment?: { method?: string; instructions?: string; qrPath?: string };
      proofPath?: string;
      reference?: string;
      approve?: boolean;
      sendTest?: boolean;
      categoryId?: string;
      enabled?: boolean;
      name?: string;
      scope?: string;
    };
    const operation = input.operation;
    if (!operation) return fail("Missing operation.");

    // Legacy quotation approvals, platform wallet and payment-proof endpoints
    // are intentionally closed. Scope and price are agreed in the private
    // job chat; KoroHanap does not charge or hold job payments.
    if (["approveQuote", "submitJobPayment", "approveJobPayment", "settleJob", "approveTopUp", "rejectTopUp", "savePaymentSettings"].includes(operation)) {
      return fail("Wallet, top-ups, and quote approval have been retired. Agree on the job in chat.", 410);
    }

    if (operation === "emailDiagnostics") {
      const account = (await db.collection("users").doc(user.uid).get()).data();
      if (account?.role !== "admin") return fail("Administrators only.", 403);
      if (!input.sendTest) return NextResponse.json({ ok: true, configured: emailRelayConfigured(), missingVariables: emailRelayMissingVariables() });
      const to = await getSignupEmail(db, auth, user.uid);
      if (!to) return NextResponse.json({ ok: true, configured: emailRelayConfigured(), missingVariables: emailRelayMissingVariables(), emailSent: false, reason: "no_signup_email" });
      const result = await sendTransactionalEmailDetailed({
        to,
        subject: "KoroHanap email alert test",
        text: "This test confirms that KoroHanap can send email alerts through your Google Apps Script relay.",
        html: "<p>This test confirms that KoroHanap can send email alerts through your Google Apps Script relay.</p>",
      });
      return NextResponse.json({ ok: true, configured: emailRelayConfigured(), missingVariables: emailRelayMissingVariables(), emailSent: result.ok, reason: result.ok ? null : result.reason, recipient: to });
    }

    if (operation === "getProPaymentInfo") {
      const role = (await db.collection("users").doc(user.uid).get()).data()?.role;
      if (role !== "admin" && role !== "worker") return fail("Worker or administrator accounts only.", 403);
      const settingsSnap = await db.collection("platformSettings").doc("proPayments").get();
      const rawSettings = settingsSnap.data();
      const proPaymentSettings = settingsSnap.exists ? {
        gcashAccountName: String(rawSettings?.gcashAccountName ?? ""),
        gcashNumber: String(rawSettings?.gcashNumber ?? ""),
        gcashQrPath: String(rawSettings?.gcashQrPath ?? ""),
        proFee: Number(rawSettings?.proFee ?? 0),
        updatedAt: String(rawSettings?.updatedAt ?? ""),
      } : null;
      if (role === "admin") {
        const pending = await db.collection("proPaymentRequests").where("status", "==", "pending").limit(100).get();
        const requests = pending.docs.map((row) => ({ ...row.data(), id: row.id }));
        return NextResponse.json({ ok: true, proPaymentSettings, requests });
      }
      const requestSnap = await db.collection("proPaymentRequests").doc(user.uid).get();
      const proPaymentRequest = requestSnap.exists ? { ...requestSnap.data(), id: requestSnap.id } : null;
      return NextResponse.json({ ok: true, proPaymentSettings, proPaymentRequest });
    }

    if (operation === "saveProPaymentSettings") {
      const role = (await db.collection("users").doc(user.uid).get()).data()?.role;
      if (role !== "admin") return fail("Administrators only.", 403);
      const accountName = input.proPaymentSettings?.gcashAccountName?.trim() ?? "";
      const gcashNumber = (input.proPaymentSettings?.gcashNumber ?? "").replace(/\s+/g, "");
      const gcashQrPath = input.proPaymentSettings?.gcashQrPath?.trim() ?? "";
      const proFee = Number(input.proPaymentSettings?.proFee);
      if (!accountName || accountName.length > 100) return fail("Enter the GCash account name.");
      if (!/^09\d{9}$/.test(gcashNumber)) return fail("Enter an 11-digit GCash number beginning with 09.");
      if (!/^pro-payment-qr\/[A-Za-z0-9-]{16,80}$/.test(gcashQrPath)) return fail("Upload the GCash QR code.");
      if (!Number.isInteger(proFee) || proFee < 1 || proFee > 100000) return fail("Set a Pro activation fee between ₱1 and ₱100,000.");
      await db.collection("platformSettings").doc("proPayments").set({
        gcashAccountName: accountName,
        gcashNumber,
        gcashQrPath,
        proFee,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
      }, { merge: true });
      return NextResponse.json({ ok: true });
    }

    if (operation === "submitProPaymentRequest") {
      const role = (await db.collection("users").doc(user.uid).get()).data()?.role;
      if (role !== "worker") return fail("Only workers can submit Pro payments.", 403);
      const proofPath = input.proofPath ?? "";
      if (!input.workerId || !/^pro-payment-receipts\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9-]{16,80}$/.test(proofPath)) {
        return fail("Upload a valid payment receipt.");
      }
      const reference = (input.reference ?? "").trim().replace(/\s+/g, "").toUpperCase();
      if (reference.length < 4 || reference.length > 50 || !/^[A-Z0-9-]+$/.test(reference)) {
        return fail("Enter a valid GCash reference number.");
      }
      if (!proofPath.startsWith(`pro-payment-receipts/${user.uid}/`)) return fail("That receipt does not belong to your account.", 403);
      try {
        await downloadPrivateFile(proofPath);
      } catch {
        return fail("The uploaded receipt could not be found. Upload it again.");
      }
      const workerRef = db.collection("workers").doc(input.workerId);
      const settingsRef = db.collection("platformSettings").doc("proPayments");
      const requestRef = db.collection("proPaymentRequests").doc(user.uid);
      const [workerSnap, settingsSnap, matchingRefs] = await Promise.all([
        workerRef.get(),
        settingsRef.get(),
        db.collection("proPaymentRequests").where("reference", "==", reference).limit(20).get(),
      ]);
      const worker = workerSnap.data();
      const settings = settingsSnap.data();
      if (!worker || worker.uid !== user.uid) return fail("This worker profile does not belong to you.", 403);
      if (!worker.verified || worker.status !== "active") return fail("Your worker profile must be approved before activating Pro.");
      if (worker.isPro === true) return fail("KoroHanap Pro is already active on your account.");
      const amount = Number(settings?.proFee ?? 0);
      if (!settingsSnap.exists || !settings?.gcashNumber || !settings?.gcashQrPath || !Number.isInteger(amount) || amount < 1) {
        return fail("The administrator has not finished setting up Pro payments yet.");
      }
      if (matchingRefs.docs.some((row) => row.id !== user.uid && ["pending", "approved"].includes(String(row.data().status)))) {
        return fail("That GCash reference number has already been submitted.");
      }
      const submittedAt = new Date().toISOString();
      await db.runTransaction(async (tx) => {
        const [requestSnap, currentWorkerSnap, currentSettingsSnap] = await Promise.all([
          tx.get(requestRef), tx.get(workerRef), tx.get(settingsRef),
        ]);
        const previous = requestSnap.data();
        if (previous?.status === "pending") throw new MarketplaceError("Your Pro payment is already waiting for admin review.");
        if (previous?.status === "approved") throw new MarketplaceError("KoroHanap Pro is already approved on your account.");
        const currentWorker = currentWorkerSnap.data();
        const currentSettings = currentSettingsSnap.data();
        if (!currentWorker || currentWorker.uid !== user.uid || !currentWorker.verified || currentWorker.status !== "active") {
          throw new MarketplaceError("Your approved worker profile could not be verified.");
        }
        if (currentWorker.isPro === true) throw new MarketplaceError("KoroHanap Pro is already active on your account.");
        if (Number(currentSettings?.proFee) !== amount || !currentSettings?.gcashNumber || !currentSettings?.gcashQrPath) {
          throw new MarketplaceError("The Pro payment details changed. Refresh the page and try again.");
        }
        tx.set(requestRef, {
          workerId: input.workerId,
          workerUid: user.uid,
          workerName: String(currentWorker.fullName ?? "Worker"),
          reference,
          proofPath,
          amount,
          status: "pending",
          reviewNote: "",
          submittedAt,
          reviewedAt: "",
          reviewedBy: "",
        });
      });
      return NextResponse.json({ ok: true, requestId: user.uid, status: "pending" });
    }

    if (operation === "reviewProPaymentRequest") {
      const role = (await db.collection("users").doc(user.uid).get()).data()?.role;
      if (role !== "admin") return fail("Administrators only.", 403);
      if (!input.requestId || !/^[A-Za-z0-9_-]{1,128}$/.test(input.requestId) || typeof input.approve !== "boolean") {
        return fail("Choose a valid Pro payment request and decision.");
      }
      const reviewNote = (input.reviewNote ?? "").trim();
      if (!input.approve && (reviewNote.length < 5 || reviewNote.length > 500)) {
        return fail("Add a short reason when rejecting a payment.");
      }
      const requestRef = db.collection("proPaymentRequests").doc(input.requestId);
      const reviewedAt = new Date().toISOString();
      await db.runTransaction(async (tx) => {
        const requestSnap = await tx.get(requestRef);
        const paymentRequest = requestSnap.data();
        if (!paymentRequest || paymentRequest.status !== "pending") throw new MarketplaceError("This Pro payment has already been reviewed.");
        const expectedProof = new RegExp(`^pro-payment-receipts/${paymentRequest.workerUid}/[A-Za-z0-9-]{16,80}$`);
        if (typeof paymentRequest.reference !== "string" || paymentRequest.reference.length < 4
          || !Number.isInteger(Number(paymentRequest.amount)) || Number(paymentRequest.amount) < 1
          || !expectedProof.test(String(paymentRequest.proofPath ?? ""))) {
          throw new MarketplaceError("This payment request is missing valid reference, amount, or receipt details.");
        }
        const workerRef = db.collection("workers").doc(String(paymentRequest.workerId ?? ""));
        const workerSnap = await tx.get(workerRef);
        const worker = workerSnap.data();
        if (!worker || worker.uid !== paymentRequest.workerUid) throw new MarketplaceError("Worker profile not found for this payment.");
        if (input.approve && (!worker.verified || worker.status !== "active")) throw new MarketplaceError("This worker must be approved before Pro can be activated.");
        tx.update(requestRef, {
          status: input.approve ? "approved" : "rejected",
          reviewNote: input.approve ? "" : reviewNote,
          reviewedAt,
          reviewedBy: user.uid,
        });
        if (input.approve) tx.update(workerRef, { isPro: true, proActivatedAt: reviewedAt, updatedAt: reviewedAt });
      });
      return NextResponse.json({ ok: true });
    }

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

    if (operation === "setServiceEnabled") {
      const role = (await db.collection("users").doc(user.uid).get()).data()?.role;
      if (role !== "admin") return fail("Administrators only.", 403);
      const categoryId = String(input.categoryId ?? "");
      if (!/^[a-z0-9-]{2,60}$/.test(categoryId) || typeof input.enabled !== "boolean") return fail("Choose a valid service and status.");
      await db.collection("serviceControls").doc(categoryId).set({ enabled: input.enabled, updatedAt: new Date().toISOString(), updatedBy: user.uid }, { merge: true });
      return NextResponse.json({ ok: true });
    }

    if (operation === "addService") {
      const role = (await db.collection("users").doc(user.uid).get()).data()?.role;
      if (role !== "admin") return fail("Administrators only.", 403);
      const name = String(input.name ?? "").trim();
      const scope = String(input.scope ?? "").trim();
      if (name.length < 3 || name.length > 60) return fail("Service name must be 3 to 60 characters.");
      if (scope.length > 180) return fail("Service description must be 180 characters or fewer.");
      const id = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
      if (id.length < 2 || CATEGORIES.some((category) => category.id === id)) return fail("That service name already exists or cannot be used.");
      const ref = db.collection("serviceControls").doc(id);
      if ((await ref.get()).exists) return fail("A service with that name already exists.");
      await ref.set({ custom: true, name, scope, enabled: true, createdAt: new Date().toISOString(), createdBy: user.uid });
      return NextResponse.json({ ok: true, categoryId: id });
    }

    if (operation === "setWorkerServices") {
      const role = (await db.collection("users").doc(user.uid).get()).data()?.role;
      if (role !== "worker") return fail("Only worker accounts can manage their offered services.", 403);
      if (!input.workerId || !Array.isArray(input.serviceIds) || input.serviceIds.length < 1 || input.serviceIds.length > 20
        || input.serviceIds.some((id) => typeof id !== "string" || !/^[a-z0-9-]{2,60}$/.test(id))) {
        return fail("Select at least one valid service.");
      }
      const serviceIds = [...new Set(input.serviceIds)];
      const controls = await db.collection("serviceControls").get();
      const customIds = controls.docs.filter((item) => item.data().custom === true).map((item) => item.id);
      const knownIds = new Set([...CATEGORIES.map((category) => category.id), ...customIds]);
      if (serviceIds.some((id) => !knownIds.has(id))) return fail("One of your selected services is no longer available.");
      if (serviceIds.some((id) => controls.docs.find((item) => item.id === id)?.data().enabled === false)) return fail("Remove disabled services from your profile, or choose another service.");
      const workerRef = db.collection("workers").doc(input.workerId);
      const worker = (await workerRef.get()).data();
      if (!worker || worker.uid !== user.uid) return fail("This worker profile does not belong to you.", 403);
      await workerRef.update({ serviceIds, categoryId: serviceIds[0], updatedAt: new Date().toISOString() });
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
      const offered = Array.isArray(worker.serviceIds) && worker.serviceIds.length ? worker.serviceIds : [String(worker.categoryId)];
      const allowedSkills = [...new Set(offered.flatMap((id: string) => SKILLS_BY_CATEGORY[id] ?? []))];
      const skills = [...new Set(input.skills.map((skill) => skill.trim()).filter(Boolean))];
      if (skills.some((skill) => !allowedSkills.includes(skill))) return fail("Choose skills from your listed trade.");
      await workerRef.update({ skills, updatedAt: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }

    if (operation === "notifyWorkerNewRequest") {
      if (!input.jobId) return fail("Missing job.");
      const callerIsAdmin = (await db.collection("users").doc(user.uid).get()).data()?.role === "admin";
      const jobRef = db.collection("jobs").doc(input.jobId);
      const shouldSend = await db.runTransaction(async (tx) => {
        const snap = await tx.get(jobRef);
        const job = snap.data();
        if (!job || (!callerIsAdmin && job.consumerId !== user.uid) || job.status !== "requested") {
          throw new MarketplaceError("This request is no longer available to notify.");
        }
        if (job.workerRequestEmailSentAt) return false;
        const claimedAt = Date.parse(String(job.workerRequestEmailClaimedAt ?? ""));
        if (Number.isFinite(claimedAt) && Date.now() - claimedAt < 2 * 60 * 1000) return false;
        tx.update(jobRef, { workerRequestEmailClaimedAt: new Date().toISOString() });
        return true;
      });
      if (!shouldSend) return NextResponse.json({ ok: true, emailSent: Boolean((await jobRef.get()).data()?.workerRequestEmailSentAt) });

      const jobSnap = await jobRef.get();
      const job = jobSnap.data()!;
      let reason = "unknown";
      try {
        const to = await getSignupEmail(db, auth, String(job.workerUid ?? ""));
        if (to) {
          const link = new URL("/dashboard/worker", request.nextUrl.origin).toString();
          const delivery = await sendTransactionalEmailDetailed({
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
          if (delivery.ok) {
            await jobRef.update({
              workerRequestEmailSentAt: new Date().toISOString(),
              workerRequestEmailClaimedAt: FieldValue.delete(),
            });
            return NextResponse.json({ ok: true, emailSent: true, recipient: callerIsAdmin ? to : undefined });
          }
          reason = delivery.reason;
        } else {
          console.warn("[email] worker account has no sign-up email.");
          reason = "no_signup_email";
        }
      } catch (error) {
        console.error("[email] worker request alert failed.", error);
        reason = "request_error";
      }
      await jobRef.update({ workerRequestEmailClaimedAt: FieldValue.delete() });
      return NextResponse.json({ ok: true, emailSent: false, reason });
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
        if (!worker || worker.uid !== user.uid || !worker.verified || !["active", "paused_wallet"].includes(String(worker.status))) {
          throw new Error("Only an active, verified worker can accept.");
        }
        tx.update(jobRef, {
          status: "accepted",
          acceptedAt: new Date().toISOString(),
          workerPhone: workerUserSnap.data()?.phone ?? "",
          consumerPhone: customerUserSnap.data()?.phone ?? "",
        });
        if (worker.status === "paused_wallet") tx.update(workerRef, { status: "active" });
      });
      await sendJobStageEmail(db, auth, input.jobId, "request_accepted", request.nextUrl.origin);
      return NextResponse.json({ ok: true });
    }

    if (operation === "confirmJobAgreement") {
      if (!input.jobId) return fail("Missing job.");
      const jobRef = db.collection("jobs").doc(input.jobId);
      const agreement = await db.runTransaction(async (tx) => {
        const snap = await tx.get(jobRef);
        const job = snap.data();
        if (!job || ![job.workerUid, job.consumerId].includes(user.uid) || !["accepted", "quoted"].includes(String(job.status))) {
          throw new MarketplaceError("This job is not waiting for an agreement confirmation.");
        }
        const isWorker = job.workerUid === user.uid;
        const field = isWorker ? "workerAgreedAt" : "consumerAgreedAt";
        if (job[field]) return { started: Boolean(job.agreementApprovedAt) };
        const now = new Date().toISOString();
        const otherConfirmed = isWorker ? Boolean(job.consumerAgreedAt) : Boolean(job.workerAgreedAt);
        const patch: Record<string, unknown> = { [field]: now };
        if (otherConfirmed) {
          patch.status = "in_progress";
          patch.agreementApprovedAt = now;
        }
        tx.update(jobRef, patch);
        return { started: otherConfirmed };
      });
      if (agreement.started) {
        await Promise.all([
          sendJobStageEmail(db, auth, input.jobId, "agreement_confirmed", request.nextUrl.origin),
          sendJobStageEmail(db, auth, input.jobId, "agreement_confirmed_customer", request.nextUrl.origin),
        ]);
      }
      return NextResponse.json({ ok: true, started: agreement.started });
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
        if (!worker || !worker.verified || !["active", "paused_wallet"].includes(String(worker.status)) || worker.uid !== job.workerUid) {
          throw new Error("This worker is not active.");
        }
        tx.update(jobRef, {
          status: "in_progress",
          quoteApprovedAt: new Date().toISOString(),
          agreementApprovedAt: new Date().toISOString(),
        });
      });
      await sendJobStageEmail(db, auth, input.jobId, "quote_approved", request.nextUrl.origin);
      return NextResponse.json({ ok: true });
    }

    if (operation === "completeJob") {
      if (!input.jobId) return fail("Missing job.");
      const jobRef = db.collection("jobs").doc(input.jobId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(jobRef);
        const job = snap.data();
        if (!job || job.workerUid !== user.uid || job.status !== "in_progress") throw new Error("This job cannot be marked complete.");
        const workerRef = db.collection("workers").doc(job.workerId);
        const workerSnap = await tx.get(workerRef);
        const worker = workerSnap.data();
        if (!worker || worker.uid !== user.uid) throw new Error("Worker profile not found.");
        const isFirstJob = Number(worker.jobsCompleted ?? 0) === 0;
        const referrerQuery = isFirstJob && worker.referredBy
          ? await tx.get(db.collection("workers").where("referralCode", "==", worker.referredBy).limit(1))
          : null;
        const referrerDoc = referrerQuery?.docs[0];
        const referrer = referrerDoc?.data();
        tx.update(jobRef, {
          status: "completed",
          completedAt: new Date().toISOString(),
        });
        tx.update(workerRef, { jobsCompleted: Number(worker.jobsCompleted ?? 0) + 1 });
        if (referrerDoc && referrer && referrerDoc.id !== job.workerId) {
          tx.update(referrerDoc.ref, { referralCredits: Number(referrer.referralCredits ?? 0) + 1 });
        }
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
        if (!job || job.consumerId !== user.uid || job.status !== "completed" || (!job.settledAt && !job.agreementApprovedAt)) {
          throw new Error("Only the customer can review a completed job.");
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
      const required = ["government_id", "barangay_clearance"];
      if (!Array.isArray(docs) || !required.every((type) => docs.some((item) => item.type === type))
        || docs.some((item) => !["government_id", "barangay_clearance", "recommendation_letter", "tesda_certificate"].includes(item.type)
          || !item.fileUrl.startsWith("credentials/" + user.uid + "/"))) {
        return fail("Upload your government ID and barangay or police clearance.");
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
        const needsFreshFiles = docs.length < 2 || docs.some((item: { fileUrl?: string }) =>
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
