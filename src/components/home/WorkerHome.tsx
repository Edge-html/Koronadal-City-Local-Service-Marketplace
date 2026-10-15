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
import { MyServices } from "@/components/MyServices";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { useAuth } from "@/context/AuthContext";
import { acceptJob, declineJob, getWorkerByUid, listJobsForWorker } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import type { Job, Worker } from "@/lib/types";

/**
 * The worker half of the home page: my jobs, then my services.
 *
 * My jobs leads, because a request from a household is time-sensitive — it goes
 * stale while it waits. My services comes second because posting an offer is
 * something you do once and then maintain.
 *
 * Only the two actions that matter on arrival — accept and decline — are here.
 * Quoting, completing, settling, wallet and portfolio stay in the full console
 * at /dashboard/worker, which this links to. A worker should be able to clear
 * an incoming request from the home page without the home page growing a
 * second copy of the whole six-stage lifecycle.
 */
export function WorkerHome() {
  const { user, loading: authLoading } = useAuth();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    const w = await getWorkerByUid(user.uid);
    setWorker(w);
    setJobs(w ? await listJobsForWorker(w.uid) : []);
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const w = await getWorkerByUid(user.uid);
        if (cancelled) return;
        setWorker(w);
        setJobs(w ? await listJobsForWorker(w.uid) : []);
      } catch (err) {
        console.error("[home] worker load failed:", err);
        if (cancelled) return;
        setJobs([]);
        setError("Could not load your jobs. Please refresh to try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const open = (jobs ?? []).filter((j) => j.status === "requested");
  const active = (jobs ?? []).filter((j) =>
    ["accepted", "in_progress"].includes(j.status),
  );
  const closed = (jobs ?? []).filter((j) =>
    ["completed", "reviewed"].includes(j.status),
  );

  return (
    <>
      <section className="section container-page">
        <SectionHeader
          eyebrow="My jobs"
          title="Requests waiting on you"
          description="Households that selected you from the directory. Accepting one locks it to you; declining returns it without penalty."
          action={
            <Link href="/dashboard/worker" className="btn-neutral no-underline">
              Open the full console
            </Link>
          }
        />

        {error ? (
          <Notice tone="alert" className="mt-6">
            {error}
          </Notice>
        ) : null}

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
              description="Requests arrive when a household picks you from the directory. In the meantime, post an offer below so people browsing your trade can find you."
              action={{ label: "Post an offer", href: "#my-services" }}
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
                              await acceptJob(job.id);
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
                          Decline
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
                      ? `${active.length} ${active.length === 1 ? "job is" : "jobs are"} accepted and under way. Quotes, completion and settlement are in the console.`
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
                        <span className="min-w-0 flex-1 truncate text-[13px] tracking-[-0.02em] text-stone-700">
                          {job.title}
                        </span>
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

      {worker ? (
        <>
          <div className="container-page">
            <ModeSwitcher available={!!worker.id} />
          </div>
          <MyServices worker={worker} />
        </>
      ) : null}
    </>
  );
}

const STATUS_LABEL: Record<string, string> = {
  requested: "New",
  accepted: "Accepted",
  in_progress: "In progress",
  completed: "To settle",
  reviewed: "Closed",
};