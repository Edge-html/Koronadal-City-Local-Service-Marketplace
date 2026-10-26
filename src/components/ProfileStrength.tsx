import Link from "next/link";
import { Check, Circle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import { getProfileStrength } from "@/lib/profile-strength";
import type { Worker } from "@/lib/types";

export function ProfileStrength({ worker }: { worker: Worker }) {
  const items = getProfileStrength(worker);
  const score = items.reduce((total, item) => total + (item.complete ? item.weight : 0), 0);
  const heading = score >= 80 ? "Strong profile" : score >= 50 ? "Good progress" : "Build your profile";

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} strokeWidth={1.7} className="text-stone-500" aria-hidden="true" />
            <h2 className="text-[18px] font-medium tracking-[-0.36px] text-ink-black">Profile strength</h2>
          </div>
          <p className="mt-1 text-[13px] leading-[1.45] text-stone-600">
            {heading} · Add details and work samples to help households understand your experience.
          </p>
        </div>
        <p className="text-[24px] font-medium tabular-nums text-ink-black" aria-label={`${score}% profile strength`}>
          {score}<span className="text-[15px] text-stone-500">%</span>
        </p>
      </div>

      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100"
        role="progressbar"
        aria-label="Profile strength"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <div className="h-full rounded-full bg-ink-black transition-[width]" style={{ width: `${score}%` }} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 rounded-md bg-stone-50 px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-[12px] leading-[1.4] text-stone-700">
              {item.complete
                ? <Check size={14} className="shrink-0 text-blue-700" aria-label="Complete" />
                : <Circle size={14} className="shrink-0 text-stone-400" aria-label="Incomplete" />}
              <span className={item.complete ? "line-through decoration-stone-300" : ""}>{item.label}</span>
            </span>
            {!item.complete ? (
              <Link href={item.href} className="shrink-0 text-[11px] font-medium text-ink-black underline underline-offset-2">
                {item.action}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
      <p className="caption mt-3">This is a profile checklist, not a rating or promise of work.</p>
    </Card>
  );
}

