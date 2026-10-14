import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Closing call to action. Used at the foot of both marketing pages. */
export function ClosingCta() {
  return (
    <section className="section container-page">
      <div className="flex flex-col items-center gap-6 rounded-xl border border-stone-200 bg-white px-6 py-16 text-center">
        <h2 className="max-w-[22ch] text-[28px] leading-[1.2] font-medium tracking-[-0.02em] text-ink-black">
          Find a verified trade, or get verified yourself.
        </h2>
        <p className="max-w-[56ch] text-[16px] leading-[1.4] text-stone-600">
          Households post a request and approve a fixed two-part quote before
          anything starts. Workers clear a background check and keep every peso
          but the 10% labor commission.
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/browse" className="btn-primary w-full sm:w-auto no-underline">
            Browse verified workers
            <ArrowRight size={15} strokeWidth={1.5} />
          </Link>
          <Link
            href="/signup?role=worker"
            className="btn-neutral w-full sm:w-auto no-underline"
          >
            Join as a worker
          </Link>
        </div>
      </div>
    </section>
  );
}