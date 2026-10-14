"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { ActionButton } from "@/components/JobCard";
import { Badge, Card, Notice, safeAsync, StarRating, StatCard } from "@/components/ui";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/constants";
import { getWorkerByUid, listReviews, updateWorker } from "@/lib/data";
import { formatPeso } from "@/lib/commission";
import { useAuth } from "@/context/AuthContext";
import type { Review, Worker } from "@/lib/types";

export default function WorkerProfilePage() {
  const { user, loading: authLoading } = useAuth();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [bio, setBio] = useState("");
  const [hourly, setHourly] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    getWorkerByUid(user.uid).then(async (w) => {
      setWorker(w);
      if (w) {
        setBio(w.bio);
        setHourly(String(w.hourlyRate));
        setReviews(await listReviews(w.id));
      }
    });
  }, [authLoading, user]);

  async function save() {
    if (!worker) return;
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      await updateWorker(worker.id, {
        bio: bio.trim(),
        hourlyRate: Number(hourly) || 0,
      });
      setSaved(true);
      setWorker({ ...worker, bio: bio.trim(), hourlyRate: Number(hourly) || 0 });
    } catch {
      setError("Could not save your profile. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!worker) {
    return (
      <DashboardShell
        eyebrow="Worker console"
        title="Profile"
        subtitle="Your public listing and referral code."
      >
        <p className="meta">{error || "Loading your profile"}</p>
      </DashboardShell>
    );
  }

  const trade = CATEGORY_MAP[worker.categoryId];

  return (
    <DashboardShell
      eyebrow="Worker console"
      title="Profile"
      subtitle="Your public listing and referral code."
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Rating" value={worker.rating.toFixed(1)} sublabel={`${worker.reviewCount} reviews`} />
          <StatCard label="Jobs completed" value={worker.jobsCompleted} />
          <StatCard label="Reference rate" value={`${formatPeso(worker.hourlyRate)}/hr`} />
          <StatCard label="Referral credits" value={worker.referralCredits} sublabel="Single tier, job-verified" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
          <Card className="flex flex-col gap-4 p-5">
            <div>
              <h2 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
                Public listing
              </h2>
              <p className="caption mt-0.5">
                Households read this before sending a request
              </p>
            </div>

            {error ? <Notice tone="alert">{error}</Notice> : null}
            {saved ? <Notice>Profile saved.</Notice> : null}

            <div>
              <label className="label" htmlFor="pf-service">
                Primary service
              </label>
              <select id="pf-service" className="field" defaultValue={worker.categoryId} disabled>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="caption mt-1">
                Service changes require admin review. Contact support to switch
                disciplines.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="pf-rate">
                Reference hourly rate (PHP)
              </label>
              <input
                id="pf-rate"
                className="field"
                inputMode="decimal"
                value={hourly}
                onChange={(e) => setHourly(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="pf-bio">
                About your work
              </label>
              <textarea
                id="pf-bio"
                className="field min-h-[120px] resize-y"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <ActionButton onClick={save} busy={busy} disabled={bio.trim().length < 20}>
                Save changes
              </ActionButton>
              <a
                href={`/worker/${worker.id}`}
                className="btn-neutral btn-sm no-underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                View public page
                <ExternalLink size={13} strokeWidth={1.5} />
              </a>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3 p-5">
              <p className="caption">Referral code</p>
              <p className="text-[28px] leading-none font-medium tracking-[0.12em] text-ink-black tabular-nums">
                {worker.referralCode || "—"}
              </p>
              <p className="text-[13px] leading-[1.45] text-stone-600">
                Credits post automatically when your invitee completes their
                first job.
              </p>
              <button
                type="button"
                className="btn-neutral btn-sm self-start"
                onClick={safeAsync(async () => {
                  await navigator.clipboard.writeText(worker.referralCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                })}
              >
                <Copy size={13} strokeWidth={1.5} />
                {copied ? "Copied" : "Copy code"}
              </button>
            </Card>

            <Card className="flex flex-col gap-3 p-5">
              <div>
                <p className="caption">Verification status</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {worker.verified ? (
                    <Badge tone="verified">Verified</Badge>
                  ) : (
                    <Badge tone="muted">Pending review</Badge>
                  )}
                  {worker.tesdaCertified ? <Badge tone="neutral">TESDA</Badge> : null}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 border-t border-stone-200 pt-3">
                <div>
                  <dt className="caption">Service</dt>
                  <dd className="mt-0.5 text-[13px] text-stone-700">
                    {trade?.name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="caption">Barangay</dt>
                  <dd className="mt-0.5 text-[13px] text-stone-700">
                    {worker.barangay}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-stone-200 px-5 py-4">
            <h2 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
              Reviews received
            </h2>
          </div>
          {reviews.length === 0 ? (
            <p className="px-5 py-8 text-[14px] text-stone-500">No reviews yet.</p>
          ) : (
            <ul className="divide-y divide-stone-200">
              {reviews.map((review) => (
                <li key={review.id} className="flex flex-col gap-2 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
                      {review.consumerName}
                    </span>
                    <StarRating value={review.rating} showValue={false} />
                  </div>
                  <p className="text-[13px] leading-[1.5] text-stone-600">{review.text}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}
