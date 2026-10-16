import { getFirebaseAuth } from "@/lib/firebase";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in to access payment files.");
  return value;
}

export async function uploadPaymentImage(file: File, kind: "qr" | "receipt") {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const response = await fetch("/api/payment-files", {
    method: "POST",
    headers: { authorization: "Bearer " + await token() },
    body: form,
  });
  const result = response.headers.get("content-type")?.includes("application/json")
    ? await response.json().catch(() => null) as { error?: string; path?: string } | null
    : null;
  if (!response.ok) throw new Error(result?.error || `Image upload failed (HTTP ${response.status}).`);
  if (!result?.path) throw new Error("The server returned an unexpected upload response.");
  return result.path;
}

async function paymentImageBlob(path: string) {
  const response = await fetch("/api/payment-files?path=" + encodeURIComponent(path), {
    headers: { authorization: "Bearer " + await token() },
  });
  if (!response.ok) throw new Error("Could not open this payment image.");
  return response.blob();
}

export async function openPaymentImage(path: string) {
  const popup = window.open("about:blank", "_blank");
  try {
    const url = URL.createObjectURL(await paymentImageBlob(path));
    if (popup) popup.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}

export async function loadPaymentImage(path: string) {
  return URL.createObjectURL(await paymentImageBlob(path));
}
