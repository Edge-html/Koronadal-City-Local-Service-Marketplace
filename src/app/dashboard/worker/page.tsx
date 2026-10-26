"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { ActionButton, JobCard } from "@/components/JobCard";
import { ProfileStrength } from "@/components/ProfileStrength";
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
  getWorkerByUid,
  settleJob,
  submitQuote,
} from "@/lib/data";
import { availableBalance, computeTotals, formatPeso } from "@/lib/commission";

import { useActivity } from "@/context/ActivityContext";
import { AttentionNotice, FlowGuide, JobFilters, WORKER_STEPS } from "@/components/FlowGuide";
import { visibleJobs, type JobFilter } from "@/lib/job-flow";
import { useAuth } from "@/context/AuthContext";
import type { Job, Worker } from "@/lib/types";
import { uploadPaymentImage, openPaymentImage } from "@/lib/payment-files";
import { approveJobPayment } from "@/lib/data";

export default function WorkerDashboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [worker, setWorker] = useState<Worker | null>(null);
  const { workerJobs: jobs, workerError, workerCount } = useActivity();
  const [filter, setFilter] = useState<JobFilter>("all");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quoting, setQuoting] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
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
      newRequests: jobs.filter((j) => j.status === "requested").length,
      quoting: jobs.filter((j) => j.status === "accepted").length,
      active: jobs.filter((j) => j.status === "in_progress").length,
      toSettle: jobs.filter((j) => j.status === "completed" && !j.settledAt && !!j.paymentProofPath).length,
    };
  }, [jobs]);

  // A worker who has not finished registration has nothing to act on yet.
  if (profileLoaded && !worker) return <DashboardShell title="My jobs" subtitle="Set up your worker profile to receive requests.">
    {error ? <Notice tone="alert">{error}</Notice> : <EmptyState title="Complete your worker profile" description="Add your service and verification documents to start receiving requests." action={{ label: "Set up profile", href: "/dashboard/worker/onboarding" }} />}
  </DashboardShell>;

  if (!profileLoaded || stats === null) {
    return (
      <DashboardShell
        eyebrow="Worker dashboard"
        title="My jobs"
        subtitle="Accept requests, send quotes, and track settlement."
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
      subtitle="Requests that need your action appear first. Open each job to see what to do next."
    >
      <div className="flex flex-col gap-4">
        {workerError ? <Notice tone="alert">{workerError}</Notice> : null}
        {worker ? <ProfileStrength worker={worker} /> : null}
        <AttentionNotice count={workerCount}>{workerCount ? `${workerCount} job${workerCount === 1 ? " needs" : "s need"} your response, a quote, or commission settlement. Choose “Needs your action” below.` : "New requests and customer approvals appear here automatically."}</AttentionNotice>
        <FlowGuide steps={WORKER_STEPS} />
        {error ? <Notice tone="alert">{error}</Notice> : null}

        {worker?.status === "paused_wallet" ? (
          <Card className="flex items-start gap-3 attention-border p-5">
            <AlertTriangle
              size={15}
              strokeWidth={1.5}
              className="attention mt-0.5 shrink-0"
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="New requests" value={stats?.newRequests ?? 0} />
          <StatCard label="To quote" value={stats?.quoting ?? 0} />
          <StatCard label="In progress" value={stats?.active ?? 0} />
          <StatCard label="Proofs to review" value={stats?.toSettle ?? 0} />
        </div>

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

                    {job.status === "accepted" ? (
                      <ActionButton
                        onClick={() => setQuoting(quoting === job.id ? null : job.id)}
                      >
                        {quoting === job.id ? "Close quote form" : "Write a quote"}
                      </ActionButton>
                    ) : null}

                    {job.status === "in_progress" ? (
                      <ActionButton
                        onClick={() => setCompleting(completing === job.id ? null : job.id)}
                      >
                        {completing === job.id ? "Cancel" : "Finish work & set payment"}
                      </ActionButton>
                    ) : null}

                    {job.status === "completed" && !job.settledAt && job.paymentProofPath ? <>
                      <ActionButton variant="neutral" onClick={() => openPaymentImage(job.paymentProofPath!, job.id)}>View finder’s proof</ActionButton>
                      <ActionButton busy={busyId === job.id} onClick={safeAsync(async () => {
                        setBusyId(job.id);
                        try { await approveJobPayment(job.id); await refresh(); }
                        catch (err) { setError(err instanceof Error ? err.message : "Could not confirm payment."); }
                        finally { setBusyId(null); }
                      })}>Confirm payment & settle commission</ActionButton>
                    </> : null}

                    {job.status === "completed" && !job.settledAt && !job.paymentMethod ? (
                      <ActionButton busy={busyId === job.id} onClick={safeAsync(async () => {
                        setBusyId(job.id);
                        try { await settleJob(job); await refresh(); }
                        catch (err) { setError(err instanceof Error ? err.message : "Could not settle the commission."); }
                        finally { setBusyId(null); }
                      })}>Settle legacy job</ActionButton>
                    ) : null}

                    {job.status === "completed" && job.settledAt ? (
                      <span className="caption">Commission settled. The household can now review.</span>
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
                {job.status === "completed" && job.paymentMethod ? <Card className="p-4"><p className="text-sm font-medium">Finder payment: {paymentMethodLabel(job.paymentMethod)}</p><p className="caption mt-1">{job.paymentReference ? `Reference: ${job.paymentReference}` : job.paymentSubmittedAt ? "Proof submitted. Check it before confirming receipt." : "Waiting for the finder to pay and submit proof."}</p></Card> : null}
                {quoting === job.id && job.status === "accepted" && worker ? <QuoteForm key={job.id} job={job} worker={worker} onDone={async () => { setQuoting(null); await refresh(); }} /> : null}
              </JobCard>
            ))}
          </div>
        )}

      </div>
    </DashboardShell>
  );
}

/* ------------------------------------------------------------------ */

function QuoteForm({
  job,
  worker,
  onDone,
}: {
  job: Job;
  worker: Worker;
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

  /**
   * Can this worker fund the commission on this quote?
   *
   * The platform locks 10% of labor out of the worker's prepaid balance at the
   * moment the household approves, and approveQuote refuses if it is short. So
   * a quote beyond the worker's headroom is not merely risky — it is a quote no
   * household can ever approve. The worker would send it, the household would
   * click Approve, and they would be told the problem is the worker's wallet,
   * which is not something the household can fix or even report usefully.
   *
   * Check it here, where the worker still controls the number, and say exactly
   * how much is missing.
   */
  const headroom = availableBalance(worker.walletBalance, worker.walletLocked);
  const shortfall = totals.commission - headroom;
  const cannotFund = laborNum > 0 && shortfall > 0;

  const valid = laborNum > 0 && notes.trim().length >= 5 && !cannotFund;

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
    } catch (err) {
      console.error("[quote] submit failed:", err);
      setError(
        "Could not send the quote. If the balance in your wallet has changed since this page loaded, reload and try again.",
      );
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

      {cannotFund ? (
        <Notice tone="alert">
          <span className="flex flex-col gap-2">
            <span>
              Your unlocked balance is {formatPeso(headroom)}, but approving this
              quote locks {formatPeso(totals.commission)} of platform commission
              against it. A household cannot approve it until you top up by{" "}
              <span className="attention">{formatPeso(shortfall)}</span>.
            </span>
            <span>
              <Link href="/dashboard/wallet" className="btn-neutral btn-sm no-underline">
                Top up your wallet
              </Link>
            </span>
          </span>
        </Notice>
      ) : null}

      <ActionButton onClick={run} busy={busy} disabled={!valid}>
        Send quote for approval
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

function paymentMethodLabel(method: NonNullable<Job["paymentMethod"]>) {
  return ({ cash: "Cash", gcash: "GCash", qr: "QR code", bank_transfer: "Bank transfer", other: "Other" })[method];
}

function CompleteJobForm({ job, onCancel, onDone }: { job: Job; onCancel: () => void; onDone: () => Promise<void> }) {
  const [method, setMethod] = useState<NonNullable<Job["paymentMethod"]>>("cash");
  const [instructions, setInstructions] = useState("");
  const [qr, setQr] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setError(""); setBusy(true);
    try {
      const qrPath = method === "qr" && qr ? await uploadPaymentImage(qr, "worker-qr") : undefined;
      await completeJob(job.id, { method, instructions: method === "cash" ? "" : instructions.trim(), qrPath });
      await onDone();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not complete this job."); }
    finally { setBusy(false); }
  }
  return <Card className="flex flex-col gap-3 border-ink-black p-4">
    <div><h3 className="text-sm font-semibold">Set how the finder will pay</h3><p className="caption mt-1">Payment goes directly to you. Your platform commission is separate.</p></div>
    {error ? <Notice tone="alert">{error}</Notice> : null}
    <label className="label" htmlFor={`pay-method-${job.id}`}>Payment method</label>
    <select id={`pay-method-${job.id}`} className="field" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
      <option value="cash">Cash</option><option value="gcash">GCash</option><option value="qr">QR code</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option>
    </select>
    {method === "cash" ? <p className="caption">Ask the finder to photograph a receipt or signed acknowledgement when submitting payment proof.</p> : <>
      <label className="label" htmlFor={`pay-details-${job.id}`}>Your payment details</label>
      <textarea id={`pay-details-${job.id}`} className="field min-h-20" maxLength={500} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={method === "gcash" ? "Account name and GCash number" : method === "bank_transfer" ? "Bank name, account name, and account number" : method === "qr" ? "Optional instructions for using your QR" : "Tell the finder how to pay"} />
    </>}
    {method === "qr" ? <div><label className="label" htmlFor={`pay-qr-${job.id}`}>Your payment QR image</label><input id={`pay-qr-${job.id}`} className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setQr(e.target.files?.[0] ?? null)} /><p className="caption mt-1">JPG, PNG, or WebP, maximum 4 MB.</p></div> : null}
    <div className="flex gap-2"><ActionButton busy={busy} disabled={method !== "cash" && instructions.trim().length < 3 || method === "qr" && !qr} onClick={submit}>Mark complete</ActionButton><ActionButton variant="neutral" onClick={onCancel}>Cancel</ActionButton></div>
  </Card>;
}
