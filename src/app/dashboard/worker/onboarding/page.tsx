"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronRight, FileUp, Loader2, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import {
  Badge,
  Card,
  Notice,
  StatCard,
} from "@/components/ui";
import { BARANGAYS, CATEGORIES, SERVICE_POINTS } from "@/lib/constants";
import { DOC_TYPES, type DocType } from "@/lib/types";
import { createWorkerProfile, getWorkerByUid } from "@/lib/data";
import { formatPeso } from "@/lib/commission";
import { useAuth } from "@/context/AuthContext";
import { cx } from "@/lib/utils";

const STEPS = [
  { n: 1, name: "Identity & contact" },
  { n: 2, name: "Document upload" },
  { n: 3, name: "Review & submit" },
];

export default function WorkerOnboardingPage() {
  const { user, profile, role, becomeWorker, loading: authLoading } =
    useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [existing, setExisting] = useState<boolean | null>(null);

  // [step 1]
  const [categoryId, setCategoryId] = useState("");
  const [barangay, setBarangay] = useState("");
  const [years, setYears] = useState("");
  const [hourly, setHourly] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [referral, setReferral] = useState("");

  // [step 2]
  const [docs, setDocs] = useState<Record<string, { fileName: string; fileUrl: string }>>({});

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    getWorkerByUid(user.uid).then((w) => {
      if (w) {
        setExisting(true);
        router.replace("/dashboard/worker");
      }
    });
  }, [authLoading, user, router]);

  // The mobile number is captured at signup and stored on the user document,
  // not on the Firebase auth record.
  useEffect(() => {
    const stored = profile?.phone;
    if (typeof stored === "string" && stored) setPhone(stored);
  }, [profile]);

  const step1Valid =
    categoryId !== "" && barangay !== "" && years !== "" && hourly !== "" && bio.trim().length >= 20;

  const mandatoryDocs: DocType[] = [
    "government_id",
    "barangay_clearance",
    "recommendation_letter",
  ];
  const step2Valid = mandatoryDocs.every((type) => docs[type]?.fileUrl);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await createWorkerProfile({
        uid: user!.uid,
        fullName: user!.displayName || "",
        phone: phone.trim(),
        email: user!.email || "",
        categoryId,
        barangay,
        bio: bio.trim(),
        yearsExperience: Number(years) || 0,
        hourlyRate: Number(hourly) || 0,
        tesdaCertified: Boolean(docs.tesda_certificate),
        referredBy: referral.trim().toUpperCase() || undefined,
        verificationDocs: Object.entries(docs).map(([type, value]) => ({
          type: type as DocType,
          fileName: value.fileName,
          fileUrl: value.fileUrl,
          uploadedAt: new Date().toISOString(),
          reviewState: "pending" as const,
        })),
      });

      // The role flips only now, once identity and the three mandatory
      // documents have actually been submitted. Switching it on the "become a
      // provider" click let an account claim to be a worker with nothing on
      // file. The profile is still pending_verification and stays out of the
      // directory until an administrator approves it.
      if (role === "customer") {
        await becomeWorker();
      }

      router.replace("/dashboard/worker");
    } catch {
      setError(
        "Could not submit your application. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (existing) return null;

  return (
    <DashboardShell
      eyebrow="Digital self-registration"
      title="Worker onboarding"
      subtitle="Three steps, then a background check. Verification clears within 24 to 48 hours."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="flex flex-col gap-4">
          {/* Stepper strip */}
          <ol className="flex flex-wrap items-center gap-2" aria-label="Registration steps">
            {STEPS.map((item, i) => (
              <li key={item.n} className="flex items-center gap-2">
                <span
                  className={cx(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-[14px] tracking-[-0.02em]",
                    step === item.n
                      ? "border border-stone-200 bg-white text-ink-black shadow-[0_2px_3px_rgba(0,0,0,0.08)]"
                      : step > item.n
                        ? "text-stone-700"
                        : "text-stone-500",
                  )}
                >
                  <span
                    className={cx(
                      "flex h-4 w-4 items-center justify-center rounded-full text-[9px]",
                      step === item.n
                        ? "bg-ink-black text-newsprint"
                        : step > item.n
                          ? "bg-stone-200 text-stone-700"
                          : "border border-stone-200 text-stone-500",
                    )}
                  >
                    {step > item.n ? <Check size={9} strokeWidth={2.5} /> : item.n}
                  </span>
                  {item.name}
                </span>
                {i < STEPS.length - 1 ? (
                  <ChevronRight size={13} strokeWidth={1.5} className="text-stone-200" />
                ) : null}
              </li>
            ))}
          </ol>

          {error ? <Notice tone="alert">{error}</Notice> : null}

          {/* Step 1 */}
          {step === 1 ? (
            <Card className="flex flex-col gap-4 p-6">
              <h2 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
                Identity &amp; contact creation
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="ob-cat">
                    Primary service
                  </label>
                  <select
                    id="ob-cat"
                    className="field"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Select a service</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="ob-brgy">
                    Barangay
                  </label>
                  <select
                    id="ob-brgy"
                    className="field"
                    value={barangay}
                    onChange={(e) => setBarangay(e.target.value)}
                  >
                    <option value="">Select a barangay</option>
                    {BARANGAYS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="ob-years">
                    Years of experience
                  </label>
                  <input
                    id="ob-years"
                    className="field"
                    inputMode="numeric"
                    value={years}
                    onChange={(e) => setYears(e.target.value)}
                    placeholder="8"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="ob-rate">
                    Reference hourly rate (PHP)
                  </label>
                  <input
                    id="ob-rate"
                    className="field"
                    inputMode="decimal"
                    value={hourly}
                    onChange={(e) => setHourly(e.target.value)}
                    placeholder="450"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="ob-phone">
                  Mobile number for SMS alerts
                </label>
                <input
                  id="ob-phone"
                  type="tel"
                  className="field"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0917 000 0000"
                />
              </div>

              <div>
                <label className="label" htmlFor="ob-bio">
                  About your work
                </label>
                <textarea
                  id="ob-bio"
                  className="field min-h-[100px] resize-y"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="What you specialise in, the kinds of jobs you take, and anything a household should know."
                />
                <p className="caption mt-1">
                  At least 20 characters. This is the first thing a household
                  reads on your profile.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="ob-ref">
                  Referral code (optional)
                </label>
                <input
                  id="ob-ref"
                  className="field uppercase"
                  value={referral}
                  onChange={(e) => setReferral(e.target.value)}
                  placeholder="K7M2QP"
                  maxLength={6}
                />
                <p className="caption mt-1">
                  Credits post only after your first job is completed and settled.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!step1Valid}
                  onClick={() => setStep(2)}
                >
                  Continue to documents
                  <ChevronRight size={14} strokeWidth={1.5} />
                </button>
              </div>
            </Card>
          ) : null}

          {/* Step 2 */}
          {step === 2 ? (
            <Card className="flex flex-col gap-4 p-6">
              <div>
                <h2 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
                  Document upload
                </h2>
                <p className="mt-1.5 text-[13px] leading-[1.45] text-stone-600">
                  Clear camera captures or PDF uploads. Three documents are
                  mandatory; TESDA certification is optional but earns an
                  official badge.
                </p>
              </div>

              <ul className="flex flex-col gap-3">
                {(Object.keys(DOC_TYPES) as DocType[]).map((type) => {
                  const meta = DOC_TYPES[type];
                  const uploaded = docs[type];
                  return (
                    <li
                      key={type}
                      className="flex flex-col gap-2 rounded-md border border-stone-200 bg-bone p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
                            {meta.label}
                          </p>
                          <Badge tone={meta.requirement === "mandatory" ? "neutral" : "muted"}>
                            {meta.requirement === "mandatory" ? "Mandatory" : "Optional"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[12px] leading-[1.45] text-stone-600">
                          {meta.purpose}
                        </p>
                        {uploaded ? (
                          <p className="mt-1.5 truncate text-[12px] text-ink-black">
                            {uploaded.fileName}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <label className="btn-neutral btn-sm cursor-pointer">
                          <FileUp size={13} strokeWidth={1.5} />
                          {uploaded ? "Replace" : "Upload"}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const fileUrl = URL.createObjectURL(file);
                              setDocs((prev) => ({
                                ...prev,
                                [type]: { fileName: file.name, fileUrl },
                              }));
                            }}
                          />
                        </label>
                        {uploaded ? (
                          <button
                            type="button"
                            className="btn-ghost px-2"
                            aria-label={`Remove ${meta.label}`}
                            onClick={() =>
                              setDocs((prev) => {
                                const next = { ...prev };
                                delete next[type];
                                return next;
                              })
                            }
                          >
                            <Trash2 size={13} strokeWidth={1.5} />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="caption">
                Files are stored against your profile and reviewed by platform
                administrators under the Data Privacy Act of 2012.
              </p>

              <div className="flex justify-between">
                <button type="button" className="btn-neutral" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!step2Valid}
                  onClick={() => setStep(3)}
                >
                  Review application
                  <ChevronRight size={14} strokeWidth={1.5} />
                </button>
              </div>
            </Card>
          ) : null}

          {/* Step 3 */}
          {step === 3 ? (
            <Card className="flex flex-col gap-4 p-6">
              <div>
                <h2 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
                  Review &amp; submit
                </h2>
                <p className="mt-1.5 text-[13px] leading-[1.45] text-stone-600">
                  Check everything below, then submit for background review.
                </p>
              </div>

              <dl className="grid gap-4 border-y border-stone-200 py-5 sm:grid-cols-3">
                {[
                  ["Service", CATEGORIES.find((c) => c.id === categoryId)?.name ?? "—"],
                  ["Barangay", barangay],
                  ["Experience", `${years || 0} years`],
                  ["Reference rate", `${formatPeso(Number(hourly) || 0)}/hr`],
                  ["Mobile", phone || "—"],
                  [
                    "Service floor",
                    formatPeso(
                      CATEGORIES.find((c) => c.id === categoryId)?.floor ?? 0,
                    ),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="caption">{label}</dt>
                    <dd className="mt-1 text-[14px] tracking-[-0.02em] text-ink-black">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div>
                <p className="label">Submitted credentials</p>
                <ul className="flex flex-col gap-1.5">
                  {mandatoryDocs.map((type) => (
                    <li key={type} className="flex items-center gap-2 text-[13px]">
                      <Check size={12} strokeWidth={2} className="text-ink-black" />
                      {DOC_TYPES[type].label}
                    </li>
                  ))}
                  {docs.tesda_certificate ? (
                    <li className="flex items-center gap-2 text-[13px]">
                      <Check size={12} strokeWidth={2} className="text-ink-black" />
                      {DOC_TYPES.tesda_certificate.label}
                    </li>
                  ) : null}
                </ul>
              </div>

              <Notice>
                After submission, an administrator completes the background check
                within 24 to 48 hours. Your profile appears in the directory and
                you begin receiving job requests once approved.
              </Notice>

              <div className="flex justify-between">
                <button type="button" className="btn-neutral" onClick={() => setStep(2)}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={submit}
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                      Submitting
                    </>
                  ) : (
                    "Submit for verification"
                  )}
                </button>
              </div>
            </Card>
          ) : null}
        </div>

        {/* Side rail */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-20">
          <Card className="flex flex-col gap-3 p-5">
            <p className="caption">What happens next</p>
            <ol className="flex flex-col gap-2.5">
              {[
                "Admin reviews your three mandatory documents",
                "Background check completes within 24 to 48 hours",
                "Profile goes live in the public directory",
                "Job requests arrive by SMS and in-app",
              ].map((text, i) => (
                <li key={text} className="flex gap-2 text-[13px] leading-[1.45] text-stone-700">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-bone text-[9px] tabular-nums text-stone-600">
                    {i + 1}
                  </span>
                  {text}
                </li>
              ))}
            </ol>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <p className="caption">Prefer in-person registration?</p>
            <p className="text-[13px] leading-[1.45] text-stone-600">
              Visit a walk-in service point and staff will scan documents, create
              your profile, and configure your wallet.
            </p>
            <ul className="flex flex-col gap-2 border-t border-stone-200 pt-3">
              {SERVICE_POINTS.map((point) => (
                <li key={point} className="flex gap-2 text-[12px] leading-[1.45] text-stone-700">
                  <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-stone-400" />
                  {point}
                </li>
              ))}
            </ul>
          </Card>

          <StatCard
            label="Platform commission"
            value="10%"
            sublabel="Labor fee only, materials exempt"
          />
        </div>
      </div>
    </DashboardShell>
  );
}