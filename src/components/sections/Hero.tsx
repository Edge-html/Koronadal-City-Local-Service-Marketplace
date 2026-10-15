"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CirclePlay } from "lucide-react";
import { BARANGAYS } from "@/lib/constants";

export function Hero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <section className="flex flex-col items-center px-6 pt-20 pb-6 text-center sm:pt-28">
      <LaunchPill mounted={mounted} />

      {/* Two lines: the statement lands in ink, the qualifier recedes. */}
      <h1 className="font-display mt-8 text-[clamp(34px,8vw,100px)] leading-[0.8]">
        <span className="block text-ink-black">Verified trades.</span>
        <span className="-mt-0.06em block text-stone-400">One clear price.</span>
      </h1>

      <p className="mt-8 max-w-[58ch] text-[16px] leading-[1.45] text-stone-600 sm:text-[17px]">
        The Koronadal City Local Service Marketplace connects households with
        background-checked professionals across ten essential trades. Pay cash
        or GCash directly to the worker. Nothing is held in escrow.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Link href="/browse" className="btn-primary w-full sm:w-auto">
          Browse verified workers
          <ArrowRight size={15} strokeWidth={1.5} />
        </Link>
        <Link href="/signup" className="btn-neutral w-full sm:w-auto">
          Join as a worker
        </Link>
      </div>

      <dl className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {[
          ["10", "essential trades"],
          [String(BARANGAYS.length), "barangays served"],
          ["10%", "labor commission"],
        ].map(([value, label]) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="sr-only">{label}</dt>
            <dd className="text-[20px] leading-none font-medium tracking-[-0.4px] text-ink-black tabular-nums">
              {value}
            </dd>
            <span className="caption">{label}</span>
          </div>
        ))}
      </dl>
    </section>
  );
}

function LaunchPill({ mounted }: { mounted: boolean }) {
  return (
    <Link
      href="/platform"
      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1.5 pr-3 pl-3 text-[12px] font-medium tracking-[-0.02em] text-ink-black no-underline transition-colors hover:bg-bone"
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-bone">
        <CirclePlay size={11} strokeWidth={1.5} className="text-stone-700" />
      </span>
      <span className={mounted ? "animate-in" : undefined}>
        Live in Koronadal City &middot; 10 essential trades
      </span>
    </Link>
  );
}
