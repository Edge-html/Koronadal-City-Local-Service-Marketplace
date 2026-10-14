import { Card, SectionHeader } from "@/components/ui";
import {
  BARANGAYS,
  CATEGORIES,
  COMPLIANCE_FRAMEWORK,
  FAIR_COMPETITION_PRINCIPLES,
} from "@/lib/constants";

export function Compliance() {
  return (
    <section id="compliance" className="section container-page ">
      <SectionHeader
        eyebrow="Regulatory alignment"
        title="Built inside the Philippine legal framework"
        description="The platform maintains strict alignment with current legislation to protect both service professionals and household consumers."
      />

      <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-2">
        {COMPLIANCE_FRAMEWORK.map((item) => (
          <article key={item.title} className="flex flex-col gap-2 bg-white p-6">
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
                {item.title}
              </h3>
            </div>
            <p className="caption">{item.subtitle}</p>
            <p className="text-[13px] leading-[1.45] text-stone-600">{item.body}</p>
          </article>
        ))}
      </div>

      <div id="fairness" className="mt-4 grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-3">
        {FAIR_COMPETITION_PRINCIPLES.map((item) => (
          <article key={item.title} className="flex flex-col gap-2 bg-white p-6">
            <h3 className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
              {item.title}
            </h3>
            <p className="text-[13px] leading-[1.45] text-stone-600">{item.body}</p>
          </article>
        ))}
      </div>

      <div
        id="privacy"
        className="mt-4 rounded-xl border border-stone-200 bg-bone px-6 py-5"
      >
        <p className="max-w-[80ch] text-[13px] leading-[1.5] text-stone-700">
          <span className="font-medium text-ink-black">Privacy by default. </span>
          Personally identifiable information, clearance documents, and contact
          details are encrypted at rest. Direct contact details are masked on
          every public profile and revealed only to counterparties once a job
          request is formally accepted.
        </p>
      </div>

      {/* Coverage summary. */}
      <Card className="mt-4 grid gap-6 p-6 sm:grid-cols-3">
        <div>
          <p className="caption">Barangays covered</p>
          <p className="mt-1 text-[24px] leading-[1.2] font-medium tracking-[-0.48px] text-ink-black tabular-nums">
            {BARANGAYS.length}
          </p>
        </div>
        <div>
          <p className="caption">Service categories</p>
          <p className="mt-1 text-[24px] leading-[1.2] font-medium tracking-[-0.48px] text-ink-black tabular-nums">
            {CATEGORIES.length}
          </p>
        </div>
        <div>
          <p className="caption">Walk-in service points</p>
          <p className="mt-1 text-[24px] leading-[1.2] font-medium tracking-[-0.48px] text-ink-black tabular-nums">
            2
          </p>
          <p className="caption mt-1">Barangay kiosks &amp; PESO desk</p>
        </div>
      </Card>
    </section>
  );
}