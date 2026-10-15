"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
  listConsumerJobs,
  logDispute,
  submitReview,
} from "@/lib/data";
import { computeTotals, formatPeso } from "@/lib/commission";
import { useAuth } from "@/context/AuthContext";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { getWorkerByUid } from "@/lib/data";
import type { Job } from "@/lib/types";

export default function CustomerDashboardPage() {
  return (
    <Suspense fallback={null}>
      <CustomerDashboard />
    </Suspense>
  );
}

function CustomerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [hasWorkerProfile, setHasWorkerProfile] = useState(false);
  const params = useSearchParams();

  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [disputing, setDisputing] = useState<string | null>(null);

  const sent = params.get("sent") === "1";

  // Resolve whether this household also has a worker profile, which decides if
  // the "working as a provider" switch is offered.
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    getWorkerByUid(user.uid)
      .then((w) => {
        if (!cancelled) setHasWorkerProfile(!!w);
      })
      .catch(() => {
        if (!cancelled) setHasWorkerProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    listConsumerJobs(user.uid)
      .then((rows) => {
        if (!cancelled) setJobs(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setJobs([]);
          setError("Could not load your requests. Please refresh to try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

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
        eyebrow="Household console"
        title="My requests"
        subtitle="Track every job from first contact to settlement."
      >
        <ModeSwitcher available={hasWorkerProfile} />

        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="In flight" value="—" />
          <StatCard label="Awaiting approval" value="—" />
          <StatCard label="Settled" value="—" />
          <StatCard label="Total committed" value="—" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      eyebrow="Household console"
      title="My requests"
      subtitle="Track every job from first contact to settlement. Approve the quote before any work starts."
    >
      <div className="flex flex-col gap-4">
        {sent ? (
          <Notice>
            Request sent. The worker has been alerted by SMS and in-app. You
            will be notified when they accept.
          </Notice>
        ) : null}
        {error ? <Notice tone="alert">{error}</Notice> : null}

        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard
            label="In flight"
            value={stats.inFlight}
            sublabel="Requested or underway"
          />
          <StatCard
            label="Awaiting approval"
            value={stats.awaitingQuote.length}
            sublabel="Quotes ready to review"
          />
          <StatCard
            label="Settled"
            value={stats.settled}
            sublabel="Paid direct to worker"
          />
          <StatCard
            label="Total committed"
            value={formatPeso(stats.committed)}
            sublabel="Labor plus materials"
          />
        </div>

        {jobs && jobs.length === 0 ? (
          <EmptyState
            title="No requests yet"
            description="Browse the directory, pick a verified worker, and describe what needs doing. Their acceptance appears in your requests."
            action={{ label: "Browse workers", href: "/browse" }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {jobs?.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                counterpartLabel="Assigned worker"
                counterpartName={job.workerName}
                counterpartPhone={job.workerPhone}
                showQuote={false}
                actions={
                  <>
                    {job.status === "quoted" ? (
                      <>
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
                          Dispute
                        </button>
                        <ApproveButton
                          job={job}
                          onDone={async () =>
                            setJobs(await listConsumerJobs(user!.uid))
                          }
                        />
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
              />
            ))}
          </div>
        )}

        {reviewing && jobs ? (
          <ReviewForm
            job={jobs.find((j) => j.id === reviewing)!}
            onDone={async () => {
              setReviewing(null);
              setJobs(await listConsumerJobs(user!.uid));
            }}
          />
        ) : null}

        {disputing && jobs ? (
          <DisputeForm
            job={jobs.find((j) => j.id === disputing)!}
            onDone={async () => {
              setDisputing(null);
              setJobs(await listConsumerJobs(user!.uid));
            }}
          />
        ) : null}

        <Card className="flex items-start gap-3 p-5">
          <Wallet
            size={15}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0 text-stone-400"
          />
          <p className="text-[13px] leading-[1.5] text-stone-600">
            Payment is non-custodial: you hand cash or GCash straight to the
            worker once the work is done, and the platform never holds your
            funds. Every quote splits labor from materials, so materials carry
            zero commission.
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
  onDone,
}: {
  job: Job;
  onDone: () => Promise<void>;
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
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve the quote.");
    } finally {
      setBusy(false);
    }
  }, [job, onDone]);

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
          Reviews are algorithmically audited to prevent malicious feedback.
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

  async function run() {
    setBusy(true);
    try {
      await logDispute(job, reason.trim(), "consumer");
      await onDone();
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