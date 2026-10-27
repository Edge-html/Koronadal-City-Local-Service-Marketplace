import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminServices } from "@/lib/firebase-admin";
import { downloadPrivateFile, uploadPrivateFile } from "@/lib/supabase-storage";

export const runtime = "nodejs";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function caller(request: NextRequest) {
  const { auth, db } = adminServices();
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("Sign in to continue.");
  const user = await auth.verifyIdToken(token);
  const role = (await db.collection("users").doc(user.uid).get()).data()?.role;
  if (role !== "worker" && role !== "admin") throw new Error("Worker or administrator accounts only.");
  return { user, role };
}

export async function POST(request: NextRequest) {
  try {
    const { user, role } = await caller(request);
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
    if (!file.size || file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Images must be smaller than 4 MB." }, { status: 400 });
    if (!IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: "Choose a JPG, PNG, or WebP image." }, { status: 400 });

    let path: string;
    if (kind === "qr" && role === "admin") {
      path = `pro-payment-qr/${randomUUID()}`;
    } else if (kind === "receipt" && role === "worker") {
      const { db } = adminServices();
      const worker = (await db.collection("workers").where("uid", "==", user.uid).limit(1).get()).docs[0]?.data();
      if (!worker || !worker.verified || worker.status !== "active") {
        return NextResponse.json({ error: "An approved worker profile is required to submit Pro payment." }, { status: 403 });
      }
      path = `pro-payment-receipts/${user.uid}/${randomUUID()}`;
    } else {
      return NextResponse.json({ error: "You are not allowed to upload this payment image." }, { status: 403 });
    }

    await uploadPrivateFile(path, file);
    return NextResponse.json({ path });
  } catch (error) {
    console.error("[pro-payment-upload]", error);
    const message = error instanceof Error ? error.message : "Payment image upload failed.";
    const status = message === "Sign in to continue." ? 401 : message.includes("accounts only") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, role } = await caller(request);
    const path = request.nextUrl.searchParams.get("path") ?? "";
    const isQr = /^pro-payment-qr\/[A-Za-z0-9-]{16,80}$/.test(path);
    const receiptMatch = path.match(/^pro-payment-receipts\/([A-Za-z0-9_-]{1,128})\/[A-Za-z0-9-]{16,80}$/);
    if (!isQr && !receiptMatch) return new NextResponse(null, { status: 404 });
    if (receiptMatch && receiptMatch[1] !== user.uid && role !== "admin") return new NextResponse(null, { status: 404 });

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
    console.error("[pro-payment-read]", error);
    return new NextResponse(null, { status: 404 });
  }
}
