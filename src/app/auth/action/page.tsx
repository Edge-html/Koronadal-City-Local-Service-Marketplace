"use client";

import Link from "next/link";
import { type FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { AuthShell } from "@/components/AuthShell";
import { Card, Notice } from "@/components/ui";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase";

type ActionState = "loading" | "verified" | "recovered" | "reset" | "resetDone" | "error";

function AuthActionContent() {
  const params = useSearchParams();
  const mode = params.get("mode");
  const code = params.get("oobCode");
  const started = useRef<string | null>(null);
  const [state, setState] = useState<ActionState>("loading");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!mode || !code) {
      setError("This email link is incomplete. Request a fresh link and try again.");
      setState("error");
      return;
    }
    if (!firebaseConfigured) {
      setError("KoroHanap cannot complete this link right now. Please try again later.");
      setState("error");
      return;
    }

    // React Strict Mode can re-run effects during local development. Avoid
    // applying a one-time verification code twice in the same page session.
    const actionId = `${mode}:${code}`;
    if (started.current === actionId) return;
    started.current = actionId;

    const auth = getFirebaseAuth();
    if (mode === "verifyEmail") {
      void applyActionCode(auth, code)
        .then(() => setState("verified"))
        .catch(() => {
          setError("This verification link may have expired or already been used. Request a fresh link from KoroHanap and try again.");
          setState("error");
        });
      return;
    }

    if (mode === "recoverEmail") {
      void applyActionCode(auth, code)
        .then(() => setState("recovered"))
        .catch(() => {
          setError("This recovery link may have expired or already been used. Contact support if you still need help.");
          setState("error");
        });
      return;
    }

    if (mode === "resetPassword") {
      void verifyPasswordResetCode(auth, code)
        .then((accountEmail) => {
          setEmail(accountEmail);
          setState("reset");
        })
        .catch(() => {
          setError("This password reset link may have expired or already been used. Request a new link and try again.");
          setState("error");
        });
      return;
    }

    setError("This email link type is not supported.");
    setState("error");
  }, [mode, code]);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Choose a password with at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (!code) return;

    setBusy(true);
    try {
      await confirmPasswordReset(getFirebaseAuth(), code, password);
      setPassword("");
      setConfirmPassword("");
      setState("resetDone");
    } catch {
      setError("The password could not be changed. Request a new reset link and try again.");
    } finally {
      setBusy(false);
    }
  }

  let title = "Checking your link";
  let description = "Please wait while KoroHanap securely processes your request.";
  if (state === "verified") {
    title = "Email verified";
    description = "Your email address is confirmed. You can now sign in to KoroHanap.";
  } else if (state === "recovered") {
    title = "Email recovered";
    description = "Your account email has been restored. You can return to KoroHanap.";
  } else if (state === "reset") {
    title = "Choose a new password";
    description = `Set a new password for ${email}.`;
  } else if (state === "resetDone") {
    title = "Password updated";
    description = "Your new password is ready. Sign in with it to continue.";
  } else if (state === "error") {
    title = "We couldn’t complete that link";
    description = "The link could not be used. You can request a new one and try again.";
  }

  return <AuthShell eyebrow="Account security" title={title} description={description}>
    <Card className="flex flex-col gap-4 p-6">
      {state === "loading" ? <p className="text-sm text-stone-600">Checking your secure link…</p> : null}
      {error ? <Notice tone="alert">{error}</Notice> : null}

      {state === "reset" ? (
        <form className="flex flex-col gap-4" onSubmit={savePassword}>
          <label className="flex flex-col gap-2 text-sm text-stone-700">
            New password
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-stone-700">
            Confirm new password
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      ) : null}

      {state === "verified" || state === "recovered" || state === "resetDone" ? (
        <Link href="/login" className="btn-primary w-full text-center">Return to sign in</Link>
      ) : null}

      {state === "error" ? <Link href="/login" className="btn-neutral w-full text-center">Go to sign in</Link> : null}
    </Card>
  </AuthShell>;
}

export default function AuthActionPage() {
  return <Suspense fallback={<AuthShell eyebrow="Account security" title="Checking your link" description="Please wait while KoroHanap securely processes your request."><Card className="p-6">Checking your secure link…</Card></AuthShell>}><AuthActionContent /></Suspense>;
}
