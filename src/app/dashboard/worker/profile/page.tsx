"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { ActionButton } from "@/components/JobCard";
import { Badge, Card, Notice, safeAsync, StarRating, StatCard } from "@/components/ui";
import { BARANGAYS, CATEGORY_MAP } from "@/lib/constants";
import { PortfolioForm } from "@/components/PortfolioForm";
import { ResumeEditor } from "@/components/ResumeEditor";
import { getWorkerByUid, listReviews, setWorkerPro, setWorkerServices, updateWorker } from "@/lib/data";
import { formatPeso } from "@/lib/commission";
import { useAuth } from "@/context/AuthContext";
import type { Review, Worker } from "@/lib/types";
import { ProfilePhotoEditor } from "@/components/ProfilePhotoEditor";
import { ProfileStrength } from "@/components/ProfileStrength";
import { useServiceCategories } from "@/hooks/useServiceCategories";

export default function WorkerProfilePage() {
  const { user, loading: authLoading } = useAuth();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [bio, setBio] = useState("");
  const [serviceRate, setServiceRate] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [specialty, setSpecialty] = useState("");
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const categories = useServiceCategories(true);

  useEffect(() => {
    if (authLoading || !user) return;
    getWorkerByUid(user.uid).then(async (w) => {
      setWorker(w);
      if (w) {
        setBio(w.bio);
        setServiceRate(String(w.serviceRate));
        setServiceIds(w.serviceIds ?? [w.categoryId]);
        setSpecialty(w.specialtyDescription ?? "");
        setServiceAreas(w.serviceAreas ?? []);
        setReviews(await listReviews(w.id));
      }
    });
  }, [authLoading, user]);

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!worker || !["resume-skills", "portfolio"].includes(id)) return;
    const target = document.getElementById(id);
    if (target instanceof HTMLDetailsElement) {
      target.open = true;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [worker]);

  async function refreshWorker() {
    if (!user) return;
    const updated = await getWorkerByUid(user.uid);
    if (updated) setWorker(updated);
  }

  async function save() {
    if (!worker) return;
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      await updateWorker(worker.id, {
        bio: bio.trim(),
        serviceRate: Number(serviceRate) || 0,
        specialtyDescription: specialty.trim(),
        serviceAreas,
      });
      await setWorkerServices(worker.id, serviceIds);
      setSaved(true);
      setWorker({ ...worker, bio: bio.trim(), serviceRate: Number(serviceRate) || 0, serviceIds, categoryId: serviceIds[0] ?? worker.categoryId, specialtyDescription: specialty.trim(), serviceAreas });
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
  const visibilityFields: Array<[keyof NonNullable<Worker["profileVisibility"]>, string]> = [
    ["bio", "About your work"], ["specialty", "Specific expertise"], ["rate", "Service rate"], ["serviceAreas", "Barangays you serve"],
    ["experience", "Experience and completed-job count"], ["skills", "Skills"], ["resume", "Resume"], ["portfolio", "Portfolio"], ["offers", "Services on offer"],
  ];

  async function setVisibility(key: keyof NonNullable<Worker["profileVisibility"]>, visible: boolean) {
    const currentWorker = worker;
    if (!currentWorker) return;
    const next = { ...(currentWorker.profileVisibility ?? {}), [key]: visible };
    await updateWorker(currentWorker.id, { profileVisibility: next });
    setWorker({ ...currentWorker, profileVisibility: next });
  }

  return (
    <DashboardShell
      eyebrow="Worker console"
      title="Profile"
      subtitle="Your public listing and referral code."
    >
      <div className="flex flex-col gap-4">
        <ProfileStrength worker={worker} />
        <ProfilePhotoEditor name={worker.fullName} photoUrl={worker.photoUrl} onSaved={(photoUrl) => setWorker({ ...worker, photoUrl })} />
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Rating" value={worker.rating.toFixed(1)} sublabel={`${worker.reviewCount} reviews`} />
          <StatCard label="Jobs completed" value={worker.jobsCompleted} />
          <StatCard label="Service rate" value={formatPeso(worker.serviceRate)} sublabel="Starting rate; agree final scope in chat" />
          <StatCard label="Account" value={worker.isPro ? "Pro" : "Standard"} sublabel={worker.isPro ? "Featured listing" : "Free account"} />
        </div>

        <details id="resume-skills" className="rounded-xl border border-stone-200 bg-white p-4"><summary className="cursor-pointer text-sm font-medium">Resume and skills</summary><div className="mt-4"><ResumeEditor worker={worker} onUpdated={refreshWorker} /></div></details>
        <details id="portfolio" className="rounded-xl border border-stone-200 bg-white p-4"><summary className="cursor-pointer text-sm font-medium">Add work to your portfolio</summary><div className="mt-4"><PortfolioForm workerId={worker.id} onDone={async () => { setSaved(true); await refreshWorker(); }} /></div></details>

        <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
          <Card className="flex flex-col gap-4 p-5">
            <div>
              <h2 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
                Public listing
              </h2>
              <p className="caption mt-0.5">
                Households read this before sending a request
              </p>
              <Notice>Public profile notice: your name, photo, service, service rate, work areas, experience, skills, and any enabled profile details can be seen by households. Your signup email, phone number, and verification documents remain private.</Notice>
            </div>

            {error ? <Notice tone="alert">{error}</Notice> : null}
            {saved ? <Notice>Profile saved.</Notice> : null}

            <div>
              <fieldset>
                <legend className="label">Services you offer <span className="text-rose-700">*</span></legend>
                <p className="caption mb-2">Select every profession you can take jobs for. The first selected service is your primary listing.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {categories.map((category) => <label key={category.id} className={`flex items-start gap-2 rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-700 ${category.enabled === false && !serviceIds.includes(category.id) ? "opacity-50" : ""}`}>
                    <input type="checkbox" checked={serviceIds.includes(category.id)} disabled={category.enabled === false && !serviceIds.includes(category.id)} onChange={() => setServiceIds((current) => current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id])} className="mt-0.5 accent-blue-700" />
                    <span>{category.name}{category.enabled === false ? <span className="ml-1 text-xs text-stone-500">(disabled · remove from profile)</span> : null}</span>
                  </label>)}
                </div>
              </fieldset>
            </div>

            <div>
              <label className="label" htmlFor="pf-rate">
                Starting service rate (PHP) <span className="text-rose-700">*</span>
              </label>
              <input
                id="pf-rate"
                type="number"
                min={1}
                required
                className="field"
                inputMode="decimal"
                value={serviceRate}
                onChange={(e) => setServiceRate(e.target.value)}
              />
              <p className="caption mt-1">This is a starting service rate, not an hourly wage. Agree the final price and materials directly in your job chat.</p>
            </div>

            <div>
              <label className="label" htmlFor="pf-specialty">Specific expertise <span className="text-rose-700">*</span></label>
              <input id="pf-specialty" className="field" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Tile installer, cabinet maker" maxLength={100} minLength={2} required />
            </div>

            <fieldset>
              <legend className="label">Barangays you serve</legend>
              <div className="grid max-h-48 gap-2 overflow-auto rounded-md border border-stone-200 p-3 sm:grid-cols-2">
                {BARANGAYS.filter((area) => area !== worker.barangay).map((area) => (
                  <label key={area} className="flex items-center gap-2 text-sm text-stone-700">
                    <input type="checkbox" checked={serviceAreas.includes(area)} onChange={() => setServiceAreas((current) => current.includes(area) ? current.filter((value) => value !== area) : [...current, area])} className="accent-blue-700" />
                    {area}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="label" htmlFor="pf-bio">
                About your work <span className="text-rose-700">*</span>
              </label>
              <textarea
                id="pf-bio"
                required
                minLength={20}
                className="field min-h-[120px] resize-y"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <ActionButton onClick={save} busy={busy} disabled={!serviceIds.length || bio.trim().length < 20 || specialty.trim().length < 2 || Number(serviceRate) <= 0}>
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
              <div><h2 className="text-sm font-medium">What households can see</h2><p className="caption mt-1">Your name, photo, primary service and rating always appear. Choose whether to show these extra details.</p></div>
              {visibilityFields.map(([key, label]) => {
                const checked = worker.profileVisibility?.[key] !== false;
                return <label key={key} className="flex items-center justify-between gap-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700">
                  {label}<input type="checkbox" checked={checked} onChange={(event) => setVisibility(key, event.target.checked).catch(() => setError("Could not update your public profile settings."))} className="accent-blue-700" />
                </label>;
              })}
            </Card>
            <ProAccountCard worker={worker} onUpdated={(isPro) => setWorker({ ...worker, isPro })} />
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

function ProAccountCard({ worker, onUpdated }: { worker: Worker; onUpdated: (enabled: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    setBusy(true); setError("");
    try {
      await setWorkerPro(worker.id, !worker.isPro);
      onUpdated(!worker.isPro);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update your account plan."); }
    finally { setBusy(false); }
  }
  return <Card className="flex flex-col gap-3 p-5">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium">KoroHanap Pro</h2>{worker.isPro ? <Badge tone="verified">PRO</Badge> : <Badge tone="muted">Standard</Badge>}</div>
    <p className="text-sm leading-relaxed text-stone-600">Pro profiles get a highlighted card, a Pro badge, and priority placement in the worker directory. Pro is free during the pilot; no payment details are collected.</p>
    {error ? <Notice tone="alert">{error}</Notice> : null}
    <ActionButton variant={worker.isPro ? "neutral" : "primary"} busy={busy} onClick={toggle}>{worker.isPro ? "Switch to Standard" : "Activate Pro"}</ActionButton>
  </Card>;
}
