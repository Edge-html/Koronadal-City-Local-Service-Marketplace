import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/sections/Hero";
import { TrustBar } from "@/components/sections/TrustBar";
import { Categories } from "@/components/sections/Categories";
import { ClosingCta } from "@/components/sections/ClosingCta";

/**
 * Landing page.
 *
 * Scoped to the pitch: what this is, the trades on offer, and the two ways in.
 * Operational detail — the six-stage lifecycle, the commission model, worker
 * onboarding, referrals, and the legal framework — lives on /platform, so this
 * page stays scannable instead of becoming a single endless scroll.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Categories />
      <PlatformTeaser />
      <ClosingCta />
    </>
  );
}

/** Bridge from the pitch to the detail page. */
function PlatformTeaser() {
  return (
    <section className="section container-page">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-center">
        <div>
          <p className="font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] text-stone-500">
            How it works
          </p>
          <h2 className="mt-2 max-w-[20ch] text-[28px] leading-[1.2] font-medium tracking-[-0.02em] text-ink-black">
            Six stages, one transparent price.
          </h2>
          <p className="mt-3 max-w-[60ch] text-[16px] leading-[1.4] text-stone-600">
            A deliberately short path from first look to final review. Contact
            details stay masked until a request is formally accepted, and the
            price is fixed before any work begins.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {[
            ["Commission", "10% on labor only, materials exempt"],
            ["Payment", "Direct to the worker, cash or GCash"],
            ["Referrals", "Single tier, credited after a first job"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-4 border-b border-stone-200 pb-2 last:border-b-0"
            >
              <span className="text-[13px] tracking-[-0.02em] text-stone-700">
                {label}
              </span>
              <span className="text-right text-[12px] text-stone-500">{value}</span>
            </div>
          ))}

          <Link href="/platform" className="btn-neutral mt-3 w-fit no-underline">
            See how the platform works
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}