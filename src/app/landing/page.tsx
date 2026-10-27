import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/sections/Hero";
import { TrustBar } from "@/components/sections/TrustBar";
import { Categories } from "@/components/sections/Categories";
import { ClosingCta } from "@/components/sections/ClosingCta";

/**
 * Landing page — the pitch.
 *
 * Kept deliberately separate from `/`. The home page is what a signed-in
 * account uses to get something done, so it carries their actual choices: the
 * directory for a household, their open requests and their posted offers for a
 * provider. Mixing a marketing hero into that would put a scroll of
 * persuasion between someone and the thing they came for.
 *
 * Scoped to the pitch: what this is, the services on offer, and the two ways in.
 * Operational detail — the six-stage lifecycle, worker
 * onboarding, referrals, and the legal framework — lives on /platform, so this
 * page stays scannable instead of becoming a single endless scroll.
 */
export default function LandingPage() {
  return (
    <>
      <div className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(248,250,252,.97) 0%, rgba(248,250,252,.9) 42%, rgba(248,250,252,.66) 100%), linear-gradient(180deg, rgba(248,250,252,.06) 0%, rgba(248,250,252,.18) 60%, #f8fafc 100%), url('/images/local-craft.webp')",
            backgroundRepeat: "no-repeat",
            backgroundSize: "100% 100%, 100% 100%, min(64vw, 980px) 100%",
            backgroundPosition: "center, center, right center",
          }}
        />
        <Hero />
        <TrustBar />
      </div>
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
            Six stages, one shared plan.
          </h2>
          <p className="mt-3 max-w-[60ch] text-[16px] leading-[1.4] text-stone-600">
            A deliberately short path from first look to final review. Agree on
            the work, rate, schedule, and payment in the private job chat before
            work begins.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {[
            ["Agreement", "Both sides confirm in job chat"],
            ["Payment", "Direct to the worker, method agreed together"],
            ["Pro profile", "Optional, free during the pilot"],
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
