import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminServices } from "@/lib/firebase-admin";
import { downloadPrivateFile, uploadPrivateFile } from "@/lib/supabase-storage";

export const runtime = "nodejs";

async function caller(request: NextRequest) {
  const { auth, db } = adminServices();
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("Sign in to continue.");
  const user = await auth.verifyIdToken(token);
  const role = (await db.collection("users").doc(user.uid).get()).data()?.role;
  return { user, role };
}

export async function POST(request: NextRequest) {
  try {
    const { user, role } = await caller(request);
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    const jobId = typeof form.get("jobId") === "string" ? String(form.get("jobId")) : "";
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
    if (kind !== "receipt" && kind !== "qr" && kind !== "worker-qr" && kind !== "job-payment") return NextResponse.json({ error: "Invalid payment file type." }, { status: 400 });
    if (kind === "qr" && role !== "admin") return NextResponse.json({ error: "Administrators only." }, { status: 403 });
    if (kind === "receipt" && role !== "worker") return NextResponse.json({ error: "Worker accounts only." }, { status: 403 });
    if ((kind === "worker-qr" && role !== "worker") || (kind === "job-payment" && role !== "customer" && role !== "worker")) return NextResponse.json({ error: "This account cannot upload that payment file." }, { status: 403 });
    if (kind === "job-payment") {
      if (!jobId || !/^[A-Za-z0-9_-]{1,128}$/.test(jobId)) return NextResponse.json({ error: "Choose a valid job." }, { status: 400 });
      const job = (await adminServices().db.collection("jobs").doc(jobId).get()).data();
      if (!job || job.consumerId !== user.uid || job.status !== "completed" || job.settledAt) return NextResponse.json({ error: "This job is not waiting for your payment proof." }, { status: 403 });
    }
    if (file.size === 0 || file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Images must be smaller than 4 MB." }, { status: 400 });
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 400 });
    }
    const prefix = kind === "qr" ? "payment-qr" : kind === "receipt" ? "topup-receipts" : kind === "worker-qr" ? "worker-payment-qr" : `job-payment-proofs/${jobId}`;
    const path = kind === "job-payment" ? `${prefix}/${user.uid}/${randomUUID()}` : `${prefix}/${user.uid}/${randomUUID()}`;
    await uploadPrivateFile(path, file);
    return NextResponse.json({ path });
  } catch (error) {
    console.error("[payment-file-upload]", error);
    const message = error instanceof Error ? error.message : "";
    if (/bucket.*not found|bucket.*does not exist/i.test(message)) {
      return NextResponse.json({
        error: "The private-files bucket was not found in Supabase Storage. Create a private bucket named private-files in your Supabase project.",
      }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, role } = await caller(request);
    const path = request.nextUrl.searchParams.get("path") ?? "";
    const valid = /^(payment-qr|topup-receipts|worker-payment-qr)\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+$/.test(path)
      || /^job-payment-proofs\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+$/.test(path);
    if (!valid) return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
    if (path.startsWith("payment-qr/") && role !== "worker" && role !== "admin") {
      return NextResponse.json({ error: "Worker accounts only." }, { status: 403 });
    }
    if (path.startsWith("worker-payment-qr/")) {
      const jobId = request.nextUrl.searchParams.get("jobId") ?? "";
      const job = jobId ? (await adminServices().db.collection("jobs").doc(jobId).get()).data() : null;
      if (!job || (job.workerUid !== user.uid && job.consumerId !== user.uid && role !== "admin") || job.paymentQrPath !== path) return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    if (path.startsWith("job-payment-proofs/")) {
      const [, jobId, ownerUid] = path.split("/");
      const job = (await adminServices().db.collection("jobs").doc(jobId).get()).data();
      if (!job || job.paymentProofPath !== path || (user.uid !== ownerUid && user.uid !== job.workerUid && role !== "admin")) return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    if (path.startsWith("topup-receipts/")
      && !path.startsWith(`topup-receipts/${user.uid}/`)
      && role !== "admin") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    const file = await downloadPrivateFile(path);
    return new NextResponse(new Uint8Array(await file.arrayBuffer()), {
      headers: {
        "content-type": file.type || "application/octet-stream",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox",
      },
    });
  } catch (error) {
    console.error("[payment-file-read]", error);
    return NextResponse.json({ error: "Could not open this payment image." }, { status: 400 });
  }
}
