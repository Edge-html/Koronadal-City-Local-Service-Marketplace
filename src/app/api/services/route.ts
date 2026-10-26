import { NextResponse } from "next/server";
import { adminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { db } = adminServices();
    const snapshot = await db.collection("serviceControls").get();
    const disabledIds = snapshot.docs.filter((item) => item.data().enabled === false).map((item) => item.id);
    return NextResponse.json({ disabledIds });
  } catch (error) {
    console.error("[services] catalog read failed", error);
    return NextResponse.json({ disabledIds: [] }, { status: 200 });
  }
}
