"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui";
import { WORKFLOW_STAGES } from "@/lib/constants";

export function Workflow() {
  const [active, setActive] = useState(0);

  return (
    <section id="workflow" className="section container-page ">
      <SectionHeader
        eyebrow="Transaction lifecycle"
        title="Six stages, from first look to final review"
        description="A deliberately short path. Contact details stay masked until a request is formally accepted, and the price is fixed before any work begins."
      />

      {/* Stepper tab strip: five visible steps connected by hairlines. */}
      <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-stretch">
        {WORKFLOW_STAGES.map((stage, index) => {
          const isActive = index === active;
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => setActive(index)}
              aria-pressed={isActive}
              className={
                isActive
                  ? "flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-white px-4 py-2 text-left shadow-[0_2px_3px_rgba(0,0,0,0.08)]"
                  : "flex items-center justify-between gap-2 rounded-md px-4 py-2 text-left text-stone-500 transition-colors hover:bg-bone"
              }
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={
                    isActive
                      ? "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ink-black text-[9px] leading-none font-medium text-newsprint"
                      : "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-stone-200 text-[9px] leading-none tabular-nums text-stone-500"
                  }
                >
                  {stage.step}
                </span>
                <span
                  className={
                    isActive
                      ? "truncate text-[14px] tracking-[-0.02em] text-ink-black"
                      : "truncate text-[14px] tracking-[-0.02em] text-stone-500"
                  }
                >
                  {stage.name}
                </span>
              </span>
              {index < WORKFLOW_STAGES.length - 1 ? (
                <ChevronRight
                  size={13}
                  strokeWidth={1.5}
                  className="hidden shrink-0 text-stone-200 lg:block"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Stage detail panel. */}
      <Card className="mt-4 animate-in p-6">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <div>
            <p className="caption">Stage {WORKFLOW_STAGES[active].step} of 6</p>
            <h3 className="mt-2 text-[20px] leading-[1.2] font-medium tracking-[-0.4px] text-ink-black">
              {WORKFLOW_STAGES[active].name}
            </h3>
          </div>
          <p className="max-w-[70ch] text-[15px] leading-[1.5] text-stone-600">
            {WORKFLOW_STAGES[active].detail}
          </p>
        </div>
      </Card>
    </section>
  );
}
