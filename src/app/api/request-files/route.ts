import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminServices } from "@/lib/firebase-admin";
import { downloadPrivateFile, uploadPrivateFile } from "@/lib/supabase-storage";

export const runtime = "nodejs";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  try {
    const { auth, db } = adminServices();
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const user = await auth.verifyIdToken(token);
    const role = (await db.collection("users").doc(user.uid).get()).data()?.role;
    if (role !== "customer") return NextResponse.json({ error: "Household accounts only." }, { status: 403 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo." }, { status: 400 });
    if (!file.size || file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Photos must be smaller than 4 MB." }, { status: 400 });
    if (!IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: "Choose a JPG, PNG, or WebP photo." }, { status: 400 });

    const path = `job-requests/${user.uid}/${randomUUID()}`;
    await uploadPrivateFile(path, file);
    return NextResponse.json({ path });
  } catch (error) {
    console.error("[request-photo-upload]", error);
    const message = error instanceof Error ? error.message : "Photo upload failed.";
    if (/bucket.*not found|bucket.*does not exist/i.test(message)) {
      return NextResponse.json({ error: "The private-files bucket was not found in Supabase Storage." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { auth, db } = adminServices();
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return new NextResponse(null, { status: 401 });
    const user = await auth.verifyIdToken(token);
    const jobId = request.nextUrl.searchParams.get("jobId") ?? "";
    const path = request.nextUrl.searchParams.get("path") ?? "";
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(jobId) || !/^job-requests\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9-]+$/.test(path)) {
      return new NextResponse(null, { status: 404 });
    }
    const job = (await db.collection("jobs").doc(jobId).get()).data();
    const ownerUid = path.split("/")[1];
    if (!job || job.photoPath !== path || job.consumerId !== ownerUid
      || (job.consumerId !== user.uid && job.workerUid !== user.uid)) {
      return new NextResponse(null, { status: 404 });
    }
    const file = await downloadPrivateFile(path);
    return new NextResponse(new Uint8Array(await file.arrayBuffer()), { headers: {
      "content-type": file.type || "application/octet-stream",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
    } });
  } catch (error) {
    console.error("[request-photo-read]", error);
    return new NextResponse(null, { status: 404 });
  }
}
