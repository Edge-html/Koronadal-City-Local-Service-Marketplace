import Link from "next/link";
import { jobGroup, type JobFilter, type JobView } from "@/lib/job-flow";
import type { Job } from "@/lib/types";

export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-white tabular-nums" aria-label={`${count} items need attention`}>
    {count > 99 ? "99+" : count}
  </span>;
}

export function FlowGuide({ steps }: { steps: { title: string; detail: string }[] }) {
  return <details className="rounded-xl border border-stone-200 bg-white p-4">
    <summary className="cursor-pointer text-sm font-medium text-stone-800">How it works · {steps.length} simple steps</summary>
    <ol className="mt-4 grid gap-4 sm:grid-cols-3">
      {steps.map((step, index) => <li key={step.title} className="flex gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">{index + 1}</span>
        <div><p className="text-sm font-medium text-stone-900">{step.title}</p><p className="mt-1 text-sm leading-relaxed text-stone-600">{step.detail}</p></div>
      </li>)}
    </ol>
  </details>;
}

export function AttentionNotice({ count, href, children }: { count: number; href?: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4" role="status">
    <div><p className="flex items-center gap-2 text-sm font-semibold text-blue-950"><CountBadge count={count} />{count ? "Your next step" : "You're up to date"}</p><p className="mt-1 text-sm leading-relaxed text-blue-900">{children}</p></div>
    {href && count > 0 ? <Link href={href} className="btn-primary btn-sm no-underline">View requests</Link> : null}
  </div>;
}

export function JobFilters({ jobs, view, value, onChange }: { jobs: Job[]; view: JobView; value: JobFilter; onChange: (filter: JobFilter) => void }) {
  const options: [JobFilter, string][] = [["all", "All"], ["action", "Needs your action"], ["waiting", "Waiting"], ["active", "In progress"], ["history", "History"]];
  return <div className="flex flex-wrap gap-2" aria-label="Filter requests">
    {options.map(([id, label]) => {
      const count = jobs.filter((j) => id === "all" || jobGroup(j, view) === id).length;
      return <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${value === id ? "border-blue-600 bg-blue-600 text-white" : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"}`}>
        {label}<span className="rounded-full bg-black/10 px-1.5 text-xs tabular-nums">{count}</span>
      </button>;
    })}
  </div>;
}

export const CUSTOMER_STEPS = [
  { title: "Find and request", detail: "Choose a worker and describe the service you need." },
  { title: "Review the quote", detail: "Open My requests to check and approve the price before work starts." },
  { title: "Pay and review", detail: "Pay your worker directly after the work. Leave a review when the job is settled." },
];
export const WORKER_STEPS = [
  { title: "Accept a request", detail: "Check the job details and your availability before accepting." },
  { title: "Send a quote", detail: "Open My jobs, send your price, and wait for customer approval." },
  { title: "Complete and settle", detail: "Finish the work, mark it complete, then settle the commission." },
];
