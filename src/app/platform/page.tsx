import type { Metadata } from "next";
import Link from "next/link";
import { Workflow } from "@/components/sections/Workflow";
import { LiveProductCard } from "@/components/sections/ProductCard";
import { Commission } from "@/components/sections/Commission";
import { Onboarding } from "@/components/sections/Onboarding";
import { Referrals } from "@/components/sections/Referrals";
import { Compliance } from "@/components/sections/Compliance";
import { ClosingCta } from "@/components/sections/ClosingCta";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How households and service providers request work, agree in chat, complete jobs, and review the experience.",
};

/**
 * Platform detail page.
 *
 * Everything operational, split out of the landing page: the lifecycle, how
 * workers get onboarded, how referrals work, and the legal
 * posture. The landing page keeps the pitch; this page carries the specifics.
 */
export default function PlatformPage() {
  return (
    <>
      <PlatformHeader />
      <Workflow />
      <LiveProductCard />
      <Commission />
      <Onboarding />
      <Referrals />
      <Compliance />
      <ClosingCta />
    </>
  );
}

function PlatformHeader() {
  return (
    <section className="container-page pt-16">
      <div className="max-w-[70ch]">
        <p className="font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] text-stone-500">
          Platform
        </p>
        <h1 className="mt-3 text-[clamp(30px,5.2vw,56px)] leading-[1.08] tracking-[-0.02em] text-ink-black">
          How the marketplace actually runs.
        </h1>
        <p className="mt-4 max-w-[64ch] text-[17px] leading-[1.45] text-stone-600">
          The job lifecycle, how service professionals
          are verified, and the framework the platform operates inside. The
          details behind the promise on the{" "}
          <Link href="/" className="text-ink-black underline underline-offset-2">
            home page
          </Link>
          .
        </p>

        <nav
          className="mt-8 flex flex-wrap gap-2 border-t border-stone-200 pt-6"
          aria-label="On this page"
        >
          {[
            ["#workflow", "Workflow"],
            ["#commission", "Agree & pay"],
            ["#onboarding", "Onboarding"],
            ["#referrals", "Referrals"],
            ["#compliance", "Compliance"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-[13px] tracking-[-0.02em] text-stone-700 no-underline transition-colors hover:bg-bone hover:text-ink-black"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
