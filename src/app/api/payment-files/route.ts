import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { adminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";

async function caller(request: NextRequest) {
  const { auth, db } = adminServices();
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("Sign in to continue.");
  const user = await auth.verifyIdToken(token);
  const role = (await db.collection("users").doc(user.uid).get()).data()?.role;
  return { user, role };
}

function bucket() {
  const name = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!name) throw new Error("Firebase Storage bucket is not configured.");
  return getStorage().bucket(name);
}

export async function POST(request: NextRequest) {
  try {
    const { user, role } = await caller(request);
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
    if (kind !== "receipt" && kind !== "qr") return NextResponse.json({ error: "Invalid payment file type." }, { status: 400 });
    if (kind === "qr" && role !== "admin") return NextResponse.json({ error: "Administrators only." }, { status: 403 });
    if (kind === "receipt" && role !== "worker") return NextResponse.json({ error: "Worker accounts only." }, { status: 403 });
    if (file.size === 0 || file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Images must be smaller than 4 MB." }, { status: 400 });
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 400 });
    }
    const prefix = kind === "qr" ? "payment-qr" : "topup-receipts";
    const path = `${prefix}/${user.uid}/${randomUUID()}`;
    await bucket().file(path).save(Buffer.from(await file.arrayBuffer()), {
      resumable: false,
      contentType: file.type,
      metadata: { cacheControl: "private, no-store" },
    });
    return NextResponse.json({ path });
  } catch (error) {
    console.error("[payment-file-upload]", error);
    const message = error instanceof Error ? error.message : "";
    if (/specified bucket does not exist|bucket.*not found/i.test(message)) {
      return NextResponse.json({
        error: "Firebase Storage has no bucket yet. You can save the GCash number without a QR for now. To enable QR uploads, create the default Storage bucket in Firebase Console and set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in Vercel to the bucket name shown there.",
      }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, role } = await caller(request);
    const path = request.nextUrl.searchParams.get("path") ?? "";
    const valid = /^(payment-qr|topup-receipts)\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+$/.test(path);
    if (!valid) return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
    if (path.startsWith("payment-qr/") && role !== "worker" && role !== "admin") {
      return NextResponse.json({ error: "Worker accounts only." }, { status: 403 });
    }
    if (path.startsWith("topup-receipts/")
      && !path.startsWith(`topup-receipts/${user.uid}/`)
      && role !== "admin") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    const file = bucket().file(path);
    const [metadata] = await file.getMetadata();
    const [bytes] = await file.download();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": metadata.contentType || "application/octet-stream",
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
