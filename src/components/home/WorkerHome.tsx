"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { ActionButton, JobCard } from "@/components/JobCard";
import {
  Badge,
  Card,
  EmptyState,
  Notice,
  SectionHeader,
  Skeleton,
  StatCard,
  safeAsync,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { acceptJob, declineJob, getWorkerByUid } from "@/lib/data";
import { useActivity } from "@/context/ActivityContext";
import { AttentionNotice, FlowGuide, WORKER_STEPS } from "@/components/FlowGuide";
import { nextStep } from "@/lib/job-flow";
import { formatDate } from "@/lib/utils";
import type { Worker } from "@/lib/types";

/**
 * The worker home is the incoming job request queue.
 *
 * Only the two actions that matter on arrival — accept and decline — are here.
 * Quoting, completing, settlement and wallet stay in the jobs dashboard
 * at /dashboard/worker, which this links to. A worker should be able to clear
 * an incoming request from the home page without the home page growing a
 * second copy of the whole six-stage lifecycle.
 */
export function WorkerHome() {
  const { user, loading: authLoading } = useAuth();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const { workerJobs: jobs, workerError, workerCount } = useActivity();
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    const w = await getWorkerByUid(user.uid);
    setWorker(w);

  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const w = await getWorkerByUid(user.uid);
        if (cancelled) return;
        setWorker(w);
        setProfileLoaded(true);

      } catch (err) {
        console.error("[home] worker load failed:", err);
        if (cancelled) return;

        setProfileLoaded(true);
        setError("Could not load your jobs. Please refresh to try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (!worker || !window.location.hash) return;
    const id = window.location.hash.slice(1);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, [worker]);

  const open = (jobs ?? []).filter((j) => j.status === "requested");
  const active = (jobs ?? []).filter((j) =>
    ["accepted", "quoted", "in_progress"].includes(j.status),
  );
  const closed = (jobs ?? []).filter((j) =>
    ["completed", "reviewed"].includes(j.status),
  );

  if (profileLoaded && jobs !== null && !worker && !error) {
    return (
      <section className="section container-page">
        <p className="label">Worker home</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-[44px] leading-[1.05] text-ink-black sm:text-[56px]">
          Get ready for job requests.
        </h1>
        <p className="mt-4 max-w-[54ch] text-[16px] leading-[1.5] text-stone-600">
          Finish your worker profile to appear in the directory and receive job requests.
        </p>
        <Link href="/dashboard/worker/onboarding" className="btn-primary mt-6 w-fit no-underline">
          Complete worker profile
        </Link>
      </section>
    );
  }

  if (worker && !worker.verified) {
    return (
      <section className="section container-page">
        <p className="label">Worker home</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-[44px] leading-[1.05] text-ink-black sm:text-[56px]">
          Your worker profile is under review.
        </h1>
        <p className="mt-4 max-w-[54ch] text-[16px] leading-[1.5] text-stone-600">
          An administrator needs to approve your credentials before households can find your profile or send requests.
        </p>
        <Link href="/dashboard/worker/credentials" className="btn-primary mt-6 w-fit no-underline">
          Review your credentials
        </Link>
      </section>
    );
  }

  return (
    <>
      <section id="my-jobs" className="container-page scroll-mt-20 pb-20 pt-14 sm:pt-20">
        <SectionHeader
          eyebrow="My jobs"
          title="Requests waiting on you"
          description="Check new requests here. After accepting, open My jobs to send your quote and track the work."
          action={
            <Link href="/dashboard/worker" className="btn-neutral no-underline">
              Go to My jobs
            </Link>
          }
        />

        {error ? (
          <Notice tone="alert" className="mt-6">
            {error}
          </Notice>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          {workerError ? <Notice tone="alert">{workerError}</Notice> : null}
          {message ? <Notice>{message} <Link href="/dashboard/worker" className="font-medium underline">Open My jobs to write your quote.</Link></Notice> : null}
          <AttentionNotice count={workerCount} href="/dashboard/worker">{workerCount ? `${workerCount} ${workerCount === 1 ? "job needs" : "jobs need"} a response, a quote, or settlement. New requests are below; all next steps are in My jobs.` : "New requests will appear here automatically. Track accepted jobs from My jobs."}</AttentionNotice>
          <FlowGuide steps={WORKER_STEPS} />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard label="New requests" value={open.length} />
          <StatCard label="In progress" value={active.length} />
          <StatCard label="Completed" value={closed.length} />
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {jobs === null ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="flex flex-col gap-3 p-5">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-10 w-full" />
              </Card>
            ))
          ) : jobs.length === 0 ? (
            <EmptyState
              title="No requests yet"
              description="Requests arrive when a household picks you from the directory. Keep your profile up to date so they can find you."
              action={{ label: "Edit your profile", href: "/dashboard/worker/profile" }}
            />
          ) : (
            <>
              {/* Requests still awaiting a decision, which is the actionable
                  part. Everything else is history and lives in the console. */}
              {open.length ? (
                open.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    view="worker"
                    counterpartLabel="Household"
                    counterpartName={job.consumerName}
                    showQuote={false}
                    actions={
                      <>
                        <ActionButton
                          busy={busyId === job.id}
                          onClick={safeAsync(async () => {
                            setBusyId(job.id);
                            try {
                              setError("");
                              await acceptJob(job.id);
                              setMessage("Request accepted.");
                              await refresh();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Could not update this request.");
                            } finally {
                              setBusyId(null);
                            }
                          }, "accept-home")}
                          icon={<Check size={13} strokeWidth={2} />}
                        >
                          Accept request
                        </ActionButton>
                        <ActionButton
                          variant="neutral"
                          busy={busyId === job.id}
                          onClick={safeAsync(async () => {
                            setBusyId(job.id);
                            try {
                              await declineJob(job.id, "Worker unavailable");
                              await refresh();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Could not update this request.");
                            } finally {
                              setBusyId(null);
                            }
                          }, "decline-home")}
                          icon={<X size={13} strokeWidth={1.5} />}
                        >
                          Deny request
                        </ActionButton>
                      </>
                    }
                  />
                ))
              ) : (
                <Card className="p-5">
                  <p className="text-[14px] tracking-[-0.02em] text-ink-black">
                    Nothing waiting on a decision.
                  </p>
                  <p className="mt-1 text-[13px] leading-[1.5] text-stone-600">
                    {active.length
                      ? `${active.length} ${active.length === 1 ? "job is" : "jobs are"} accepted and under way. Open My jobs to send quotes and track the next step.`
                      : `${closed.length} ${closed.length === 1 ? "job" : "jobs"} closed out. New requests will appear here the moment they arrive.`}
                  </p>
                </Card>
              )}

              {/* Recent history, just enough to confirm nothing is stuck. */}
              {active.length || closed.length ? (
                <Card className="p-5">
                  <p className="label mb-0">Recent activity</p>
                  <ul className="divide-y divide-stone-200">
                    {[...active, ...closed].slice(0, 5).map((job) => (
                      <li
                        key={job.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <Link href={`/dashboard/worker#job-${job.id}`} className="min-w-0 flex-1 text-sm text-ink-black underline decoration-stone-400 underline-offset-2 hover:decoration-ink-black">
                          {job.title}<span className="mt-1 block text-xs text-stone-500">{nextStep(job, "worker").title}</span>
                        </Link>
                        <span className="shrink-0 text-[12px] text-stone-500">
                          {formatDate(job.requestedAt)}
                        </span>
                        <Badge
                          tone={
                            job.status === "reviewed"
                              ? "verified"
                              : job.status === "completed"
                                ? "muted"
                                : "neutral"
                          }
                        >
                          {STATUS_LABEL[job.status] ?? job.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </section>

    </>
  );
}

const STATUS_LABEL: Record<string, string> = {
  requested: "New",
  accepted: "Needs a quote",
  quoted: "Awaiting approval",
  in_progress: "In progress",
  completed: "To settle",
  reviewed: "Closed",
};
