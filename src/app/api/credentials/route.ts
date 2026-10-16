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
  return { user, db };
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await caller(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
    if (file.size === 0 || file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Files must be smaller than 4 MB." }, { status: 400 });
    }
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return NextResponse.json({ error: "Use a PDF or image." }, { status: 400 });
    }
    const path = "credentials/" + user.uid + "/" + randomUUID();
    await uploadPrivateFile(path, file);
    return NextResponse.json({ path });
  } catch (error) {
    console.error("[credentials-upload]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, db } = await caller(request);
    const path = request.nextUrl.searchParams.get("path");
    if (!path || !/^credentials\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+$/.test(path)) {
      return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
    }
    const role = (await db.collection("users").doc(user.uid).get()).data()?.role;
    if (!path.startsWith("credentials/" + user.uid + "/") && role !== "admin") {
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
    console.error("[credentials-read]", error);
    return NextResponse.json({ error: "Could not open this document." }, { status: 400 });
  }
}
