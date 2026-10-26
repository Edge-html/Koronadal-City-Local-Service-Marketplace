import { NextResponse } from "next/server";
import { adminServices } from "@/lib/firebase-admin";
import { CATEGORIES, type Category } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { db } = adminServices();
    const snapshot = await db.collection("serviceControls").get();
    const controls = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
    const disabledIds = snapshot.docs.filter((item) => item.data().enabled === false).map((item) => item.id);
    const builtIn = CATEGORIES.map((category) => {
      const saved = controls.get(category.id);
      return {
        ...category,
        ...(saved?.name ? { name: String(saved.name), scope: String(saved.scope ?? category.scope) } : {}),
        enabled: saved?.enabled !== false,
      };
    });
    const custom = snapshot.docs
      .filter((item) => item.data().custom === true)
      .map((item) => ({
        id: item.id,
        name: String(item.data().name ?? item.id),
        scope: String(item.data().scope ?? ""),
        useCases: String(item.data().scope ?? ""),
        floor: 0,
        enabled: item.data().enabled !== false,
      } satisfies Category));
    return NextResponse.json({ categories: [...builtIn, ...custom], disabledIds });
  } catch (error) {
    console.error("[services] catalog read failed", error);
    return NextResponse.json({ disabledIds: [] }, { status: 200 });
  }
}
