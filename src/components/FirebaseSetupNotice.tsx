"use client";

import { Card } from "@/components/ui";
import { missingFirebaseKeys } from "@/lib/firebase";

/**
 * Shown when a deployment is missing its NEXT_PUBLIC_FIREBASE_* variables.
 *
 * The marketing site is entirely static content and still works, so the goal
 * here is to explain precisely what is missing rather than let a stack trace be
 * the only clue. Renders nothing when Firebase is configured correctly.
 */
export function FirebaseSetupNotice({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (missingFirebaseKeys.length === 0) return null;

  return (
    <Card className={className}>
      <div className={compact ? "p-4" : "p-5 sm:p-6"}>
        <p className="font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] text-stone-500">
          Deployment not configured
        </p>

        <h2 className="mt-2 text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
          Firebase environment variables are missing
        </h2>

        {!compact ? (
          <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.5] text-stone-600">
            This deployment has no Firebase client keys, so accounts, job
            requests, and the worker directory are unavailable. Everything else
            on this page is static and unaffected.
          </p>
        ) : null}

        <ul className="mt-4 flex flex-col gap-1.5">
          {missingFirebaseKeys.map((key) => (
            <li
              key={key}
              className="font-[family-name:var(--font-geist)] text-[12px] tracking-[-0.02px] text-ink-black"
            >
              {key}
            </li>
          ))}
        </ul>

        {!compact ? (
          <>
            <ol className="mt-5 flex flex-col gap-2 border-t border-stone-200 pt-4">
              {[
                "Vercel → your project → Settings → Environment Variables",
                "Add each variable above, enabled for Production, Preview, and Development",
                "Redeploy from the Deployments tab — env changes never apply to an existing build",
              ].map((step, i) => (
                <li key={step} className="flex gap-2 text-[13px] leading-[1.45] text-stone-700">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-bone text-[9px] tabular-nums text-stone-600">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <p className="caption mt-4">
              Locally, copy <code className="text-stone-700">.env.example</code>{" "}
              to <code className="text-stone-700">.env.local</code> and fill it
              in. Firebase client keys are public by design — access is
              controlled by <code className="text-stone-700">firestore.rules</code>,
              not by keeping them secret.
            </p>
          </>
        ) : null}
      </div>
    </Card>
  );
}