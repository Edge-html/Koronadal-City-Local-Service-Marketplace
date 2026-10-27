import { getFirebaseAuth } from "@/lib/firebase";

async function authorizationHeader() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in to access Pro payment images.");
  return { authorization: "Bearer " + value };
}

export async function uploadProPaymentImage(file: File, kind: "qr" | "receipt") {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const response = await fetch("/api/pro-payment-files", {
    method: "POST",
    headers: await authorizationHeader(),
    body: form,
  });
  const result = await response.json().catch(() => null) as { error?: string; path?: string } | null;
  if (!response.ok) throw new Error(result?.error ?? `Payment image upload failed (HTTP ${response.status}).`);
  if (!result?.path) throw new Error("The server returned an unexpected upload response.");
  return result.path;
}

export async function loadProPaymentImage(path: string) {
  const params = new URLSearchParams({ path });
  const response = await fetch("/api/pro-payment-files?" + params.toString(), {
    headers: await authorizationHeader(),
  });
  if (!response.ok) throw new Error("Could not open this payment image.");
  return URL.createObjectURL(await response.blob());
}
