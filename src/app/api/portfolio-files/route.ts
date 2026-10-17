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
    const userData = (await db.collection("users").doc(user.uid).get()).data();
    if (userData?.role !== "worker") return NextResponse.json({ error: "Worker accounts only." }, { status: 403 });

    const form = await request.formData();
    const workerId = String(form.get("workerId") ?? "");
    const entryId = String(form.get("entryId") ?? "");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(workerId) || !/^[A-Za-z0-9_-]{1,128}$/.test(entryId)) {
      return NextResponse.json({ error: "Invalid portfolio entry." }, { status: 400 });
    }
    const worker = (await db.collection("workers").doc(workerId).get()).data();
    if (!worker || worker.uid !== user.uid) return NextResponse.json({ error: "Access denied." }, { status: 403 });

    const before = form.get("before");
    const after = form.get("after");
    if (!(before instanceof File) && !(after instanceof File)) {
      return NextResponse.json({ error: "Choose a before or after photo." }, { status: 400 });
    }
    const paths: { beforePath?: string; afterPath?: string } = {};
    for (const [side, value] of [["before", before], ["after", after]] as const) {
      if (!(value instanceof File)) continue;
      if (!value.size || value.size > 4 * 1024 * 1024) {
        return NextResponse.json({ error: "Each photo must be smaller than 4 MB." }, { status: 400 });
      }
      if (!IMAGE_TYPES.includes(value.type)) {
        return NextResponse.json({ error: "Use JPG, PNG, or WebP photos." }, { status: 400 });
      }
      const path = `worker-portfolio/${user.uid}/${entryId}-${side}-${randomUUID()}`;
      await uploadPrivateFile(path, value);
      paths[side === "before" ? "beforePath" : "afterPath"] = path;
    }
    return NextResponse.json(paths);
  } catch (error) {
    console.error("[portfolio-file-upload]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Photo upload failed." }, { status: 400 });
  }
}

/** Portfolio photos are public only through an entry on a verified worker profile. */
export async function GET(request: NextRequest) {
  try {
    const workerId = request.nextUrl.searchParams.get("workerId") ?? "";
    const entryId = request.nextUrl.searchParams.get("entryId") ?? "";
    const side = request.nextUrl.searchParams.get("side");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(workerId)
      || !/^[A-Za-z0-9_-]{1,128}$/.test(entryId)
      || (side !== "before" && side !== "after")) return new NextResponse(null, { status: 404 });

    const { db } = adminServices();
    const worker = (await db.collection("workers").doc(workerId).get()).data();
    if (!worker?.verified || !Array.isArray(worker.portfolio)) return new NextResponse(null, { status: 404 });
    const entry = worker.portfolio.find((item: { id?: string }) => item.id === entryId);
    const path = side === "before" ? entry?.beforePath : entry?.afterPath;
    if (typeof path !== "string" || !path.startsWith(`worker-portfolio/${worker.uid}/${entryId}-${side}-`)) {
      return new NextResponse(null, { status: 404 });
    }
    const file = await downloadPrivateFile(path);
    return new NextResponse(new Uint8Array(await file.arrayBuffer()), { headers: {
      "content-type": file.type || "application/octet-stream",
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
    } });
  } catch (error) {
    console.error("[portfolio-file-read]", error);
    return new NextResponse(null, { status: 404 });
  }
}
