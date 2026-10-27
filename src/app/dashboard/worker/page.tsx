"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { ActionButton, JobCard } from "@/components/JobCard";
import { ProfileStrength } from "@/components/ProfileStrength";
import { MyServices } from "@/components/MyServices";
import {
  Badge,
  Card,
  EmptyState,
  Notice, safeAsync,
  StatCard,
} from "@/components/ui";
import {
  acceptJob,
  completeJob,
  declineJob,
  getOrCreateConversation,
  getWorkerByUid,
  setWorkerPro,
} from "@/lib/data";

import { useActivity } from "@/context/ActivityContext";
import { AttentionNotice, FlowGuide, JobFilters, WORKER_STEPS } from "@/components/FlowGuide";
import { visibleJobs, type JobFilter } from "@/lib/job-flow";
import { useAuth } from "@/context/AuthContext";
import type { Job, Worker } from "@/lib/types";

const WORKER_BANNER_IMAGES = ["/images/local-craft.webp", "/images/metalwork.webp"] as const;

export default function WorkerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [worker, setWorker] = useState<Worker | null>(null);
  const { workerJobs: jobs, workerError, workerCount } = useActivity();
  const [filter, setFilter] = useState<JobFilter>("all");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [proBusy, setProBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    if (!user) return;
    const w = await getWorkerByUid(user.uid);
    setWorker(w);
    setProfileLoaded(true);
  };

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const w = await getWorkerByUid(user.uid);
        if (cancelled) return;
        setWorker(w);
        setProfileLoaded(true);
      } catch {
        if (!cancelled) setProfileLoaded(true);
        if (!cancelled) setError("Could not load your jobs. Please refresh.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const stats = useMemo(() => {
    if (!jobs) return null;
    return {
      received: jobs.length,
      accepted: jobs.filter((j) => ["accepted", "quoted", "in_progress", "completed", "reviewed"].includes(j.status)).length,
      active: jobs.filter((j) => j.status === "in_progress").length,
      completed: jobs.filter((j) => ["completed", "reviewed"].includes(j.status)).length,
    };
  }, [jobs]);

  async function openJobChat(job: Job) {
    if (!worker) return;
    const conversationId = job.conversationId ?? await getOrCreateConversation(worker, { id: job.consumerId, name: job.consumerName }, job.id);
    router.push(`/dashboard/messages?conversation=${encodeURIComponent(conversationId)}`);
  }

  // A worker who has not finished registration has nothing to act on yet.
  if (profileLoaded && !worker) return <DashboardShell title="My jobs" subtitle="Set up your worker profile to receive requests." bannerImages={WORKER_BANNER_IMAGES}>
    {error ? <Notice tone="alert">{error}</Notice> : <EmptyState title="Complete your worker profile" description="Add your service and verification documents to start receiving requests." action={{ label: "Set up profile", href: "/dashboard/worker/onboarding" }} />}
  </DashboardShell>;

  if (!profileLoaded || !worker || stats === null) {
    return (
      <DashboardShell
        eyebrow="Worker dashboard"
        title="My jobs"
        subtitle="Accept requests, agree on details in chat, and track your work."
        bannerImages={WORKER_BANNER_IMAGES}
      >
        {workerError ? <Notice tone="alert">{workerError}</Notice> : <p className="meta">Loading your jobs…</p>}
      </DashboardShell>
    );
  }

  if (worker && !worker.verified) {
    return (
      <DashboardShell
        eyebrow="Worker dashboard"
        title="Awaiting verification"
        subtitle="Your profile is in the admin review queue. Background checks clear within 24 to 48 hours."
        bannerImages={WORKER_BANNER_IMAGES}
      >
        <div className="flex flex-col gap-4">
          <Notice>
            You will appear in the public directory and can receive job requests
            as soon as your three mandatory credentials are approved.
          </Notice>
          <ProfileStrength worker={worker} />
          <OnboardingSummary worker={worker} />
          <Link href="/dashboard/worker/credentials" className="btn-primary w-fit no-underline">
            Upload or replace credentials
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      eyebrow="Worker dashboard"
      title="My jobs"
      subtitle="Accept requests, agree on scope and price in chat, and track completed work."
      bannerImages={WORKER_BANNER_IMAGES}
    >
      <div className="flex flex-col gap-4">
        {workerError ? <Notice tone="alert">{workerError}</Notice> : null}
        <Card className="flex flex-wrap items-center justify-between gap-4 border-blue-200 bg-blue-50/50 p-5">
          <div className="flex items-start gap-3"><span className="rounded-lg bg-blue-100 p-2 text-blue-800"><Sparkles size={16} /></span><div><h2 className="text-sm font-semibold">{worker.isPro ? "KoroHanap Pro is active" : "Try KoroHanap Pro"}</h2><p className="mt-1 max-w-[65ch] text-sm text-stone-600">Get a Pro badge, a highlighted profile card, and priority placement in the worker directory. Free during the pilot; no payment information is collected.</p></div></div>
          <ActionButton variant={worker.isPro ? "neutral" : "primary"} busy={proBusy} onClick={async () => {
            setProBusy(true); setError("");
            try { await setWorkerPro(worker.id, !worker.isPro); setWorker({ ...worker, isPro: !worker.isPro }); }
            catch (err) { setError(err instanceof Error ? err.message : "Could not update your Pro account."); }
            finally { setProBusy(false); }
          }}>{worker.isPro ? "Turn Pro off" : "Activate Pro"}</ActionButton>
        </Card>
        {worker ? <ProfileStrength worker={worker} /> : null}
        <AttentionNotice count={workerCount}>{workerCount ? `${workerCount} job${workerCount === 1 ? " needs" : "s need"} your response or agreement confirmation. Choose “Needs your action” below.` : "New requests and customer chat confirmations appear here automatically."}</AttentionNotice>
        <FlowGuide steps={WORKER_STEPS} />
        {error ? <Notice tone="alert">{error}</Notice> : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Requests received" value={stats.received} />
          <StatCard label="Accepted clients" value={stats.accepted} />
          <StatCard label="In progress" value={stats.active} />
          <StatCard label="Jobs completed" value={stats.completed} />
        </div>

        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-sm font-semibold text-ink-black">Post a service offer</h2>
            <p className="mt-1 max-w-[65ch] text-sm text-stone-600">Describe a service you provide and its starting rate. Open offers appear on your public profile for households to find.</p>
          </div>
          <a className="btn-neutral no-underline" href="#my-services">Post or manage offers</a>
        </Card>

        <JobFilters jobs={jobs ?? []} view="worker" value={filter} onChange={setFilter} />
        {jobs && jobs.length > 0 && visibleJobs(jobs, "worker", filter).length === 0 ? <div className="rounded-xl border border-stone-200 bg-white p-8 text-center"><h2 className="text-base font-medium text-ink-black">{filter === "all" ? "No Current Jobs" : filter === "history" ? "No job history yet" : "No jobs in this section"}</h2><p className="mt-2 text-sm text-stone-600">{filter === "all" ? "Completed and cancelled jobs are kept in History." : "Choose another tab to view your jobs."}</p></div> : null}

        {jobs && jobs.length === 0 ? (
          <EmptyState
            title="No Current Jobs"
            description="New household requests will appear here. Completed and cancelled work is kept in History."
            action={{ label: "View your public profile", href: `/worker/${worker?.id ?? ""}` }}
          />
        ) : visibleJobs(jobs ?? [], "worker", filter).length === 0 ? null : (
          <div className="flex flex-col gap-3">
            {visibleJobs(jobs ?? [], "worker", filter).map((job) => (
              <JobCard
                key={job.id}
                job={job}
                counterpartLabel="Household"
                counterpartName={job.consumerName}
                counterpartPhone={job.consumerPhone}
                view="worker"
                actions={
                  <>
                    {job.status === "requested" ? (
                      <>
                        <ActionButton
                          busy={busyId === job.id}
                          onClick={safeAsync(async () => {
                            setBusyId(job.id);
                            try {
                              await acceptJob(job.id);
                              await refresh();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Could not update this job.");
                            } finally {
                              setBusyId(null);
                            }
                          })}
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
                              setError(err instanceof Error ? err.message : "Could not update this job.");
                            } finally {
                              setBusyId(null);
                            }
                          })}
                        >
                          Deny request
                        </ActionButton>
                      </>
                    ) : null}

                    {job.status === "accepted" || job.status === "quoted" ? (
                      <ActionButton onClick={() => openJobChat(job)}>
                        {job.workerAgreedAt ? "Open chat · waiting for household" : "Open chat and agree"}
                      </ActionButton>
                    ) : null}

                    {job.status === "in_progress" ? (
                      <ActionButton
                        onClick={() => setCompleting(completing === job.id ? null : job.id)}
                      >
                        {completing === job.id ? "Cancel" : "Mark work complete"}
                      </ActionButton>
                    ) : null}
                    {job.status === "completed" ? (
                      <span className="caption">Job completed. Payment arrangements are handled directly with the household.</span>
                    ) : null}

                    {job.status === "reviewed" ? (
                      <span className="caption">
                        Closed. Rated {job.rating}/5 by {job.consumerName}.
                      </span>
                    ) : null}
                  </>
                }
              >
                {completing === job.id && job.status === "in_progress" ? <CompleteJobForm job={job} onCancel={() => setCompleting(null)} onDone={async () => { setCompleting(null); await refresh(); }} /> : null}
              </JobCard>
            ))}
          </div>
        )}

      </div>
      <div className="mt-12 border-t border-stone-200 pt-8">
        <MyServices worker={worker} />
      </div>
    </DashboardShell>
  );
}

/* ------------------------------------------------------------------ */

function OnboardingSummary({ worker }: { worker: Worker }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-stone-200 px-5 py-4">
        <h3 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
          Submitted credentials
        </h3>
      </div>
      <ul className="divide-y divide-stone-200">
        {worker.verificationDocs.map((doc) => (
          <li key={doc.type} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-[14px] tracking-[-0.02em] text-stone-700">
              {doc.fileName}
            </span>
            <Badge tone={doc.reviewState === "approved" ? "neutral" : "muted"}>
              {doc.reviewState === "pending" ? "In review" : doc.reviewState}
            </Badge>
          </li>
        ))}
        {worker.verificationDocs.length === 0 ? (
          <li className="px-5 py-4 text-[13px] text-stone-500">
            No documents uploaded yet.
          </li>
        ) : null}
      </ul>
    </Card>
  );
}

function CompleteJobForm({ job, onCancel, onDone }: { job: Job; onCancel: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true); setError("");
    try { await completeJob(job.id); await onDone(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not mark this job complete."); }
    finally { setBusy(false); }
  }
  return <Card className="flex flex-col gap-3 border-ink-black p-4">
    <div><h3 className="text-sm font-semibold">Mark “{job.title}” complete?</h3><p className="caption mt-1">Confirm the agreed work is finished. Price and payment arrangements stay between you and the household in chat.</p></div>
    {error ? <Notice tone="alert">{error}</Notice> : null}
    <div className="flex gap-2"><ActionButton busy={busy} onClick={submit}>Confirm completion</ActionButton><ActionButton variant="neutral" onClick={onCancel}>Cancel</ActionButton></div>
  </Card>;
}
