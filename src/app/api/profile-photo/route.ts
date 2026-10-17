import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminServices } from "@/lib/firebase-admin";
import { downloadPrivateFile, uploadPrivateFile } from "@/lib/supabase-storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { auth, db } = adminServices();
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const user = await auth.verifyIdToken(token);
    const profileRef = db.collection("users").doc(user.uid);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists || !["customer", "worker"].includes(profileSnap.data()?.role)) return NextResponse.json({ error: "Only customer and worker accounts can set a profile photo." }, { status: 403 });
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Choose a photo smaller than 4 MB." }, { status: 400 });
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return NextResponse.json({ error: "Use a JPG, PNG, or WebP photo." }, { status: 400 });
    const path = `profile-photos/${user.uid}/${randomUUID()}`;
    await uploadPrivateFile(path, file);
    await profileRef.update({ photoPath: path, photoUrl: `/api/profile-photo?uid=${encodeURIComponent(user.uid)}&v=${Date.now()}` });
    const workers = await db.collection("workers").where("uid", "==", user.uid).limit(1).get();
    if (!workers.empty) await workers.docs[0].ref.update({ photoUrl: `/api/profile-photo?uid=${encodeURIComponent(user.uid)}&v=${Date.now()}` });
    return NextResponse.json({ photoUrl: `/api/profile-photo?uid=${encodeURIComponent(user.uid)}&v=${Date.now()}` });
  } catch (error) {
    console.error("[profile-photo-upload]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Photo upload failed." }, { status: 400 });
  }
}

/** Profile photos are intentionally public on worker listings; private documents stay on their own routes. */
export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid") ?? "";
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return new NextResponse(null, { status: 404 });
    const { db } = adminServices();
    const profile = (await db.collection("users").doc(uid).get()).data();
    const path = profile?.photoPath;
    if (typeof path !== "string" || !path.startsWith(`profile-photos/${uid}/`)) return new NextResponse(null, { status: 404 });
    const file = await downloadPrivateFile(path);
    return new NextResponse(new Uint8Array(await file.arrayBuffer()), { headers: {
      "content-type": file.type || "application/octet-stream",
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
    } });
  } catch (error) {
    console.error("[profile-photo-read]", error);
    return new NextResponse(null, { status: 404 });
  }
}
