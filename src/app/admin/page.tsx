"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { ActionButton } from "@/components/JobCard";
import {
  Badge,
  Card,
  EmptyState,
  Notice,
  StatCard,
} from "@/components/ui";
import { CATEGORY_MAP } from "@/lib/constants";
import { DOC_TYPES, type Job, type Worker } from "@/lib/types";
import { decideVerification, listAllJobs, listPendingWorkers } from "@/lib/data";
import { computeTotals, formatPeso } from "@/lib/commission";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export default function AdminPage() {
  const { role, loading: authLoading } = useAuth();

  const [pending, setPending] = useState<Worker[] | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setPending(await listPendingWorkers());
    setJobs(await listAllJobs());
  };

  useEffect(() => {
    if (authLoading) return;
    // Gate on role before touching admin data.
    if (role !== "admin") {
      setPending([]);
      return;
    }
    load().catch(() => setError("Could not load the review queue."));
  }, [authLoading, role]);

  if (authLoading) return null;

  if (role !== "admin") {
    return (
      <DashboardShell
        eyebrow="Administration"
        title="Review queue"
        subtitle="Worker credential review and marketplace oversight."
      >
        <EmptyState
          icon={<ShieldCheck size={24} strokeWidth={1.5} />}
          title="Administrators only"
          description="This console is limited to platform administrators performing credential review and dispute handling."
        />
      </DashboardShell>
    );
  }

  const openDisputes = jobs.filter((j) => j.status === "disputed");
  const underFloor = jobs.filter((j) => {
    const trade = CATEGORY_MAP[j.categoryId];
    if (!j.quote || !trade) return false;
    return j.quote.laborFee > 0 && j.quote.laborFee < trade.floor;
  });

  async function decide(worker: Worker, approve: boolean) {
    setBusyId(worker.id);
    setError("");
    try {
      await decideVerification(
        worker,
        approve,
        notes[worker.id]?.trim() ?? "",
      );
      await load();
    } catch {
      setError("Could not record that decision. Please retry.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardShell
      eyebrow="Administration"
      title="Review queue"
      subtitle="Worker credential review, dispute handling, and anti-exploitation monitoring."
    >
      <div className="flex flex-col gap-4">
        {error ? <Notice tone="alert">{error}</Notice> : null}

        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard
            label="Awaiting verification"
            value={pending?.length ?? 0}
            sublabel="Background check queue"
          />
          <StatCard
            label="Open disputes"
            value={openDisputes.length}
            sublabel="Logged under RA 7394"
          />
          <StatCard
            label="Below price floor"
            value={underFloor.length}
            sublabel="Monitored for predatory pricing"
          />
          <StatCard
            label="Tracked jobs"
            value={jobs.length}
            sublabel="Most recent 200"
          />
        </div>

        {/* Verification queue */}
        <Card className="overflow-hidden p-0">
          <div className="border-b border-stone-200 px-5 py-4">
            <h2 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
              Credential review
            </h2>
            <p className="caption mt-0.5">
              Three mandatory documents required; TESDA certification is
              optional and grants a profile badge
            </p>
          </div>

          {pending === null ? (
            <p className="px-5 py-8 text-[14px] text-stone-500">Loading queue…</p>
          ) : pending.length === 0 ? (
            <p className="px-5 py-8 text-[14px] text-stone-500">
              The queue is clear. No workers awaiting verification.
            </p>
          ) : (
            <ul className="divide-y divide-stone-200">
              {pending.map((worker) => {
                const trade = CATEGORY_MAP[worker.categoryId];
                const hasTesda = worker.verificationDocs.some(
                  (d) => d.type === "tesda_certificate",
                );
                const mandatory = (Object.keys(DOC_TYPES) as Array<
                  keyof typeof DOC_TYPES
                >).filter((t) => DOC_TYPES[t].requirement === "mandatory");
                const complete = mandatory.every((t) =>
                  worker.verificationDocs.some((d) => d.type === t),
                );

                return (
                  <li key={worker.id} className="flex flex-col gap-4 px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
                          {worker.fullName}
                        </h3>
                        <p className="mt-0.5 text-[13px] text-stone-600">
                          {trade?.name ?? "General"} &middot; {worker.barangay}{" "}
                          &middot; {worker.yearsExperience} yrs &middot;{" "}
                          {worker.phone || worker.email}
                        </p>
                        <p className="caption mt-0.5">
                          Applied {formatDate(worker.createdAt)}
                        </p>
                      </div>
                      <Badge tone={complete ? "neutral" : "ember"}>
                        {complete
                          ? "All mandatory docs present"
                          : "Missing mandatory docs"}
                      </Badge>
                    </div>

                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {worker.verificationDocs.map((doc) => (
                        <li
                          key={doc.type}
                          className="flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-bone px-3 py-2"
                        >
                          <span className="truncate text-[12px] text-stone-700">
                            {DOC_TYPES[doc.type].label}
                          </span>
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="caption shrink-0 text-stone-800 underline underline-offset-2"
                          >
                            View
                          </a>
                        </li>
                      ))}
                      {worker.verificationDocs.length === 0 ? (
                        <li className="text-[13px] text-stone-500">
                          No documents submitted.
                        </li>
                      ) : null}
                    </ul>

                    {worker.bio ? (
                      <p className="text-[13px] leading-[1.5] text-stone-600">
                        {worker.bio}
                      </p>
                    ) : null}

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label className="label" htmlFor={`notes-${worker.id}`}>
                          Review notes
                        </label>
                        <input
                          id={`notes-${worker.id}`}
                          className="field"
                          value={notes[worker.id] ?? ""}
                          onChange={(e) =>
                            setNotes((prev) => ({
                              ...prev,
                              [worker.id]: e.target.value,
                            }))
                          }
                          placeholder="Recorded against the profile for audit"
                        />
                      </div>
                      <div className="flex gap-2">
                        <ActionButton
                          variant="neutral"
                          busy={busyId === worker.id}
                          onClick={() => decide(worker, false)}
                        >
                          Reject
                        </ActionButton>
                        <ActionButton
                          busy={busyId === worker.id}
                          onClick={() => decide(worker, true)}
                        >
                          Approve &amp; activate
                        </ActionButton>
                      </div>
                    </div>

                    {hasTesda ? (
                      <p className="caption">
                        TESDA certificate submitted — approval grants the TESDA
                        Certified badge.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Oversight */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-stone-200 px-5 py-4">
              <h2 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
                Disputes
              </h2>
              <p className="caption mt-0.5">Logged for clear recourse</p>
            </div>
            {openDisputes.length === 0 ? (
              <p className="px-5 py-8 text-[14px] text-stone-500">
                No open disputes.
              </p>
            ) : (
              <ul className="divide-y divide-stone-200">
                {openDisputes.map((job) => (
                  <li key={job.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
                        {job.title}
                      </p>
                      <Badge tone="muted">{formatDate(job.requestedAt)}</Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-stone-600">
                      {job.consumerName} ↔ {job.workerName} &middot;{" "}
                      {job.barangay}
                    </p>
                    {job.quote ? (
                      <p className="mt-1 text-[12px] text-stone-500 tabular-nums">
                        Labor {formatPeso(job.quote.laborFee)} &middot; Materials{" "}
                        {formatPeso(job.quote.materialsCost)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-stone-200 px-5 py-4">
              <h2 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
                Quotes below price floor
              </h2>
              <p className="caption mt-0.5">
                Monitored to prevent predatory pricing or illegal undercutting
              </p>
            </div>
            {underFloor.length === 0 ? (
              <p className="px-5 py-8 text-[14px] text-stone-500">
                No quotes below monitored floors.
              </p>
            ) : (
              <ul className="divide-y divide-stone-200">
                {underFloor.map((job) => {
                  const trade = CATEGORY_MAP[job.categoryId];
                  const t = job.quote
                    ? computeTotals(job.quote.laborFee, job.quote.materialsCost)
                    : null;
                  return (
                    <li key={job.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
                          {job.title}
                        </p>
                        <Badge tone="muted">{trade?.name}</Badge>
                      </div>
                      <p className="mt-1 text-[12px] text-stone-600 tabular-nums">
                        Labor {formatPeso(t?.laborFee ?? 0)} against a floor of{" "}
                        {formatPeso(trade?.floor ?? 0)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}