import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Closing call to action. Used at the foot of both marketing pages. */
export function ClosingCta() {
  return (
    <section className="section container-page">
      <div className="relative isolate overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #fff 0%, rgba(255,255,255,.97) 42%, rgba(255,255,255,.68) 100%), linear-gradient(0deg, rgba(21,94,239,.07), rgba(21,94,239,.02)), url('/images/community-hands.webp')",
            backgroundRepeat: "no-repeat",
            backgroundSize: "100% 100%, 100% 100%, min(58vw, 760px) 150%",
            backgroundPosition: "center, center, right 48%",
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-6 px-6 py-16 text-center">
          <h2 className="max-w-[22ch] text-[28px] leading-[1.2] font-medium tracking-[-0.02em] text-ink-black">
            Find a verified pro, or get verified yourself.
          </h2>
          <p className="max-w-[56ch] text-[16px] leading-[1.4] text-stone-600">
            Households request a service and agree on the work directly with a
            verified provider in chat. Both sides confirm before work begins, and
            payment goes directly to the worker.
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
      </div>
    </section>
  );
}
