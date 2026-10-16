"use client";

import { useActivity } from "@/context/ActivityContext";
import { AttentionNotice, FlowGuide, CUSTOMER_STEPS } from "@/components/FlowGuide";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Categories } from "@/components/sections/Categories";
import { FindWorkerSection } from "@/components/home/FindWorkerSection";
import { WorkerHome } from "@/components/home/WorkerHome";
import { useAuth } from "@/context/AuthContext";

/**
 * The home page — what the signed-in account came here to do.
 *
 * Two halves, chosen by the account role rather than a separate mode setting:
 *
 *   Finding a service  the worker finder, then the trade categories
 *   Working as a provider  incoming job requests
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
  const { user, role, loading, profileError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/landing");
      return;
    }
    if (role === "admin") router.replace("/admin");
  }, [loading, user, role, router]);

  useEffect(() => {
    if (loading || role !== "customer" || !window.location.hash) return;
    const id = window.location.hash.slice(1);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, [loading, role]);

  if (loading) return <HomeSkeleton />;

  if (!user || role === "admin") return <HomeSkeleton />;

  if (!role) {
    return (
      <section className="container-page py-16">
        <h1 className="text-[28px] font-medium text-ink-black">We could not identify your account type.</h1>
        <p className="mt-3 max-w-[54ch] text-[14px] leading-[1.5] text-stone-600">
          {profileError || "Your account is still loading. Refresh this page to try again."}
        </p>
      </section>
    );
  }

  if (role === "worker") return <WorkerHome />;

  return (
    <>
      <CustomerMasthead />
      <FindWorkerSection />
      <Categories />
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
  const { customerCount, customerError } = useActivity();
  return (
    <section className="container-page pb-4 pt-14 sm:pb-6 sm:pt-20">
      <p className="font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] text-stone-500">
        Finding a service
      </p>
      <h1 className="mt-3 max-w-[18ch] font-[family-name:var(--font-display)] text-[44px] leading-[1.05] font-medium tracking-[-0.02em] text-ink-black sm:text-[56px]">
        Find the right worker.
      </h1>
      <p className="mt-4 max-w-[54ch] text-[16px] leading-[1.5] text-stone-600">
        Search verified local workers by name, service, or trade. Compare their
        profiles and offers, then send a request when you find the right fit.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {customerError ? <p role="alert" className="text-sm text-red-700">{customerError}</p> : <AttentionNotice count={customerCount} href="/dashboard/customer">{customerCount ? "You have quotes or completed jobs waiting for your response in My requests." : "Start by choosing a worker below. Track your requests and quotes in My requests."}</AttentionNotice>}
        <FlowGuide steps={CUSTOMER_STEPS} />
      </div>
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
