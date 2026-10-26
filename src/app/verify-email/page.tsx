"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Card, Notice } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

function VerifyEmailContent() {
  const { user, sendVerificationEmail, logout } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = params.get("next")?.startsWith("/") && !params.get("next")?.startsWith("//") ? params.get("next")! : "/dashboard";

  async function resend() {
    setBusy(true); setError(""); setMessage("");
    try { await sendVerificationEmail(); setMessage(`A new verification link was sent to ${user?.email ?? "your email"}.`); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not send the verification link."); }
    finally { setBusy(false); }
  }

  async function continueAfterVerification() {
    setBusy(true); setError("");
    try {
      await user?.reload();
      if (user?.emailVerified) router.replace(next);
      else setError("Your email is not verified yet. Open the link in your inbox, then try again.");
    } catch { setError("Could not check the email status. Try again."); }
    finally { setBusy(false); }
  }

  return <AuthShell eyebrow="Verify your email" title="Check your inbox" description="We sent a verification link to the email address you registered with.">
    <Card className="flex flex-col gap-4 p-6">
      {error ? <Notice tone="alert">{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}
      <p className="text-sm text-stone-700">{user?.email ?? "Your registered email"}</p>
      <button type="button" className="btn-primary w-full" disabled={busy} onClick={continueAfterVerification}>{busy ? "Checking…" : "I verified my email"}</button>
      <button type="button" className="btn-neutral w-full" disabled={busy || !user} onClick={resend}>{busy ? "Sending…" : "Resend verification link"}</button>
      <p className="caption text-center">If you don&apos;t see it, check Spam or Promotions.</p>
      <Link href="/login" className="text-center text-sm text-stone-700 underline">Return to sign in</Link>
      {user ? <button type="button" className="btn-ghost" onClick={() => logout()}>Use a different account</button> : null}
    </Card>
  </AuthShell>;
}

export default function VerifyEmailPage() {
  return <Suspense fallback={null}><VerifyEmailContent /></Suspense>;
}
