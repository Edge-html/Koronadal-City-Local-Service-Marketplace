"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Categories } from "@/components/sections/Categories";
import { FindWorkerSection } from "@/components/home/FindWorkerSection";
import { WorkerHome } from "@/components/home/WorkerHome";
import { useAuth } from "@/context/AuthContext";

/**
 * The home page — what the signed-in account came here to do.
 *
 * Two halves, chosen by what the account is here for rather than by a URL they
 * have to know:
 *
 *   Finding a service  the trades on offer, then the directory
 *   Working as a provider  requests waiting on them, then their own offers
 *
 * The pitch lives at /landing. Putting a marketing hero here would mean
 * scrolling past persuasion to reach the thing they came for, which is the
 * opposite of what a returning account needs.
 *
 * A signed-out visitor is sent to /landing: the directory is public, but a
 * home page with no account behind it has nothing to personalise, and the
 * landing page is the better first impression anyway.
 */
export default function HomePage() {
  const { user, role, mode, loading } = useAuth();
  const router = useRouter();

  const workerMode = mode === "worker" && role === "worker";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/landing");
      return;
    }
    if (role === "admin") router.replace("/admin");
  }, [loading, user, role, router]);

  if (loading) return <HomeSkeleton />;

  if (!user || role === "admin") return <HomeSkeleton />;

  if (workerMode) return <WorkerHome />;

  return (
    <>
      <CustomerMasthead />
      <Categories />
      <FindWorkerSection />
    </>
  );
}

/**
 * The one display-serif line on this page.
 *
 * The design system allows exactly one Playfair setting per page, used as the
 * masthead. On / that is this, not a hero graphic — the home page has no
 * hero, and spending the allowance on a decorative line would be the only
 * thing on the screen that is not doing work.
 */
function CustomerMasthead() {
  return (
    <section className="section container-page">
      <p className="font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] text-stone-500">
        Finding a service
      </p>
      <h1 className="mt-3 max-w-[18ch] font-[family-name:var(--font-display)] text-[44px] leading-[1.05] font-medium tracking-[-0.02em] text-ink-black sm:text-[56px]">
        What needs doing?
      </h1>
      <p className="mt-4 max-w-[54ch] text-[16px] leading-[1.5] text-stone-600">
        Pick a trade below, or browse everyone who has cleared a background
        check. You fix the price before any work starts, and you pay the worker
        directly.
      </p>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <section className="container-page py-16">
      <div className="h-3 w-32 animate-pulse rounded bg-stone-200/70" />
      <div className="mt-4 h-12 w-96 max-w-full animate-pulse rounded bg-stone-200/70" />
      <div className="mt-4 h-4 w-[52ch] max-w-full animate-pulse rounded bg-stone-200/70" />
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-52 animate-pulse rounded-xl border border-stone-200 bg-white"
          />
        ))}
      </div>
    </section>
  );
}