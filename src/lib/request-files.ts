import { getFirebaseAuth } from "@/lib/firebase";

export async function uploadRequestPhoto(file: File) {
  const token = await getFirebaseAuth().currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to continue.");
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/request-files", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  const result = await response.json().catch(() => null) as { path?: string; error?: string } | null;
  if (!response.ok || !result?.path) throw new Error(result?.error || "Could not upload the photo.");
  return result.path;
}

