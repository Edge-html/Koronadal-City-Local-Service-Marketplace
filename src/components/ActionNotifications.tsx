"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { needsAction, nextStep } from "@/lib/job-flow";
import type { Job, Role } from "@/lib/types";

export function ActionNotifications({
  role,
  customerJobs,
  workerJobs,
  admin,
}: {
  role: Role;
  customerJobs: Job[] | null;
  workerJobs: Job[] | null;
  admin: { workers: number; disputes: number };
}) {
  const [open, setOpen] = useState(false);
  const actions = role === "admin"
    ? [
        { label: "Worker applications", count: admin.workers, href: "/admin", detail: "Review submitted worker documents." },
        { label: "Disputes", count: admin.disputes, href: "/admin#oversight", detail: "Review open job disputes." },
      ].filter((item) => item.count > 0)
    : [
        ...(role === "worker" ? (workerJobs ?? []).filter((job) => needsAction(job, "worker")).map((job) => ({
          label: job.title,
          count: 1,
          href: `/dashboard/worker#job-${job.id}`,
          detail: nextStep(job, "worker").title,
        })) : []),
        ...(customerJobs ?? []).filter((job) => needsAction(job, "customer")).map((job) => ({
          label: job.title,
          count: 1,
          href: `/dashboard/customer#job-${job.id}`,
          detail: nextStep(job, "customer").title,
        })),
      ].slice(0, 8);
  const count = role === "admin"
    ? admin.workers + admin.disputes
    : actions.reduce((total, item) => total + item.count, 0);

  return <div className="relative">
    <button type="button" className="btn-ghost relative px-2" aria-label={`Notifications${count ? `, ${count} need attention` : ""}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Bell size={17} strokeWidth={1.6} />
      {count > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-white bg-ink-black px-1 text-[10px] font-semibold text-white">{count > 99 ? "99+" : count}</span> : null}
    </button>
    {open ? <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
      <div className="border-b border-stone-200 px-4 py-3"><p className="text-sm font-semibold text-ink-black">Needs your attention</p><p className="caption mt-1">{count ? `${count} item${count === 1 ? "" : "s"} waiting for your next step` : "You’re all caught up."}</p></div>
      {actions.length ? <ul className="max-h-80 divide-y divide-stone-100 overflow-y-auto">{actions.map((item, index) => <li key={`${item.href}-${item.label}-${index}`}>
        <Link href={item.href} onClick={() => setOpen(false)} className="block px-4 py-3 no-underline hover:bg-stone-50">
          <span className="flex items-center justify-between gap-3 text-sm font-medium text-ink-black"><span className="truncate">{item.label}</span><span className="shrink-0 rounded-full border border-stone-200 px-2 py-0.5 text-xs tabular-nums">{item.count}</span></span>
          <span className="mt-1 block text-xs text-stone-500">{item.detail}</span>
        </Link>
      </li>)}</ul> : null}
      {role === "admin" ? <Link href="/admin" onClick={() => setOpen(false)} className="block border-t border-stone-200 px-4 py-3 text-sm font-medium text-ink-black no-underline hover:bg-stone-50">Open admin workspace</Link> : null}
    </div> : null}
  </div>;
}
