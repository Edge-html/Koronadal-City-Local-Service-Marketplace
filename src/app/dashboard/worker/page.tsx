"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Camera, Check, Upload } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { ActionButton, JobCard } from "@/components/JobCard";
import {
  Badge,
  Card,
  EmptyState,
  Notice, safeAsync,
  StatCard,
} from "@/components/ui";
import {
  acceptJob,
  addPortfolioEntry,
  completeJob,
  declineJob,
  getWorkerByUid,
  listJobsForWorker,
  settleJob,
  submitQuote,
} from "@/lib/data";
import { computeTotals, formatPeso } from "@/lib/commission";
import { CATEGORIES } from "@/lib/constants";
import { ResumeEditor } from "@/components/ResumeEditor";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { useAuth } from "@/context/AuthContext";
import type { Job, Worker } from "@/lib/types";

export default function WorkerDashboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quoting, setQuoting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    if (!user) return;
    const w = await getWorkerByUid(user.uid);
    setWorker(w);
    setJobs(w ? await listJobsForWorker(w.id) : []);
  };

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const w = await getWorkerByUid(user.uid);
        if (cancelled) return;
        setWorker(w);
        setJobs(w ? await listJobsForWorker(w.id) : []);
      } catch {
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
      newRequests: jobs.filter((j) => j.status === "requested").length,
      quoting: jobs.filter((j) => j.status === "accepted").length,
      active: jobs.filter((j) => j.status === "in_progress").length,
      toSettle: jobs.filter((j) => j.status === "completed").length,
      earned: jobs
        .filter((j) => ["completed", "reviewed"].includes(j.status))
        .reduce((sum, job) => {
          const t = job.quote
            ? computeTotals(job.quote.laborFee, job.quote.materialsCost)
            : null;
          return sum + (t?.total ?? 0);
        }, 0),
    };
  }, [jobs]);

  // A worker who has not finished registration has nothing to act on yet.
  if (!worker && stats === null) {
    return (
      <DashboardShell
        eyebrow="Worker console"
        title="Your jobs"
        subtitle="Accept requests, send quotes, and track settlement."
      >
        <p className="meta">Loading your worker profile</p>
      </DashboardShell>
    );
  }

  if (worker && !worker.verified) {
    return (
      <DashboardShell
        eyebrow="Worker console"
        title="Awaiting verification"
        subtitle="Your profile is in the admin review queue. Background checks clear within 24 to 48 hours."
      >
        <div className="flex flex-col gap-4">
          <Notice>
            You will appear in the public directory and can receive job requests
            as soon as your three mandatory credentials are approved.
          </Notice>
          <OnboardingSummary worker={worker} />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      eyebrow="Worker console"
      title="Your jobs"
      subtitle="Accept requests, send two-part quotes, and track settlement against your prepaid wallet."
    >
      <div className="flex flex-col gap-4">
        {error ? <Notice tone="alert">{error}</Notice> : null}

        {worker?.status === "paused_wallet" ? (
          <Card className="flex items-start gap-3 border-alert-coral/40 p-5">
            <AlertTriangle
              size={15}
              strokeWidth={1.5}
              className="mt-0.5 shrink-0 text-alert-coral"
            />
            <div>
              <p className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
                Wallet paused
              </p>
              <p className="mt-1 text-[13px] leading-[1.5] text-stone-600">
                Your prepaid balance has dropped below zero. You will not
                receive new job requests until you reload.{" "}
                <Link href="/dashboard/wallet" className="text-ink-black underline underline-offset-2">
                  Top up now
                </Link>
                .
              </p>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-5">
          <StatCard label="New requests" value={stats?.newRequests ?? 0} />
          <StatCard label="To quote" value={stats?.quoting ?? 0} />
          <StatCard label="In progress" value={stats?.active ?? 0} />
          <StatCard label="To settle" value={stats?.toSettle ?? 0} />
          <StatCard
            label="Billed to households"
            value={formatPeso(stats?.earned ?? 0)}
            sublabel="Received direct"
          />
        </div>

        {worker ? (
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="caption">Prepaid platform balance</p>
              <p className="mt-1 text-[24px] leading-[1.2] font-medium tracking-[-0.48px] text-ink-black tabular-nums">
                {formatPeso(worker.walletBalance)}
              </p>
              <p className="caption mt-1">
                {formatPeso(worker.walletLocked)} locked against approved quotes
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard/wallet" className="btn-primary btn-sm no-underline">
                Top up
              </Link>
              <ActionButton
                variant="neutral"
                onClick={() => setUploading((v) => !v)}
                icon={<Camera size={13} strokeWidth={1.5} />}
              >
                Add portfolio entry
              </ActionButton>
            </div>
          </Card>
        ) : null}

        {uploading && worker ? (
          <PortfolioForm workerId={worker.id} onDone={async () => {
            setUploading(false);
            await refresh();
          }} />
        ) : null}

        {worker ? (
          <>
            <ModeSwitcher available={!!worker.id} />
            <ResumeEditor worker={worker} />
          </>
        ) : null}

        {jobs && jobs.length === 0 ? (
          <EmptyState
            title="No jobs yet"
            description="Once a household sends you a request it lands here immediately, and you get an SMS alert at the same time."
            action={{ label: "View your public profile", href: `/worker/${worker?.id ?? ""}` }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {jobs?.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                counterpartLabel="Household"
                counterpartName={job.consumerName}
                showQuote={false}
                actions={
                  <>
                    {job.status === "requested" ? (
                      <>
                        <ActionButton
                          busy={busyId === job.id}
                          onClick={safeAsync(async () => {
                            setBusyId(job.id);
                            try {
                              await acceptJob(job.id, worker!);
                              await refresh();
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
                            } finally {
                              setBusyId(null);
                            }
                          })}
                        >
                          Decline
                        </ActionButton>
                      </>
                    ) : null}

                    {job.status === "accepted" ? (
                      <ActionButton
                        variant="neutral"
                        onClick={() => setQuoting(quoting === job.id ? null : job.id)}
                      >
                        {job.quote ? "Revise quote" : "Submit quote"}
                      </ActionButton>
                    ) : null}

                    {job.status === "in_progress" ? (
                      <ActionButton
                        busy={busyId === job.id}
                        onClick={safeAsync(async () => {
                          setBusyId(job.id);
                          try {
                            await completeJob(job.id);
                            await refresh();
                          } finally {
                            setBusyId(null);
                          }
                        })}
                      >
                        Mark complete
                      </ActionButton>
                    ) : null}

                    {job.status === "completed" ? (
                      <ActionButton
                        busy={busyId === job.id}
                        onClick={safeAsync(async () => {
                          setBusyId(job.id);
                          try {
                            await settleJob(job, worker!);
                            await refresh();
                          } finally {
                            setBusyId(null);
                          }
                        })}
                      >
                        Settle commission
                      </ActionButton>
                    ) : null}

                    {job.status === "reviewed" ? (
                      <span className="caption">
                        Closed. Rated {job.rating}/5 by {job.consumerName}.
                      </span>
                    ) : null}
                  </>
                }
              />
            ))}
          </div>
        )}

        {quoting && jobs ? (
          <QuoteForm
            job={jobs.find((j) => j.id === quoting)!}
            onDone={async () => {
              setQuoting(null);
              await refresh();
            }}
          />
        ) : null}
      </div>
    </DashboardShell>
  );
}

/* ------------------------------------------------------------------ */

function QuoteForm({
  job,
  onDone,
}: {
  job: Job;
  onDone: () => Promise<void>;
}) {
  const [labor, setLabor] = useState(String(job.quote?.laborFee ?? ""));
  const [materials, setMaterials] = useState(String(job.quote?.materialsCost ?? ""));
  const [notes, setNotes] = useState(job.quote?.notes ?? "");
  const [validDays, setValidDays] = useState(String(job.quote?.validDays ?? 7));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const laborNum = Number(labor) || 0;
  const materialsNum = Number(materials) || 0;
  const totals = computeTotals(laborNum, materialsNum);
  const valid = laborNum > 0 && notes.trim().length >= 5;

  async function run() {
    setBusy(true);
    setError("");
    try {
      await submitQuote(job.id, {
        laborFee: laborNum,
        materialsCost: materialsNum,
        notes: notes.trim(),
        validDays: Math.max(1, Number(validDays) || 7),
      });
      await onDone();
    } catch {
      setError("Could not send the quote. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
          Official quote for &ldquo;{job.title}&rdquo;
        </h3>
        <p className="caption mt-0.5">
          Labor and materials must be itemised separately under RA 7394.
        </p>
      </div>

      {error ? <Notice tone="alert">{error}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="q-labor">
            Labor fee (PHP)
          </label>
          <input
            id="q-labor"
            className="field"
            inputMode="decimal"
            value={labor}
            onChange={(e) => setLabor(e.target.value)}
            placeholder="2400"
          />
        </div>
        <div>
          <label className="label" htmlFor="q-materials">
            Material cost (PHP)
          </label>
          <input
            id="q-materials"
            className="field"
            inputMode="decimal"
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
            placeholder="1800"
          />
        </div>
        <div>
          <label className="label" htmlFor="q-valid">
            Valid for (days)
          </label>
          <input
            id="q-valid"
            className="field"
            inputMode="numeric"
            value={validDays}
            onChange={(e) => setValidDays(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="q-notes">
          Scope notes
        </label>
        <textarea
          id="q-notes"
          className="field min-h-[80px] resize-y"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe what is included, and what counts as an extra."
        />
      </div>

      <div className="rounded-md border border-stone-200 bg-bone">
        <dl className="grid sm:grid-cols-4">
          {[
            ["Labor", totals.laborFee, "10% commission"],
            ["Materials", totals.materialsCost, "Zero commission"],
            ["Platform fee", totals.commission, "Locked on approval"],
            ["Household pays", totals.total, "Direct to you"],
          ].map(([label, value, note], i) => (
            <div
              key={label as string}
              className={
                i > 0
                  ? "border-t border-stone-200 px-4 py-3 sm:border-t-0 sm:border-l"
                  : "px-4 py-3"
              }
            >
              <dt className="caption">{label}</dt>
              <dd className="mt-1 text-[18px] leading-[1.2] font-medium tracking-[-0.36px] text-ink-black tabular-nums">
                {formatPeso(value as number)}
              </dd>
              <dd className="caption mt-0.5">{note}</dd>
            </div>
          ))}
        </dl>
      </div>

      {totals.belowFloor ? (
        <Notice tone="alert">
          This labor fee sits below the monitored floor for this service. Quotes
          under floor can be flagged during admin review.
        </Notice>
      ) : null}

      <ActionButton onClick={run} busy={busy} disabled={!valid}>
        Send quote for approval
      </ActionButton>
    </Card>
  );
}

function PortfolioForm({
  workerId,
  onDone,
}: {
  workerId: string;
  onDone: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("carpentry");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await addPortfolioEntry(workerId, {
        id: `pf_${Date.now().toString(36)}`,
        jobTitle: title.trim(),
        categoryId,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      });
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
          Add a portfolio entry
        </h3>
        <p className="caption mt-0.5">
          Voluntary after a completed job. Enriches your public profile.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pf-title">
            Job title
          </label>
          <input
            id="pf-title"
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Built-in kitchen cabinets"
          />
        </div>
        <div>
          <label className="label" htmlFor="pf-cat">
            Trade
          </label>
          <select
            id="pf-cat"
            className="field"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="pf-note">
          Note
        </label>
        <textarea
          id="pf-note"
          className="field min-h-[70px] resize-y"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What you built, and any materials worth noting."
        />
      </div>

      <ActionButton
        onClick={run}
        busy={busy}
        disabled={title.trim().length < 3}
        icon={<Upload size={13} strokeWidth={1.5} />}
      >
        Publish entry
      </ActionButton>
    </Card>
  );
}

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
