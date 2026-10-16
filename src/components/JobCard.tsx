"use client";

import { Check, Loader2, MessageCircle, Phone, X } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { CATEGORY_MAP, JOB_STATUS_META } from "@/lib/constants";
import { computeTotals, formatPeso } from "@/lib/commission";
import { formatDate, timeAgo } from "@/lib/utils";
import type { Tone } from "@/components/ui";
import { needsAction, nextStep, type JobView } from "@/lib/job-flow";
import type { Job, JobStatus } from "@/lib/types";

/** Shared pipeline timeline. The active stage is the first unfinished step. */
const STAGES: JobStatus[] = [
  "requested",
  "accepted",
  "quoted",
  "in_progress",
  "completed",
  "reviewed",
];

export function JobTimeline({ status }: { status: JobStatus }) {
  if (status === "cancelled" || status === "disputed") return null;

  const index = STAGES.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Job progress">
      {STAGES.map((stage, i) => {
        const done = i <= index;
        const current = i === index;
        return (
          <li key={stage} className="flex items-center gap-1.5">
            <span
              className={
                current
                  ? "flex items-center gap-1.5 rounded-md border border-ink-black bg-white px-2 py-1 text-[11px] tracking-[-0.02em] text-ink-black"
                  : done
                    ? "flex items-center gap-1.5 px-2 py-1 text-[11px] tracking-[-0.02em] text-stone-600"
                    : "flex items-center gap-1.5 px-2 py-1 text-[11px] tracking-[-0.02em] text-stone-400"
              }
            >
              {done && !current ? (
                <Check size={10} strokeWidth={2} />
              ) : (
                <span className="tabular-nums">{i + 1}</span>
              )}
              {STAGE_LABELS[stage]}
            </span>
            {i < STAGES.length - 1 ? (
              <span aria-hidden className="h-px w-3 bg-stone-200" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

const STAGE_LABELS: Record<string, string> = {
  requested: "Requested",
  accepted: "Accepted",
  quoted: "Quoted",
  in_progress: "In progress",
  completed: "Completed",
  reviewed: "Reviewed",
};

/** Two-part quotation, shown identically to both parties before approval. */
export function QuoteBreakdown({ job }: { job: Job }) {
  if (!job.quote) return null;

  const t = computeTotals(job.quote.laborFee, job.quote.materialsCost);

  return (
    <div className="rounded-md border border-stone-200 bg-bone">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-2.5">
        <p className="font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] text-stone-500">
          Official quote &middot; {job.quote.validDays}-day validity
        </p>
        {job.quoteApprovedAt ? (
          <Badge tone="neutral">Approved {formatDate(job.quoteApprovedAt)}</Badge>
        ) : (
          <Badge tone="ember">Awaiting approval</Badge>
        )}
      </div>

      <dl className="grid sm:grid-cols-3">
        {[
          { label: "Labor fee", value: t.laborFee, note: "Cost of the work" },
          {
            label: "Materials",
            value: t.materialsCost,
            note: "Supplies and parts",
          },
          { label: "Total payable", value: t.total, note: "Paid to worker" },
        ].map((row, i) => (
          <div
            key={row.label}
            className={
              i > 0
                ? "border-t border-stone-200 px-4 py-3 sm:border-t-0 sm:border-l"
                : "px-4 py-3"
            }
          >
            <dt className="caption">{row.label}</dt>
            <dd className="mt-1 text-[18px] leading-[1.2] font-medium tracking-[-0.36px] text-ink-black tabular-nums">
              {formatPeso(row.value)}
            </dd>
            <dd className="caption mt-0.5">{row.note}</dd>
          </div>
        ))}
      </dl>

      <p className="border-t border-stone-200 px-4 py-2 text-xs leading-relaxed text-stone-500">The worker’s {formatPeso(t.commission)} platform commission is included in the labor fee. It is not added to the customer’s total.</p>
      {job.quote.notes ? (
        <p className="border-t border-stone-200 px-4 py-3 text-[13px] leading-[1.45] text-stone-600">
          {job.quote.notes}
        </p>
      ) : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: JobStatus }) {
  const meta = JOB_STATUS_META[status] ?? {
    label: status,
    tone: "muted" as Tone,
  };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/**
 * Contact details. Masked until the worker accepts — this is the Data Privacy
 * Act requirement enforced in the UI, not just in the data model.
 */
export function ContactReveal({
  phone,
  unlocked,
  counterpartName,
}: {
  phone: string;
  unlocked: boolean;
  counterpartName: string;
}) {
  const digits = phone.replace(/\D/g, "");
  const messenger = digits.length >= 10 ? `63${digits.slice(-10)}` : "";

  if (!unlocked) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-stone-200 bg-bone px-4 py-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-stone-400 text-[9px] text-stone-500"
        >
          ?
        </span>
        <p className="text-[12px] leading-[1.45] text-stone-600">
          Contact details for {counterpartName} stay masked until the job request
          is formally accepted.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-stone-200 bg-bone px-4 py-3">
      <a
        href={`tel:${phone}`}
        className="btn-neutral btn-sm no-underline"
      >
        <Phone size={13} strokeWidth={1.5} />
        {phone}
      </a>
      {messenger ? (
        <a
          href={`https://m.me/${messenger}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-neutral btn-sm no-underline"
        >
          <MessageCircle size={13} strokeWidth={1.5} />
          Messenger
        </a>
      ) : null}
      <span className="caption">Unlocked on acceptance</span>
    </div>
  );
}

export function JobCard({
  job,
  counterpartLabel,
  counterpartName,
  counterpartPhone,
  actions,
  showQuote = true,
  view,
  children,
}: {
  job: Job;
  counterpartLabel: string;
  counterpartName: string;
  counterpartPhone?: string;
  actions?: React.ReactNode;
  showQuote?: boolean;
  view?: JobView;
  children?: React.ReactNode;
}) {
  const trade = CATEGORY_MAP[job.categoryId];
  const guidance = view ? nextStep(job, view) : null;
  const unlocked = !["requested", "cancelled", "disputed"].includes(job.status);

  return (
    <Card id={`job-${job.id}`} className="flex scroll-mt-24 flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
              {job.title}
            </h3>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-[13px] text-stone-600">
            {trade?.name ?? "General"} &middot; {job.barangay} &middot;{" "}
            {timeAgo(job.requestedAt)}
          </p>
        </div>
        <p className="caption shrink-0 text-right">
          {counterpartLabel}
          <span className="mt-0.5 block text-[13px] tracking-[-0.02em] text-stone-800">
            {counterpartName}
          </span>
        </p>
      </div>

      <p className="text-[13px] leading-[1.5] text-stone-700">{job.description}</p>

      {guidance ? <div className={`rounded-lg p-3 ${view && needsAction(job, view) ? "border border-blue-200 bg-blue-50" : "bg-stone-50"}`}>
        <p className="text-sm font-semibold text-stone-900">{guidance.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">{guidance.detail}</p>
      </div> : null}
      <details><summary className="cursor-pointer text-xs text-stone-500">View job progress</summary><div className="mt-3"><JobTimeline status={job.status} /></div></details>

      {showQuote && job.quote ? <QuoteBreakdown job={job} /> : null}

      {counterpartPhone ? (
        <ContactReveal
          phone={counterpartPhone}
          unlocked={unlocked}
          counterpartName={counterpartName}
        />
      ) : null}

      {actions ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-4">
          {actions}
        </div>
      ) : null}
      {children}
    </Card>
  );
}

/**
 * Handlers passed to these buttons are async and guard their own state with
 * try/finally but no catch. A rejected Firestore call would escape as an
 * unhandled promise rejection ("Uncaught (in promise)") with nothing telling
 * the user the action failed. Settling the promise here means the rejection is
 * always observed.
 */
function settle(fn: () => void | Promise<void>, label: string) {
  return () => {
    try {
      Promise.resolve(fn()).catch((error) => {
        console.error(`[${label}] action failed:`, error);
      });
    } catch (error) {
      console.error(`[${label}] action failed:`, error);
    }
  };
}

export function ActionButton({
  busy,
  onClick,
  children,
  variant = "primary",
  disabled,
  icon,
}: {
  busy?: boolean;
  onClick: () => void | Promise<void>;
  children: React.ReactNode;
  variant?: "primary" | "neutral";
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={settle(onClick, "ActionButton")}
      disabled={busy || disabled}
      className={variant === "primary" ? "btn-primary btn-sm" : "btn-neutral btn-sm"}
    >
      {busy ? (
        <>
          <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
          Working
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}

export function DeclineButton({
  onClick,
  busy,
}: {
  onClick: () => void | Promise<void>;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={settle(onClick, "DeclineButton")}
      disabled={busy}
      className="btn-neutral btn-sm"
    >
      {busy ? (
        <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
      ) : (
        <X size={13} strokeWidth={1.5} />
      )}
      Decline
    </button>
  );
}
