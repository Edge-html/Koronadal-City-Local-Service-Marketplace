"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { ActionButton } from "@/components/JobCard";
import {
  Badge,
  Card,
  EmptyState,
  Notice,
} from "@/components/ui";
import { DOC_TYPES, type Job, type Worker } from "@/lib/types";
import type { Category } from "@/lib/constants";
import { addService, checkEmailDiagnostics, decideVerification, getDisabledServiceIds, getServiceCatalog, listAllJobs, listPendingWorkers, migrateLegacyWorkers, retryWorkerRequestEmail, setServiceEnabled } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useActivity } from "@/context/ActivityContext";
import { CountBadge, FlowGuide } from "@/components/FlowGuide";
import { openCredential } from "@/lib/credentials";
import { ProPaymentsAdminPanel } from "@/components/admin/ProPaymentsAdminPanel";

function emailFailureMessage(reason?: string | null) {
  switch (reason) {
    case "not_configured": return "The email relay variables are missing from this deployment. Check Vercel Production settings and redeploy.";
    case "unauthorized": return "Google Apps Script rejected the secret. GOOGLE_APPS_SCRIPT_SECRET in Vercel must exactly match KOROHANAP_EMAIL_SECRET in Apps Script Script Properties.";
    case "quota_reached": return "The Google account reached its Apps Script daily email quota. Try again after the quota resets.";
    case "invalid_message": return "The relay rejected the email message. Check the worker's sign-up email address.";
    case "http_error":
    case "invalid_response": return "The Apps Script URL did not return a valid result. Use the deployed Web app /exec URL with Execute as Me and Anyone access.";
    case "unreachable": return "The server could not reach the Apps Script Web app. Check the URL and the Apps Script deployment.";
    case "no_signup_email": return "This account has no sign-up email saved. Check its Firebase Auth and users profile records.";
    case "relay_error": return "Apps Script could not send the message. Open Apps Script → Executions to inspect the failure.";
    default: return "The email alert was not accepted. Check Vercel function logs and Apps Script → Executions.";
  }
}

export default function AdminPage() {
  const { role, loading: authLoading } = useAuth();
  const { adminRevision, adminError, adminDisputes } = useActivity();
  const [section, setSection] = useState<"workers" | "oversight" | "alerts" | "services" | "pro">("workers");
  const [disabledServices, setDisabledServices] = useState<string[]>([]);
  const [serviceBusy, setServiceBusy] = useState<string | null>(null);
  const [services, setServices] = useState<Category[]>([]);
  const [serviceName, setServiceName] = useState("");
  const [serviceScope, setServiceScope] = useState("");
  const [addingService, setAddingService] = useState(false);

  const [pending, setPending] = useState<Worker[] | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [migrationDone, setMigrationDone] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [missingEmailVariables, setMissingEmailVariables] = useState<string[]>([]);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailResult, setEmailResult] = useState("");

  const load = useCallback(async () => {
    const [workers, allJobs] = await Promise.all([listPendingWorkers(), listAllJobs()]);
    return { workers, allJobs };
  }, []);
  const refresh = async () => {
    const data = await load();
    setPending(data.workers); setJobs(data.allJobs);
  };

  useEffect(() => {
    if (authLoading) return;
    // Gate on role before touching admin data.
    if (role !== "admin") {
      setPending([]);
      return;
    }
    let cancelled = false;
    load().then((data) => {
      if (!cancelled) { setPending(data.workers); setJobs(data.allJobs); }
    }).catch(() => { if (!cancelled) setError("Could not load the review queue. Refresh to retry."); });
    return () => { cancelled = true; };
  }, [authLoading, role, adminRevision, load]);

  useEffect(() => {
    const syncSection = () => {
      const target = window.location.hash.slice(1);
      if (target === "oversight") setSection("oversight");
      if (target === "alerts") setSection("alerts");
      if (target === "services") setSection("services");
      if (target === "pro") setSection("pro");
    };
    syncSection();
    window.addEventListener("hashchange", syncSection);
    return () => window.removeEventListener("hashchange", syncSection);
  }, []);

  useEffect(() => {
    if (role === "admin") Promise.all([getDisabledServiceIds(), getServiceCatalog(true)]).then(([disabled, catalog]) => { setDisabledServices(disabled); setServices(catalog); }).catch(() => undefined);
  }, [role]);

  async function createService(event: React.FormEvent) {
    event.preventDefault();
    setAddingService(true); setError("");
    try {
      await addService({ name: serviceName.trim(), scope: serviceScope.trim() });
      setServiceName(""); setServiceScope("");
      setServices(await getServiceCatalog(true));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add this service."); }
    finally { setAddingService(false); }
  }

  async function toggleService(categoryId: string) {
    const wasDisabled = disabledServices.includes(categoryId);
    setServiceBusy(categoryId);
    setDisabledServices((current) => wasDisabled ? current.filter((id) => id !== categoryId) : [...current, categoryId]);
    try {
      await setServiceEnabled(categoryId, wasDisabled);
    } catch (err) {
      setDisabledServices((current) => wasDisabled ? [...current, categoryId] : current.filter((id) => id !== categoryId));
      setError(err instanceof Error ? err.message : "Could not update this service.");
    } finally {
      setServiceBusy(null);
    }
  }

  useEffect(() => {
    if (section !== "alerts" || role !== "admin") return;
    checkEmailDiagnostics().then((result) => {
      setEmailConfigured(result.configured === true);
      setMissingEmailVariables(result.missingVariables ?? []);
    })
      .catch(() => setEmailResult("Could not check the email relay. Refresh and try again."));
  }, [section, role]);

  async function testEmail() {
    setEmailBusy(true);
    setEmailResult("");
    try {
      const result = await checkEmailDiagnostics(true);
      setEmailConfigured(result.configured === true);
      setMissingEmailVariables(result.missingVariables ?? []);
      setEmailResult(result.emailSent
        ? `Test email accepted for ${result.recipient}. Check its Inbox and Spam folders.`
        : emailFailureMessage(result.reason));
    } catch (err) {
      setEmailResult(err instanceof Error ? err.message : "Could not send the test email.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function retryEmail(job: Job) {
    setBusyId(job.id);
    setEmailResult("");
    try {
      const result = await retryWorkerRequestEmail(job.id);
      setEmailResult(result.emailSent
        ? `Email alert accepted for ${job.workerName} at ${result.recipient ?? "their sign-up email"} about “${job.title}”.`
        : emailFailureMessage(result.reason));
      await refresh();
    } catch (err) {
      setEmailResult(err instanceof Error ? err.message : "Could not retry the email alert.");
    } finally {
      setBusyId(null);
    }
  }

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

  const openDisputes = adminDisputes;
  async function decide(worker: Worker, approve: boolean) {
    setBusyId(worker.id);
    setError("");
    try {
      await decideVerification(
        worker,
        approve,
        notes[worker.id]?.trim() ?? "",
      );
      await refresh();
    } catch {
      setError("Could not record that decision. Please retry.");
    } finally {
      setBusyId(null);
    }
  }

  async function protectLegacyRecords() {
    if (!window.confirm("Move legacy contact and credential fields out of public worker records?")) return;
    setMigrating(true);
    setError("");
    try {
      await migrateLegacyWorkers();
      setMigrationDone(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not migrate legacy records.");
    } finally {
      setMigrating(false);
    }
  }

  return (
    <DashboardShell
      eyebrow="Administration"
      title="Admin workspace"
      subtitle="Review worker applications, manage the service catalog, and handle marketplace reports."
    >
      <div className="flex flex-col gap-4">
        {error || adminError ? <Notice tone="alert">{error || adminError}</Notice> : null}
        {migrationDone ? <Notice>Legacy worker contact and document fields were moved to private records.</Notice> : null}
        <FlowGuide steps={[
          { title: "Choose a queue", detail: "Review worker applications, service options, reports, or email alerts." },
          { title: "Check the details", detail: "Open worker documents or review the job history before making a decision." },
          { title: "Record the decision", detail: "Approve or reject applications and payments, or update the service catalog." },
        ]} />
        <div id="admin-sections" className="flex flex-wrap gap-2 scroll-mt-24" aria-label="Review sections">
          {([
            { id: "workers", label: "Worker applications", count: pending?.length ?? 0 },
            { id: "oversight", label: "Reports", count: openDisputes.length },
            { id: "alerts", label: "Email alerts", count: jobs.filter((job) => job.status === "requested" && !job.workerRequestEmailSentAt).length },
            { id: "services", label: "Home services", count: services.filter((item) => !disabledServices.includes(item.id)).length },
            { id: "pro", label: "Pro payments" },
          ] as const).map((item) => <button type="button" key={item.id} onClick={() => setSection(item.id)} aria-pressed={section === item.id}
            className={`flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm ${section === item.id ? "border-ink-black bg-white font-semibold text-ink-black" : "border-stone-200 text-stone-700"}`}>
            {item.label}{"count" in item ? <CountBadge count={item.count} /> : null}
          </button>)}
        </div>
        <p className="text-xs text-stone-500" role="status">{pending === null ? "Loading review queues…" : "Queue counts update automatically as requests arrive or are reviewed."}</p>

        {section === "alerts" ? <Card className="p-5">
          <h2 className="text-[16px] font-medium">Worker email alerts</h2>
          <p className="mt-1 text-sm text-stone-600">Check the email relay, send a test to your admin sign-up email, then retry requests whose alerts were not sent.</p>
          <p className="mt-3 text-sm" role="status">{emailConfigured === null ? "Checking email settings…" : emailConfigured ? "Email relay variables are present in this deployment." : `Missing in this deployment: ${missingEmailVariables.join(", ") || "email relay variables"}. Add them to Vercel Production, then redeploy.`}</p>
          <div className="mt-3"><ActionButton variant="neutral" busy={emailBusy} onClick={testEmail}>Send test email to me</ActionButton></div>
          {emailResult ? <p className="mt-3 rounded-lg border border-stone-200 p-3 text-sm" role="status">{emailResult}</p> : null}
          <h3 className="mt-6 text-sm font-semibold">Requested jobs without a sent email alert</h3>
          {jobs.filter((job) => job.status === "requested" && !job.workerRequestEmailSentAt).length === 0
            ? <p className="mt-2 text-sm text-stone-500">No unsent alerts for current requests.</p>
            : <ul className="mt-2 divide-y divide-stone-200">{jobs.filter((job) => job.status === "requested" && !job.workerRequestEmailSentAt).slice(0, 10).map((job) => <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm">{job.title} · {job.workerName}</span><ActionButton variant="neutral" busy={busyId === job.id} onClick={() => retryEmail(job)}>Retry email</ActionButton></li>)}</ul>}
        </Card> : null}

        {section === "services" ? <Card className="p-5">
          <h2 className="text-[16px] font-medium">Service catalog</h2>
          <p className="mt-1 text-sm text-stone-600">Add and enable services workers can select on their profiles and households can use to find them.</p>
          <form onSubmit={createService} className="mt-4 grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <div><label className="label" htmlFor="new-service-name">Service name</label><input id="new-service-name" className="field" value={serviceName} onChange={(event) => setServiceName(event.target.value)} maxLength={60} required placeholder="e.g. Manicure and pedicure" /></div>
            <div><label className="label" htmlFor="new-service-scope">Description (optional)</label><input id="new-service-scope" className="field" value={serviceScope} onChange={(event) => setServiceScope(event.target.value)} maxLength={180} placeholder="What this service includes" /></div>
            <button type="submit" disabled={addingService || serviceName.trim().length < 3} className="btn-primary">{addingService ? "Adding…" : "Add service"}</button>
          </form>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {services.map((category) => {
              const enabled = !disabledServices.includes(category.id);
              return <li key={category.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 p-3">
                <div><p className="text-sm font-medium">{category.name}</p><p className="caption">{category.scope}</p></div>
                <button type="button" role="switch" aria-checked={enabled} disabled={serviceBusy === category.id} onClick={() => toggleService(category.id)} className={`min-w-20 rounded-md px-3 py-2 text-xs font-medium ${enabled ? "bg-blue-100 text-blue-900" : "bg-stone-100 text-stone-600"}`}>
                  {serviceBusy === category.id ? "Saving…" : enabled ? "Enabled" : "Disabled"}
                </button>
              </li>;
            })}
          </ul>
        </Card> : null}

        {section === "pro" ? <ProPaymentsAdminPanel /> : null}

        {/* Verification queue */}
        {section === "workers" ? <Card className="overflow-hidden p-0">
          <div className="border-b border-stone-200 px-5 py-4">
            <h2 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
              Credential review
            </h2>
            <p className="caption mt-0.5">
              1. Open each document. 2. Add your review notes. 3. Approve or reject the application. TESDA certification is optional.
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
                const trade = services.find((item) => item.id === worker.categoryId);
                const hasTesda = worker.verificationDocs.some(
                  (d) => d.type === "tesda_certificate",
                );
                const mandatory = (Object.keys(DOC_TYPES) as Array<
                  keyof typeof DOC_TYPES
                >).filter((t) => DOC_TYPES[t].requirement === "mandatory");
                const complete = mandatory.every((t) =>
                  worker.verificationDocs.some((d) => d.type === t && d.fileUrl.startsWith("credentials/")),
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
                      <Badge tone={complete ? "neutral" : "alert"}>
                        {complete
                          ? "All mandatory docs present"
                          : "Missing mandatory docs"}
                      </Badge>
                    </div>

                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {worker.verificationDocs.map((doc, index) => (
                        <li
                          key={`${doc.type}-${index}`}
                          className="flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-bone px-3 py-2"
                        >
                          <span className="truncate text-[12px] text-stone-700">
                            {DOC_TYPES[doc.type].label}
                          </span>
                          {doc.fileUrl.startsWith("credentials/") ? (
                            <button type="button"
                              onClick={() => openCredential(doc.fileUrl).catch((err) =>
                                setError(err instanceof Error ? err.message : "Could not open document.")
                              )}
                              className="caption shrink-0 text-stone-800 underline underline-offset-2"
                            >
                              View
                            </button>
                          ) : (
                            <span className="caption attention">Reupload required</span>
                          )}
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
                          disabled={!complete}
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
        </Card> : null}

        {/* Oversight */}
        {section === "oversight" ? <div className="grid gap-4 lg:grid-cols-2">
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
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div> : null}
        <details className="rounded-xl border border-stone-200 p-4"><summary className="cursor-pointer text-sm text-stone-500">Advanced maintenance</summary><div className="mt-4">
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="text-[15px] font-medium">Protect existing worker records</h2>
            <p className="caption mt-1">Run once after deployment to move older contact and document fields out of the public directory.</p>
          </div>
          <ActionButton variant="neutral" busy={migrating} onClick={protectLegacyRecords}>
            Migrate legacy records
          </ActionButton>
        </Card>

        </div></details>
      </div>
    </DashboardShell>
  );
}
