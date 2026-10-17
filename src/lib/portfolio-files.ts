import { getFirebaseAuth } from "@/lib/firebase";

export async function uploadPortfolioImages(
  workerId: string,
  entryId: string,
  before: File | null,
  after: File | null,
) {
  const token = await getFirebaseAuth().currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to continue.");
  const form = new FormData();
  form.set("workerId", workerId);
  form.set("entryId", entryId);
  if (before) form.set("before", before);
  if (after) form.set("after", after);
  const response = await fetch("/api/portfolio-files", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  const result = await response.json().catch(() => null) as {
    beforePath?: string;
    afterPath?: string;
    error?: string;
  } | null;
  if (!response.ok || !result) throw new Error(result?.error || "Could not upload portfolio photos.");
  return result;
}

export function portfolioImageUrl(workerId: string, entryId: string, side: "before" | "after") {
  return `/api/portfolio-files?workerId=${encodeURIComponent(workerId)}&entryId=${encodeURIComponent(entryId)}&side=${side}`;
}
