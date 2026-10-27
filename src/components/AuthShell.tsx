import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { firebaseConfigured } from "@/lib/firebase";
import { FirebaseSetupNotice } from "@/components/FirebaseSetupNotice";

/**
 * Shared frame for the sign-in / sign-up screens. Deliberately narrow and
 * centred — the auth pages are utility, not editorial.
 */
export function AuthShell({
  eyebrow,
  title,
  description,
  imageSrc,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  imageSrc?: string;
  children: ReactNode;
}) {
  const content = (
    <div className="w-full max-w-[420px]">
      <header className="mb-6 flex flex-col gap-2">
        <p className="font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] text-stone-500">
          {eyebrow}
        </p>
        <h1 className="text-[24px] leading-[1.2] font-medium tracking-[-0.48px] text-ink-black">
          {firebaseConfigured ? title : "Accounts unavailable"}
        </h1>
        <p className="text-[14px] leading-[1.45] text-stone-600">
          {firebaseConfigured
            ? description
            : "Accounts are unavailable until this deployment has Firebase configured."}
        </p>
      </header>

      {firebaseConfigured ? (
        <Card className="p-6">{children}</Card>
      ) : (
        <FirebaseSetupNotice />
      )}

      <p className="meta mt-6 text-center leading-[1.5]">
        Contact details stay masked until a job request is formally accepted,
        in line with the Data Privacy Act of 2012.
      </p>
    </div>
  );

  if (imageSrc) {
    return (
      <section className="container-page py-12 sm:py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2 md:gap-12">
          <div className="flex justify-center">{content}</div>
          <div
            aria-hidden="true"
            className="relative hidden min-h-[560px] overflow-hidden rounded-2xl border border-stone-200 shadow-sm md:block"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(248,250,252,.78) 0%, rgba(248,250,252,.22) 48%, rgba(21,94,239,.16) 100%), linear-gradient(0deg, rgba(11,18,32,.24), transparent 58%), url('${imageSrc}')`,
              backgroundRepeat: "no-repeat",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="container-page flex justify-center py-20">
      {content}
    </section>
  );
}

/** Maps Firebase auth error codes onto plain language. */
export function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password combination doesn't match an account.";
    case "auth/email-already-in-use":
      return "An account already exists with that email address.";
    case "auth/weak-password":
      return "Choose a password of at least 6 characters.";
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/operation-not-allowed":
      return "Email sign-in isn't enabled on this Firebase project yet.";
    default:
      return "Something went wrong. Please try again.";
  }
}
