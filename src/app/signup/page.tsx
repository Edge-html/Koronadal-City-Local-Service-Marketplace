"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthShell, friendlyAuthError } from "@/components/AuthShell";
import { Notice } from "@/components/ui";

type RoleChoice = "customer" | "worker";

function SignUpForm() {
  const { signUp } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [role, setRole] = useState<RoleChoice>(
    params.get("role") === "worker" ? "worker" : "customer",
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Philippine mobile numbers are the SMS fallback channel, so validate loosely.
  const phoneValid = useMemo(
    () => phone.trim() === "" || /^(09\d{9}|\+639\d{9})$/.test(phone.trim()),
    [phone],
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signUp(email, password, fullName, role, phone.trim());
      // Workers land straight into the 3-step self-registration flow.
      router.push(role === "worker" ? "/dashboard/worker/onboarding" : "/browse");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Create an account"
      title={role === "worker" ? "Register as a worker" : "Register as a household"}
      description={
        role === "worker"
          ? "Three steps, then a background check. Verification clears within 24 to 48 hours."
          : "Post a job request, approve a quote, and pay the worker directly."
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error ? <Notice tone="alert">{error}</Notice> : null}

        <fieldset>
          <legend className="label">I am a</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "customer", label: "Household", note: "I need work done" },
                { id: "worker", label: "Trade worker", note: "I offer services" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRole(option.id)}
                aria-pressed={role === option.id}
                className={
                  role === option.id
                    ? "flex flex-col gap-0.5 rounded-md border border-ink-black bg-white p-3 text-left"
                    : "flex flex-col gap-0.5 rounded-md border border-stone-200 bg-bone p-3 text-left transition-colors hover:border-stone-400"
                }
              >
                <span className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
                  {option.label}
                </span>
                <span className="caption">{option.note}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="label" htmlFor="fullName">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            required
            className="field"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Juan Dela Cruz"
          />
        </div>

        <div>
          <label className="label" htmlFor="signup-email">
            Email address
          </label>
          <input
            id="signup-email"
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
          <label className="label" htmlFor="phone">
            Mobile number
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className="field"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0917 000 0000"
            aria-invalid={!phoneValid}
            aria-describedby="phone-hint"
          />
          <p
            id="phone-hint"
            className={
              phoneValid
                ? "caption mt-1"
                : "mt-1 text-[10px] leading-[1.3] tracking-[-0.3px] text-alert-coral"
            }
          >
            {phoneValid
              ? "Used for SMS job alerts. Format: 09XX XXX XXXX"
              : "Enter a valid Philippine mobile number."}
          </p>
        </div>

        <div>
          <label className="label" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>

        <button type="submit" className="btn-primary mt-2 w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
              Creating account
            </>
          ) : (
            <>
              Create account
              <ArrowRight size={14} strokeWidth={1.5} />
            </>
          )}
        </button>

        <p className="meta pt-2 text-center">
          Already registered?{" "}
          <Link
            href="/login"
            className="text-stone-800 underline underline-offset-2 hover:text-ink-black"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}