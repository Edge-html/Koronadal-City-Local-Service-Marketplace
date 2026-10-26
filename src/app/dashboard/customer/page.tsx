"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { ActionButton, JobCard } from "@/components/JobCard";
import { Card, EmptyState, Notice, StatCard } from "@/components/ui";
import { getOrCreateConversation, getWorker, submitReview } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { useActivity } from "@/context/ActivityContext";
import { AttentionNotice, FlowGuide, JobFilters, CUSTOMER_STEPS } from "@/components/FlowGuide";
import { visibleJobs, type JobFilter } from "@/lib/job-flow";
import type { Job } from "@/lib/types";

export default function CustomerDashboardPage() {
  return <Suspense fallback={null}><CustomerDashboard /></Suspense>;
}

function CustomerDashboard() {
  const { role, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { customerJobs: jobs, customerError, customerCount } = useActivity();
  const [filter, setFilter] = useState<JobFilter>("all");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [openingChat, setOpeningChat] = useState<string | null>(null);
  const [error, setError] = useState("");
  const sent = params.get("sent") === "1";
  const requestEmail = params.get("email");
  const reviewLinkJobId = params.get("review");

  useEffect(() => {
    if (!reviewLinkJobId || !user || !jobs) return;
    const target = jobs.find((job) => job.id === reviewLinkJobId && job.consumerId === user.uid
      && job.status === "completed" && Boolean(job.agreementApprovedAt || job.settledAt));
    if (target) setReviewing(target.id);
  }, [jobs, reviewLinkJobId, user]);

  const stats = useMemo(() => {
    if (!jobs) return null;
    return {
      open: jobs.filter((job) => ["requested", "accepted", "quoted", "in_progress"].includes(job.status)).length,
      awaitingAgreement: jobs.filter((job) => ["accepted", "quoted"].includes(job.status) && !job.consumerAgreedAt).length,
      finished: jobs.filter((job) => ["completed", "reviewed"].includes(job.status)).length,
    };
  }, [jobs]);

  async function openChat(job: Job) {
    if (!user) return;
    setOpeningChat(job.id); setError("");
    try {
      const worker = await getWorker(job.workerId);
      if (!worker) throw new Error("This worker profile is unavailable.");
      const conversationId = job.conversationId ?? await getOrCreateConversation(worker, { id: job.consumerId, name: job.consumerName }, job.id);
      router.push(`/dashboard/messages?conversation=${encodeURIComponent(conversationId)}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not open this job chat."); }
    finally { setOpeningChat(null); }
  }

  if (stats === null) return <DashboardShell eyebrow="Customer dashboard" title="My requests" subtitle="Track requests, agree on details in chat, and review completed work.">
    {customerError ? <Notice tone="alert">{customerError}</Notice> : <p className="mb-4 text-sm text-stone-500">Loading your requests…</p>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><StatCard label="Current requests" value="—" /><StatCard label="Need your agreement" value="—" /><StatCard label="Finished jobs" value="—" /></div>
  </DashboardShell>;

  return <DashboardShell eyebrow={role === "worker" ? "Hiring a worker · Customer view" : "Customer dashboard"} title="My requests" subtitle="Discuss the work and price in chat. Both sides confirm the agreement before work starts.">
    <div className="flex flex-col gap-4">
      {sent ? requestEmail === "sent" ? <Notice>Request sent. An email alert was accepted for delivery to the worker’s sign-up email.</Notice> : <Notice tone="alert">Your request was saved and appears in the worker’s jobs, but its email alert could not be sent. The worker can still respond in KoroHanap.</Notice> : null}
      {customerError || error ? <Notice tone="alert">{customerError || error}</Notice> : null}
      <AttentionNotice count={customerCount}>{customerCount ? "Review your requests and confirm any agreed details in chat." : "Worker updates will appear here. Browse the directory whenever you need another service."}</AttentionNotice>
      <FlowGuide steps={CUSTOMER_STEPS} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Current requests" value={stats.open} sublabel="Requested or underway" />
        <StatCard label="Need your agreement" value={stats.awaitingAgreement} sublabel="Confirm in the job chat" />
        <StatCard label="Finished jobs" value={stats.finished} sublabel="Completed work" />
      </div>
      <JobFilters jobs={jobs ?? []} view="customer" value={filter} onChange={setFilter} />
      {jobs && jobs.length > 0 && visibleJobs(jobs, "customer", filter).length === 0 ? <p className="rounded-lg bg-white p-6 text-sm text-stone-600">No requests in this section. Choose another filter.</p> : null}
      {jobs && jobs.length === 0 ? <EmptyState title="No requests yet" description="Browse the directory, choose a verified worker, and describe what you need." action={{ label: "Browse workers", href: "/browse" }} /> : <div className="flex flex-col gap-3">
        {visibleJobs(jobs ?? [], "customer", filter).map((job) => <JobCard key={job.id} job={job} counterpartLabel="Assigned worker" counterpartName={job.workerName} counterpartPhone={job.workerPhone} view="customer" actions={<>
          {(["accepted", "quoted", "in_progress"] as const).includes(job.status as "accepted" | "quoted" | "in_progress") ? <ActionButton busy={openingChat === job.id} onClick={() => void openChat(job)} icon={<MessageSquare size={14} />}>{job.consumerAgreedAt && job.status !== "in_progress" ? "Open chat · waiting for worker" : job.status === "in_progress" ? "Open job chat" : "Discuss and confirm in chat"}</ActionButton> : null}
          {job.status === "completed" && !job.rating ? <ActionButton variant="neutral" onClick={() => setReviewing(reviewing === job.id ? null : job.id)} icon={<Star size={13} />}>Leave a review</ActionButton> : null}
          {job.status === "reviewed" || job.rating ? <span className="caption">Reviewed · {job.rating}/5</span> : null}
        </>}>
          {reviewing === job.id && job.status === "completed" && (job.agreementApprovedAt || job.settledAt) ? <ReviewForm key={`review-${job.id}`} job={job} onDone={async () => setReviewing(null)} /> : null}
        </JobCard>)}
      </div>}
      <Card className="p-5"><p className="text-[13px] leading-[1.5] text-stone-600">KoroHanap does not collect payment for the work. Agree on the scope, service rate, schedule, and payment method directly in your private job chat.</p></Card>
    </div>
  </DashboardShell>;
}

function ReviewForm({ job, onDone }: { job: Job; onDone: () => Promise<void> }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    setBusy(true); setError("");
    try { await submitReview(job, rating, text.trim()); await onDone(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not save the review."); }
    finally { setBusy(false); }
  }
  return <Card className="flex flex-col gap-4 p-5">
    <div><h3 className="text-base font-medium">Rate {job.workerName}</h3><p className="caption mt-0.5">Describe your experience with the completed work.</p></div>
    <fieldset><legend className="label">Rating</legend><div className="flex gap-1">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} aria-pressed={rating === value} aria-label={`${value} stars`} className="rounded-md p-1"><Star size={20} className={value <= rating ? "fill-ink-black text-ink-black" : "text-stone-300"} /></button>)}</div></fieldset>
    <div><label className="label" htmlFor={`review-${job.id}`}>Review</label><textarea id={`review-${job.id}`} className="field min-h-[88px] resize-y" value={text} onChange={(event) => setText(event.target.value)} placeholder="How was the service and communication?" /></div>
    {error ? <Notice tone="alert">{error}</Notice> : null}<ActionButton onClick={run} busy={busy} disabled={text.trim().length < 5}>Submit review</ActionButton>
  </Card>;
}
