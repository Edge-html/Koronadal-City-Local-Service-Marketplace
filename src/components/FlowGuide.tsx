import Link from "next/link";
import { jobGroup, type JobFilter, type JobView } from "@/lib/job-flow";
import type { Job } from "@/lib/types";

export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  // Solid ink, not blue. This is the loudest recurring element in the console
  // and it means "n things need you", so it should be the darkest thing on the
  // page rather than a colour competing with the primary button.
  return <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-ink-black px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-newsprint tabular-nums" aria-label={`${count} items need attention`}>
    {count > 99 ? "99+" : count}
  </span>;
}

export function FlowGuide({ steps }: { steps: { title: string; detail: string }[] }) {
  return <details className="rounded-xl border border-stone-200 bg-white p-4">
    <summary className="cursor-pointer text-sm font-medium text-stone-800">How it works · {steps.length} simple steps</summary>
    <ol className="mt-4 grid gap-4 sm:grid-cols-3">
      {steps.map((step, index) => <li key={step.title} className="flex gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-bone text-xs font-semibold text-ink-black tabular-nums">{index + 1}</span>
        <div><p className="text-sm font-medium text-ink-black">{step.title}</p><p className="mt-1 text-sm leading-relaxed text-stone-600">{step.detail}</p></div>
      </li>)}
    </ol>
  </details>;
}

export function AttentionNotice({ count, href, children }: { count: number; href?: string; children: React.ReactNode }) {
  // A hairline box when there is nothing to do, an ink-bordered box when there
  // is. The border is the signal — it appears exactly when the count is above
  // zero, so the page states its own urgency without a colour to fade.
  return <div
    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ${
      count > 0 ? "attention-border bg-white" : "border border-stone-200 bg-bone"
    }`}
    role="status"
  >
    <div><p className={`flex items-center gap-2 text-sm font-semibold ${count > 0 ? "text-ink-black" : "text-stone-600"}`}><CountBadge count={count} />{count ? "Your next step" : "You're up to date"}</p><p className="mt-1 text-sm leading-relaxed text-stone-600">{children}</p></div>
    {href && count > 0 ? <Link href={href} className="btn-primary btn-sm no-underline">View requests</Link> : null}
  </div>;
}

export function JobFilters({ jobs, view, value, onChange }: { jobs: Job[]; view: JobView; value: JobFilter; onChange: (filter: JobFilter) => void }) {
  const options: [JobFilter, string][] = [["all", "All"], ["action", "Needs your action"], ["waiting", "Waiting"], ["active", "In progress"], ["history", "History"]];
  return <div className="flex flex-wrap gap-2" aria-label="Filter requests">
    {options.map(([id, label]) => {
      const count = jobs.filter((j) => id === "all"
        ? view !== "worker" || jobGroup(j, view) !== "history"
        : jobGroup(j, view) === id).length;
      return <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${value === id ? "border-char bg-char text-white" : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"}`}>
        {label}<span className={`rounded-full px-1.5 text-xs tabular-nums ${value === id ? "bg-white/20" : "bg-black/10"}`}>{count}</span>
      </button>;
    })}
  </div>;
}

export const CUSTOMER_STEPS = [
  { title: "Find and request", detail: "Choose a worker and describe the service you need." },
  { title: "Agree in chat", detail: "Discuss scope, price, schedule, and payment. Both sides confirm the agreement in the job chat." },
  { title: "Complete and review", detail: "The worker completes the job; settle payment directly between yourselves, then share a review." },
];
export const WORKER_STEPS = [
  { title: "Accept a request", detail: "Check the job details and your availability before accepting." },
  { title: "Agree in chat", detail: "Discuss scope, price, schedule, and payment. Both sides confirm the agreement before work starts." },
  { title: "Complete and review", detail: "Mark the work complete and settle payment directly with the household." },
];
