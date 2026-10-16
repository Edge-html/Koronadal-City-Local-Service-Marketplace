"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { Star, Wallet } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { ActionButton, JobCard } from "@/components/JobCard";
import {
  Card,
  EmptyState,
  Notice,
  StatCard,
} from "@/components/ui";
import {
  approveQuote,
  logDispute,
  submitReview,
} from "@/lib/data";
import { computeTotals, formatPeso } from "@/lib/commission";
import { useAuth } from "@/context/AuthContext";
import { useActivity } from "@/context/ActivityContext";
import { AttentionNotice, FlowGuide, JobFilters, CUSTOMER_STEPS } from "@/components/FlowGuide";
import { visibleJobs, type JobFilter } from "@/lib/job-flow";
import type { Job } from "@/lib/types";

export default function CustomerDashboardPage() {
  return (
    <Suspense fallback={null}>
      <CustomerDashboard />
    </Suspense>
  );
}

function CustomerDashboard() {
  const { role } = useAuth();
  const params = useSearchParams();

  const { customerJobs: jobs, customerError, customerCount } = useActivity();
  const [filter, setFilter] = useState<JobFilter>("all");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [disputing, setDisputing] = useState<string | null>(null);

  const sent = params.get("sent") === "1";

  const stats = useMemo(() => {
    if (!jobs) return null;
    return {
      awaitingQuote: jobs.filter((j) => j.status === "quoted"),
      inFlight: jobs.filter((j) =>
        ["requested", "accepted", "quoted", "in_progress"].includes(j.status),
      ).length,
      settled: jobs.filter((j) => Boolean(j.settledAt) || j.status === "reviewed")
        .length,
      committed: jobs
        .filter((j) => ["completed", "reviewed"].includes(j.status))
        .reduce((sum, job) => {
          const t = job.quote
            ? computeTotals(job.quote.laborFee, job.quote.materialsCost)
            : null;
          return sum + (t?.total ?? 0);
        }, 0),
    };
  }, [jobs]);

  if (stats === null) {
    return (
      <DashboardShell
        eyebrow={role === "worker" ? "Hiring a worker · Customer view" : "Customer dashboard"}
        title="My requests"
        subtitle="Track your requests and review quotes here."
      >
        {customerError ? <Notice tone="alert">{customerError}</Notice> : <p className="mb-4 text-sm text-stone-500">Loading your requests…</p>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Open requests" value="—" />
          <StatCard label="Awaiting approval" value="—" />
          <StatCard label="Finished jobs" value="—" />
          <StatCard label="Completed job value" value="—" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      eyebrow={role === "worker" ? "Hiring a worker · Customer view" : "Customer dashboard"}
      title="My requests"
      subtitle="Quotes that need your approval appear first. Each request explains what happens next."
    >
      <div className="flex flex-col gap-4">
        {sent ? (
          <Notice>
            Request sent. It now appears in the worker’s jobs. This page updates automatically when they accept or send a quote.
          </Notice>
        ) : null}
        {customerError ? <Notice tone="alert">{customerError}</Notice> : null}
        <AttentionNotice count={customerCount}>{customerCount ? "Review the quotes and completed jobs below. Use the Needs your action filter to focus on your next steps." : "Your worker's updates will appear here automatically. Find another worker whenever you need a new service."}</AttentionNotice>
        <FlowGuide steps={CUSTOMER_STEPS} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Open requests"
            value={stats.inFlight}
            sublabel="Requested or underway"
          />
          <StatCard
            label="Awaiting approval"
            value={stats.awaitingQuote.length}
            sublabel="Quotes ready to review"
          />
          <StatCard
            label="Finished jobs"
            value={stats.settled}
            sublabel="Paid direct to worker"
          />
          <StatCard
            label="Completed job value"
            value={formatPeso(stats.committed)}
            sublabel="Labor plus materials"
          />
        </div>

        <JobFilters jobs={jobs ?? []} view="customer" value={filter} onChange={setFilter} />
        {jobs && jobs.length > 0 && visibleJobs(jobs, "customer", filter).length === 0 ? <p className="rounded-lg bg-white p-6 text-sm text-stone-600">No requests in this section. Choose another filter to see your requests.</p> : null}
        {jobs && jobs.length === 0 ? (
          <EmptyState
            title="No requests yet"
            description="Browse the directory, pick a verified worker, and describe what needs doing. Their acceptance appears in your requests."
            action={{ label: "Browse workers", href: "/browse" }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {visibleJobs(jobs ?? [], "customer", filter).map((job) => (
              <JobCard
                key={job.id}
                job={job}
                counterpartLabel="Assigned worker"
                counterpartName={job.workerName}
                counterpartPhone={job.workerPhone}
                view="customer"
                actions={
                  <>
                    {job.status === "quoted" ? (
                      <>
                        <ApproveButton job={job} />
                        <Link
                          href={`/worker/${job.workerId}`}
                          className="btn-neutral btn-sm no-underline"
                        >
                          View profile
                        </Link>
                        <button
                          type="button"
                          className="btn-neutral btn-sm"
                          onClick={() =>
                            setDisputing(disputing === job.id ? null : job.id)
                          }
                        >
                          Report a problem
                        </button>
                      </>
                    ) : null}

                    {job.status === "completed" && job.settledAt ? (
                      <ActionButton
                        variant="neutral"
                        onClick={() =>
                          setReviewing(reviewing === job.id ? null : job.id)
                        }
                        icon={<Star size={13} strokeWidth={1.5} />}
                      >
                        Leave a review
                      </ActionButton>
                    ) : null}

                    {job.status === "completed" && !job.settledAt ? (
                      <span className="caption">Awaiting commission settlement before review.</span>
                    ) : null}

                    {job.status === "disputed" ? (
                      <span className="caption">
                        Logged with the platform. Admin will follow up.
                      </span>
                    ) : null}
                  </>
                }
              >
                {reviewing === job.id && job.status === "completed" ? <ReviewForm key={`review-${job.id}`} job={job} onDone={async () => setReviewing(null)} /> : null}
                {disputing === job.id && job.status === "quoted" ? <DisputeForm key={`dispute-${job.id}`} job={job} onDone={async () => setDisputing(null)} /> : null}
              </JobCard>
            ))}
          </div>
        )}

        <Card className="flex items-start gap-3 p-5">
          <Wallet
            size={15}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0 text-stone-400"
          />
          <p className="text-[13px] leading-[1.5] text-stone-600">
            Pay cash or GCash directly to your worker after the work is done.
            Check the full quote above before approving. The platform commission
            comes from the worker’s labor fee; it is not an extra charge on top of your total.
          </p>
        </Card>
      </div>
    </DashboardShell>
  );
}

/**
 * Approval locks the commission, so it needs the worker's live wallet balance
 * rather than anything cached in list state — a stale balance could otherwise
 * lock the wrong amount.
 */
function ApproveButton({
  job,
}: {
  job: Job;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = job.quote
    ? computeTotals(job.quote.laborFee, job.quote.materialsCost).total
    : 0;

  const run = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await approveQuote(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve the quote.");
    } finally {
      setBusy(false);
    }
  }, [job]);

  return (
    <span className="flex flex-col gap-1">
      <ActionButton onClick={run} busy={busy}>
        Approve {formatPeso(total)}
      </ActionButton>
      {error ? <span className="caption text-alert-coral">{error}</span> : null}
    </span>
  );
}

function ReviewForm({ job, onDone }: { job: Job; onDone: () => Promise<void> }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      await submitReview(job, rating, text.trim());
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
          Rate {job.workerName}
        </h3>
        <p className="caption mt-0.5">
          Describe your experience with the completed work.
        </p>
      </div>

      <fieldset>
        <legend className="label">Rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-pressed={rating === value}
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
              className="rounded-md p-1"
            >
              <Star
                size={20}
                strokeWidth={1.5}
                className={
                  value <= rating
                    ? "fill-ink-black text-ink-black"
                    : "fill-transparent text-stone-200"
                }
              />
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="review-text">
          Review
        </label>
        <textarea
          id="review-text"
          className="field min-h-[88px] resize-y"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="How was the work? Were materials as quoted?"
        />
      </div>

      {error ? <Notice tone="alert">{error}</Notice> : null}

      <ActionButton onClick={run} busy={busy} disabled={text.trim().length < 5}>
        Submit review
      </ActionButton>
    </Card>
  );
}

function DisputeForm({ job, onDone }: { job: Job; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      await logDispute(job, reason.trim(), "consumer");
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
          Dispute this quote
        </h3>
        <p className="caption mt-0.5">
          Disputes are logged with the platform and routed to an administrator
          under RA 7394.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="dispute-reason">
          What went wrong
        </label>
        <textarea
          id="dispute-reason"
          className="field min-h-[80px] resize-y"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe the discrepancy between the quote and the work."
        />
      </div>

      {error ? <Notice tone="alert">{error}</Notice> : null}
      <ActionButton
        onClick={run}
        busy={busy}
        disabled={reason.trim().length < 10}
        variant="neutral"
      >
        Submit dispute
      </ActionButton>
    </Card>
  );
}