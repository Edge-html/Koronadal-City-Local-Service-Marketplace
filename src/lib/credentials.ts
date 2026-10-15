import { getFirebaseAuth } from "@/lib/firebase";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in to access credentials.");
  return value;
}

export async function uploadCredential(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/credentials", {
    method: "POST",
    headers: { authorization: "Bearer " + await token() },
    body: form,
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const result = isJson
    ? await response.json().catch(() => null) as { error?: string; path?: string } | null
    : null;
  if (!response.ok) {
    throw new Error(result?.error || `Document upload failed (HTTP ${response.status}). Please try again.`);
  }
  if (!result?.path) throw new Error("The server returned an unexpected upload response.");
  return result.path;
}

export async function openCredential(path: string): Promise<void> {
  if (!path.startsWith("credentials/")) {
    throw new Error("This older document was not stored permanently. Ask the applicant to upload it again.");
  }
  const popup = window.open("about:blank", "_blank");
  const response = await fetch("/api/credentials?path=" + encodeURIComponent(path), {
    headers: { authorization: "Bearer " + await token() },
  });
  if (!response.ok) {
    popup?.close();
    throw new Error("Could not open this document.");
  }
  const url = URL.createObjectURL(await response.blob());
  if (popup) popup.location.href = url;
  else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
