"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthShell, friendlyAuthError } from "@/components/AuthShell";
import { Card, Notice, safeAsync } from "@/components/ui";
import { getWorkerByUid } from "@/lib/data";

type RoleChoice = "customer" | "worker";

function SignUpForm() {
  const { user, role: accountRole, signUp, loading: authLoading } =
  useAuth();
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
  const [starting, setStarting] = useState(false);

  // Someone who already has an account should upgrade it, not create a second
  // one. People start here to hire services and some later offer them.
  const signedInAsCustomer = !!user && accountRole === "customer";

  // Philippine mobile numbers are the SMS fallback channel, so validate loosely.
  const phoneValid = useMemo(
    () => phone.trim() === "" || /^(09\d{9}|\+639\d{9})$/.test(phone.trim()),
    [phone],
  );

  // Already a worker (or admin): there is nothing to register, send them on.
  useEffect(() => {
    if (authLoading || !user) return;
    if (accountRole === "admin") router.replace("/admin");
    else if (accountRole === "worker")
      router.replace("/dashboard/worker");
  }, [authLoading, user, accountRole, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signUp(email, password, fullName, role, phone.trim());
      // Workers land straight into the 3-step self-registration flow.
      router.push(role === "worker" ? "/dashboard/worker/onboarding" : "/");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Continue into the worker application.
   *
   * The account role is deliberately NOT upgraded here. Identity, the three
   * mandatory documents, and the background check still have to be completed:
   * the role flips only once onboarding is actually submitted, and the profile
   * stays out of the directory until an administrator verifies it.
   */
  const startApplication = safeAsync(async () => {
    setStarting(true);
    setError("");
    try {
      // An existing worker profile means onboarding would bounce them
      // straight back out, so send them to the console instead.
      const existing = await getWorkerByUid(user!.uid);
      router.push(existing ? "/dashboard/worker" : "/dashboard/worker/onboarding");
    } catch {
      // If the profile lookup is blocked, onboarding still renders and will
      // report the real problem in context.
      router.push("/dashboard/worker/onboarding");
    } finally {
      setStarting(false);
    }
  }, "start-worker-application");

  // Wait for the session before choosing a view. Otherwise the signed-out
  // registration form paints first and is swapped for the upgrade panel a
  // frame later, which reads as a glitch.
  if (authLoading) {
    return (
      <AuthShell
        eyebrow="Checking your session"
        title="One moment"
        description="Working out whether you are already signed in."
      >
        <Card className="p-6">
          <p className="meta">Checking your account</p>
        </Card>
      </AuthShell>
    );
  }

  /* ---- Already signed in: offer the upgrade, not a signup form ---- */
  if (signedInAsCustomer) {
    return (
      <AuthShell
        eyebrow="Already registered"
        title="Start offering your services"
        description={`You&rsquo;re signed in${user.displayName ? ` as ${user.displayName}` : ""}. Your account is currently set up to hire services.`}
      >
        <Card className="flex flex-col gap-4 p-6">
          {error ? <Notice tone="alert">{error}</Notice> : null}

          <p className="text-[14px] leading-[1.5] text-stone-600">
            Upgrade this account to a service provider instead of creating a
            second one. Your existing requests and history stay exactly where
            they are.
          </p>

          {/* The requirements are unchanged: nothing is granted by clicking.*/}
          <ul className="flex flex-col gap-2 rounded-md border border-stone-200 bg-bone px-4 py-3">
            <li className="text-[13px] leading-[1.45] text-stone-700">
              Identity and contact details
            </li>
            <li className="text-[13px] leading-[1.45] text-stone-700">
              Government photo ID, barangay or police clearance, and a letter
              of recommendation
            </li>
            <li className="text-[13px] leading-[1.45] text-stone-700">
              A background check clearing within 24 to 48 hours
            </li>
          </ul>
          <p className="caption">
            Until an administrator approves the application the profile stays
            hidden from the directory and receives no job requests.
          </p>

          <button type="button" className="btn-primary w-full" onClick={startApplication} disabled={starting}>
            {starting ? (
              <>
                <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                Starting
              </>
            ) : (
              <>
                Start the application
                <ArrowRight size={14} strokeWidth={1.5} />
              </>
            )}
          </button>

          <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-4">
            <Link href="/dashboard/customer" className="btn-ghost px-0">
              Not now
            </Link>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="btn-ghost"
            >
              Go to dashboard
            </button>
          </div>
        </Card>
      </AuthShell>
    );
  }

  /* ---- Signed out, or worker/admin: the normal form or a redirect ---- */
  if (user) return null;

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
                { id: "worker", label: "Service provider", note: "I offer services" },
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
