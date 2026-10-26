import { NextResponse } from "next/server";

export const runtime = "nodejs";

function retired() {
  return NextResponse.json({ error: "KoroHanap no longer collects wallet top-ups or payment proofs. Agree on direct payment in the job chat." }, { status: 410 });
}

export async function POST() {
  return retired();
}

export async function GET() {
  return retired();
}
