import { NextRequest, NextResponse } from "next/server";
import { adminServices } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type Operation = "acceptJob" | "approveQuote" | "settleJob" | "submitReview" | "approveTopUp" | "rejectTopUp" | "migrateLegacyWorkers" | "resubmitCredentials";

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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
      requestId?: string;
      rating?: number;
      text?: string;
      credentials?: Array<{ type: string; fileName: string; fileUrl: string; uploadedAt: string; reviewState: string }>;
    };
    const operation = input.operation;
    if (!operation) return fail("Missing operation.");

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
          throw new Error("The worker needs more prepaid commission balance before this quote can be approved.");
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
      return NextResponse.json({ ok: true });
    }

    if (operation === "settleJob") {
      if (!input.jobId) return fail("Missing job.");
      const jobRef = db.collection("jobs").doc(input.jobId);
      await db.runTransaction(async (tx) => {
        const jobSnap = await tx.get(jobRef);
        const job = jobSnap.data();
        if (!job || job.workerUid !== user.uid || job.status !== "completed" || job.settledAt) {
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
      });
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
          tx.update(topUpRef, { status: "rejected", reviewedBy: user.uid, reviewedAt: new Date().toISOString() });
          return;
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
    console.error("[marketplace]", error);
    return fail(error instanceof Error ? error.message : "Could not complete the action.", 400);
  }
}
