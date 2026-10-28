"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronRight, FileUp, Loader2, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import {
  Badge,
  Card,
  Notice,
} from "@/components/ui";
import { BARANGAYS, SERVICE_POINTS } from "@/lib/constants";
import { DOC_TYPES, type DocType } from "@/lib/types";
import { createWorkerProfile, getWorkerByUid } from "@/lib/data";
import { uploadCredential } from "@/lib/credentials";
import { formatPeso } from "@/lib/commission";
import { useAuth } from "@/context/AuthContext";
import { cx } from "@/lib/utils";
import { useServiceCategories } from "@/hooks/useServiceCategories";

const STEPS = [
  { n: 1, name: "Identity & contact" },
  { n: 2, name: "Document upload" },
  { n: 3, name: "Review & submit" },
];

export default function WorkerOnboardingPage() {
  const { user, profile, role, becomeWorker, loading: authLoading } =
    useAuth();
  const router = useRouter();
  const categories = useServiceCategories();

  const [step, setStep] = useState(1);
  const [existing, setExisting] = useState<boolean | null>(null);

  // [step 1]
  const [categoryId, setCategoryId] = useState("");
  const [barangay, setBarangay] = useState("");
  const [years, setYears] = useState("");
  const [serviceRate, setServiceRate] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [publicInfoAcknowledged, setPublicInfoAcknowledged] = useState(false);

  // [step 2]
  const [docs, setDocs] = useState<Record<string, { fileName: string; file: File }[]>>({});
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [specialtyDescription, setSpecialtyDescription] = useState("");

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
    categoryId !== "" && barangay !== "" && years !== "" && Number(years) >= 0 && Number(serviceRate) > 0 && /^(09\d{9}|\+639\d{9})$/.test(phone.trim().replace(/[\s-]/g, "")) && bio.trim().length >= 20 && specialtyDescription.trim().length >= 2 && publicInfoAcknowledged;

  const mandatoryDocs: DocType[] = [
    "government_id",
    "barangay_clearance",
  ];
  const step2Valid = mandatoryDocs.every((type) => docs[type]?.length);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      // The role must be worker before the profile write: the Firestore rules
      // gate worker creation on isWorkerRole(). Flipping it afterwards meant
      // every submission was denied.
      //
      // This is still gated on the requirements. Reaching submit means the
      // three mandatory documents are attached to the write below, and the
      // profile lands as pending_verification - out of the directory and
      // unable to receive jobs until an administrator approves it. Neither
      // step on its own grants anything.
      if (role === "customer") {
        await becomeWorker();
      }

      const uploadedDocs = await Promise.all(Object.entries(docs).flatMap(([type, files]) =>
        files.map(async (value) => ({
          type: type as DocType,
          fileName: value.fileName,
          fileUrl: await uploadCredential(value.file),
          uploadedAt: new Date().toISOString(),
          reviewState: "pending" as const,
        })),
      ));
      await createWorkerProfile({
        uid: user!.uid,
        fullName: user!.displayName || "",
        phone: phone.trim().replace(/[\s-]/g, ""),
        email: user!.email || "",
        categoryId,
        serviceIds: [categoryId],
        barangay,
        serviceAreas: [...new Set([barangay, ...serviceAreas])],
        bio: bio.trim(),
        specialtyDescription: specialtyDescription.trim(),
        yearsExperience: Number(years) || 0,
        serviceRate: Number(serviceRate) || 0,
        tesdaCertified: Boolean(docs.tesda_certificate?.length),
        verificationDocs: uploadedDocs,
      });

      router.replace("/dashboard/worker");
    } catch (err) {
      // The previous message blamed the network for what was usually a rules
      // rejection, which sent people offline debugging instead of reading the
      // console. Report the actual cause.
      console.error("[onboarding] submit failed:", err);
      const code = (err as { code?: string })?.code ?? "";
      setError(
        code === "permission-denied"
          ? "The server rejected this application. The Firestore rules for this project may not be the deployed version - check the browser console for the full error."
          : code === "unavailable"
            ? "Could not reach the database. Check your connection and try again."
            : "Could not submit your application. Please try again, and check the browser console for details.",
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
                    Primary service <span className="text-rose-700">*</span>
                  </label>
                  <select
                    id="ob-cat"
                    required
                    className="field"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Select a service</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="ob-brgy">
                    Home barangay <span className="text-rose-700">*</span>
                  </label>
                  <select
                    id="ob-brgy"
                    required
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
                    Years of experience <span className="text-rose-700">*</span>
                  </label>
                  <input
                    id="ob-years"
                    type="number"
                    min={0}
                    required
                    className="field"
                    inputMode="numeric"
                    value={years}
                    onChange={(e) => setYears(e.target.value)}
                    placeholder="8"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="ob-rate">
                    Starting service rate (PHP) <span className="text-rose-700">*</span>
                  </label>
                  <input
                    id="ob-rate"
                    type="number"
                    min={1}
                    required
                    className="field"
                    inputMode="decimal"
                    value={serviceRate}
                    onChange={(e) => setServiceRate(e.target.value)}
                    placeholder="450"
                  />
                  <p className="caption mt-1">This is a starting service rate, not an hourly wage. Agree final pricing in chat.</p>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="ob-phone">
                  Mobile number for accepted-job contact <span className="text-rose-700">*</span>
                </label>
                <input
                  id="ob-phone"
                  type="tel"
                  className="field"
                  required
                  pattern="(09[0-9]{9}|[+]639[0-9]{9})"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0917 000 0000"
                />
              </div>

              <div>
                <label className="label" htmlFor="ob-bio">
                  About your work <span className="text-rose-700">*</span>
                </label>
                <textarea
                  id="ob-bio"
                  required
                  minLength={20}
                  className="field min-h-[100px] resize-y"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="What you specialise in, the kinds of jobs you take, and anything a household should know."
                />
                <p className="caption mt-1">
                  At least 20 characters. This appears on your public profile if you choose to display it.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="ob-specialty">
                  Your specific expertise <span className="text-rose-700">*</span>
                </label>
                <input
                  id="ob-specialty"
                  className="field"
                  value={specialtyDescription}
                  onChange={(e) => setSpecialtyDescription(e.target.value)}
                  placeholder="e.g. Tile installer, cabinet maker, leak repair"
                  maxLength={100}
                  required
                />
                <p className="caption mt-1">Type the specific work you do within your main service.</p>
              </div>

              <fieldset>
                <legend className="label">Barangays you can travel to</legend>
                <p className="caption mb-2">Select every area you serve. Your home barangay is included automatically.</p>
                <div className="grid max-h-48 gap-2 overflow-auto rounded-md border border-stone-200 p-3 sm:grid-cols-2">
                  {BARANGAYS.filter((item) => item !== barangay).map((item) => (
                    <label key={item} className="flex items-center gap-2 text-sm text-stone-700">
                      <input type="checkbox" checked={serviceAreas.includes(item)} onChange={() => setServiceAreas((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])} className="accent-blue-700" />
                      {item}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-[13px] leading-relaxed text-blue-950">
                <input type="checkbox" checked={publicInfoAcknowledged} onChange={(event) => setPublicInfoAcknowledged(event.target.checked)} className="mt-1 accent-blue-700" />
                <span><strong>Public profile notice:</strong> I understand that my name, photo, services, service rate, service areas, and profile details I choose to show will be visible to people browsing KoroHanap. My signup email, phone number, and verification documents remain private.</span>
              </label>

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
                  A government ID and barangay or police clearance are
                  required. A recommendation letter is optional. You may add
                  more than one TESDA certificate.
                </p>
              </div>

              <ul className="flex flex-col gap-3">
                {(Object.keys(DOC_TYPES) as DocType[]).map((type) => {
                  const meta = DOC_TYPES[type];
                  const uploaded = docs[type] ?? [];
                  const multiple = type === "tesda_certificate";
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
                        {uploaded.map((item, index) => (
                          <p key={`${item.fileName}-${index}`} className="mt-1.5 flex items-center gap-2 truncate text-[12px] text-ink-black">
                            <span className="truncate">{item.fileName}</span>
                            <button type="button" className="btn-ghost px-1" aria-label={`Remove ${item.fileName}`} onClick={() => setDocs((prev) => ({ ...prev, [type]: (prev[type] ?? []).filter((_, i) => i !== index) }))}><Trash2 size={12} /></button>
                          </p>
                        ))}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <label className="btn-neutral btn-sm cursor-pointer">
                          <FileUp size={13} strokeWidth={1.5} />
                          {multiple ? "Add certificate" : uploaded.length ? "Replace" : "Upload"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setDocs((prev) => ({
                                ...prev,
                                [type]: multiple
                                  ? [...(prev[type] ?? []), { fileName: file.name, file }].slice(0, 8)
                                  : [{ fileName: file.name, file }],
                              }));
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="caption">
                Required fields are marked with *. Your name, photo, service,
                rate, work area and any details you choose to show will appear
                on your public worker profile. Documents are only for review.
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
                  ["Service", categories.find((c) => c.id === categoryId)?.name ?? "—"],
                  ["Barangay", barangay],
                  ["Experience", `${years || 0} years`],
                  ["Starting service rate", `${formatPeso(Number(serviceRate) || 0)}`],
                  ["Mobile", phone || "—"],
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
                  {docs.tesda_certificate?.length ? (
                    <li className="flex items-center gap-2 text-[13px]">
                      <Check size={12} strokeWidth={2} className="text-ink-black" />
                      {docs.tesda_certificate.length} {DOC_TYPES.tesda_certificate.label}{docs.tesda_certificate.length > 1 ? "s" : ""}
                    </li>
                  ) : null}
                  {docs.recommendation_letter?.length ? <li className="flex items-center gap-2 text-[13px]"><Check size={12} strokeWidth={2} className="text-ink-black" />Optional recommendation letter</li> : null}
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
                "Job requests arrive by email and in-app",
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
              Visit a walk-in service point and staff can help scan documents
              and set up your worker profile.
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

        </div>
      </div>
    </DashboardShell>
  );
}
