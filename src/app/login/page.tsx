"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthShell, friendlyAuthError } from "@/components/AuthShell";
import { Notice } from "@/components/ui";

function LoginForm() {
  const { signIn, resetPassword } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const next = params.get("next") || "/dashboard";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email, password);
      router.push(next);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your account"
      description="Households find verified workers. Workers manage requests, chat agreements, and completed jobs."
      imageSrc="/images/teamwork.webp"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error ? <Notice tone="alert">{error}</Notice> : null}

        <div>
          <label className="label" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 characters"
          />
        </div>

        <div className="-mt-2 flex justify-end">
          <button type="button" className="text-xs text-stone-700 underline underline-offset-2" disabled={resetBusy || !email.trim()} onClick={async () => {
            setResetBusy(true); setResetMessage(""); setError("");
            try { await resetPassword(email.trim()); setResetMessage("If an account exists for this email, Firebase sent a password reset link. Check your inbox and Spam folder."); }
            catch (err) { setError(err instanceof Error ? err.message : "Could not send a password reset link."); }
            finally { setResetBusy(false); }
          }}>{resetBusy ? "Sending reset link…" : "Forgot password?"}</button>
        </div>
        {resetMessage ? <Notice>{resetMessage}</Notice> : null}

        <button type="submit" className="btn-primary mt-2 w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
              Signing in
            </>
          ) : (
            <>
              Sign in
              <ArrowRight size={14} strokeWidth={1.5} />
            </>
          )}
        </button>

        <p className="meta pt-2 text-center">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-stone-800 underline underline-offset-2 hover:text-ink-black"
          >
            Create one
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
