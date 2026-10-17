"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { ActionButton } from "@/components/JobCard";
import { Badge, Card, Notice, safeAsync } from "@/components/ui";
import { CATEGORY_MAP, SKILLS_BY_CATEGORY } from "@/lib/constants";
import {
  MIN_EXTRACTABLE_CHARS,
  describeConfidence,
  extractPdfText,
  parseResumeText,
  suggestCategory,
  type ParsedResume,
} from "@/lib/resume";
import { clearResume, saveResume, updateWorker } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import type { Resume, Worker } from "@/lib/types";

/**
 * Resume upload and field review.
 *
 * PDFs are read in the browser and the fields below are suggestions the worker
 * corrects before anything is saved. Images have no text layer, so they upload
 * with the fields typed in rather than being silently mis-parsed.
 */
export function ResumeEditor({ worker, onUpdated }: { worker: Worker; onUpdated?: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [skillsBusy, setSkillsBusy] = useState(false);
  const [skillsSaved, setSkillsSaved] = useState(false);
  const [skillsError, setSkillsError] = useState("");

  // Editable confirmations of what the parser suggested.
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [years, setYears] = useState("");
  const [skills, setSkills] = useState<string[]>(() =>
    worker.skills?.length ? worker.skills : worker.resume?.skills ?? [],
  );
  const [category, setCategory] = useState(worker.categoryId);

  async function onPick(next: File) {
    setError("");
    setSaved(false);
    setFile(next);
    setFileUrl(URL.createObjectURL(next));
    setParsed(null);

    const isPdf =
      next.type === "application/pdf" || next.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setFullName("");
      setPhone(worker.phone ?? "");
      setEmail(worker.email ?? "");
      setYears(String(worker.yearsExperience ?? ""));
      setSkills([]);
      return;
    }

    setReading(true);
    try {
      const text = await extractPdfText(next);
      const result = parseResumeText(text);
      setParsed(result);

      setFullName(result.fullName ?? "");
      setPhone(result.phone ?? worker.phone ?? "");
      setEmail(result.email ?? worker.email ?? "");
      setYears(result.yearsExperience ? String(result.yearsExperience) : "");

      const suggested = suggestCategory(result.skills);
      if (suggested) setCategory(suggested);

      // Prefill skills the dictionary found, plus any the worker already had.
      setSkills([...new Set([...(worker.skills ?? []), ...result.skills])]);
    } catch (err) {
      console.error("[resume] could not read PDF:", err);
      setError(
        "Could not read this PDF. It may be a scan rather than a text document. Fill the fields in manually.",
      );
    } finally {
      setReading(false);
    }
  }

  const toggleSkill = (skill: string) =>
    setSkills((prev) =>
      prev.includes(skill)
        ? prev.filter((s) => s !== skill)
        : [...prev, skill],
    );

  const canSave = !!file && fullName.trim().length >= 2;

  const saveSkills = safeAsync(async () => {
    setSkillsBusy(true);
    setSkillsError("");
    setSkillsSaved(false);
    try {
      await updateWorker(worker.id, { skills: skills.slice(0, 20) });
      setSkillsSaved(true);
      await onUpdated?.();
    } catch (err) {
      console.error("[worker-skills] save failed:", err);
      setSkillsError("Could not save your skills. Please try again.");
    } finally {
      setSkillsBusy(false);
    }
  }, "save-worker-skills");

  const save = safeAsync(async () => {
    setBusy(true);
    setError("");
    try {
      const resume: Resume = {
        fileName: file!.name,
        fileUrl,
        rawText: parsed?.rawText ?? "",
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        skills,
        yearsExperience: years ? Number(years) : undefined,
        certifications: parsed?.certifications ?? [],
        confidence: parsed?.confidence ?? "none",
        uploadedAt: new Date().toISOString(),
      };

      await saveResume(worker.id, resume);

      // Keep the listing consistent with what the resume says.
      await updateWorker(worker.id, {
        fullName: resume.fullName,
        phone: resume.phone ?? worker.phone,
        email: resume.email ?? worker.email,
        yearsExperience: resume.yearsExperience ?? worker.yearsExperience,
        categoryId: category,
        skills,
      });

      setSaved(true);
      await onUpdated?.();
    } catch (err) {
      console.error("[resume] save failed:", err);
      setError(
        "Could not save the resume. If the error mentions permissions, the deployed Firestore rules may be out of date.",
      );
    } finally {
      setBusy(false);
    }
  }, "save-resume");

  const remove = safeAsync(async () => {
    setBusy(true);
    try {
      await clearResume(worker.id);
      setFile(null);
      setFileUrl("");
      setParsed(null);
      setSaved(true);
      await onUpdated?.();
    } finally {
      setBusy(false);
    }
  }, "clear-resume");

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
            <FileText size={15} strokeWidth={1.5} />
            Resume
          </h2>
          <p className="caption mt-1">
            Visible on your public profile. Households read it before booking.
          </p>
        </div>
        {worker.resume ? (
          <Badge tone="neutral">
            Uploaded {formatDate(worker.resume.uploadedAt)}
          </Badge>
        ) : null}
      </div>

      {error ? <Notice tone="alert">{error}</Notice> : null}
      {saved && !error ? <Notice>Resume saved to your profile.</Notice> : null}

      {/* Current resume */}
      {worker.resume && !file ? (
        <div className="rounded-md border border-stone-200 bg-bone p-4">
          <p className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
            {worker.resume.fileName}
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {worker.resume.fullName ? (
              <div>
                <dt className="caption">Name</dt>
                <dd className="text-[13px] text-stone-700">
                  {worker.resume.fullName}
                </dd>
              </div>
            ) : null}
            {worker.resume.phone ? (
              <div>
                <dt className="caption">Phone</dt>
                <dd className="text-[13px] text-stone-700">
                  {worker.resume.phone}
                </dd>
              </div>
            ) : null}
            {worker.resume.yearsExperience ? (
              <div>
                <dt className="caption">Experience</dt>
                <dd className="text-[13px] text-stone-700">
                  {worker.resume.yearsExperience} years
                </dd>
              </div>
            ) : null}
          </dl>
          {worker.resume.skills.length ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {worker.resume.skills.map((skill) => (
                <li key={skill}>
                  <Badge tone="muted">{skill}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="btn-ghost btn-sm mt-3"
            onClick={remove}
            disabled={busy}
          >
            <Trash2 size={13} strokeWidth={1.5} />
            Remove resume
          </button>
        </div>
      ) : null}

      {/* Picker */}
      <div className="flex flex-col gap-3">
        <label className="btn-neutral btn-sm w-fit cursor-pointer">
          {reading ? (
            <>
              <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
              Reading
            </>
          ) : (
            <>
              <Upload size={13} strokeWidth={1.5} />
              {file ? "Choose a different file" : "Upload resume"}
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={reading}
            onChange={(e) => {
              const next = e.target.files?.[0];
              if (next) onPick(next);
            }}
          />
        </label>
        <p className="caption">
          PDF or image, up to 10 MB. PDFs are read automatically; images are
          stored but the fields below have to be filled in by hand.
        </p>
      </div>

      <section className="border-t border-stone-200 pt-4" aria-labelledby="worker-skills-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="worker-skills-heading" className="text-[14px] font-medium text-ink-black">
              Skills you offer
            </h3>
            <p className="caption mt-1">
              Select the work you can do. These appear on your public profile; you do not need to type anything.
            </p>
          </div>
          <span className="caption">{skills.length} selected</span>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {(SKILLS_BY_CATEGORY[worker.categoryId] ?? []).map((skill) => {
            const selected = skills.includes(skill);
            return (
              <li key={skill}>
                <label className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[13px] ${selected ? "border-ink-black bg-stone-50 text-ink-black" : "border-stone-200 text-stone-600"}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={skillsBusy || (skills.length >= 20 && !selected)}
                    onChange={() => {
                      setSkillsSaved(false);
                      setSkills((current) => selected
                        ? current.filter((item) => item !== skill)
                        : current.length < 20 ? [...current, skill] : current);
                    }}
                    className="accent-black"
                  />
                  {skill}
                </label>
              </li>
            );
          })}
        </ul>
        <p className="caption mt-2">Choose up to 20 skills. Your main trade is {CATEGORY_MAP[worker.categoryId]?.name ?? "your service category"}.</p>
        {skillsError ? <Notice tone="alert">{skillsError}</Notice> : null}
        {skillsSaved && !skillsError ? <Notice>Your skills are saved to your public profile.</Notice> : null}
        <button type="button" className="btn-primary btn-sm mt-3" onClick={saveSkills} disabled={skillsBusy}>
          {skillsBusy ? "Saving skills…" : "Save skills"}
        </button>
      </section>

      {parsed?.confidence === "none" && file ? (
        <Notice tone="alert">
          <span className="flex items-start gap-2">
            <AlertTriangle size={13} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            <span>
              No readable text in this file, which usually means it is a scan
              rather than a text PDF. Fill the fields in yourself below.
            </span>
          </span>
        </Notice>
      ) : parsed ? (
        <Notice>
          <span className="flex items-start gap-2">
            <Check size={13} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            <span>{describeConfidence(parsed.confidence)}</span>
          </span>
        </Notice>
      ) : null}

      {file ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="res-name">
                Full name
              </label>
              <input
                id="res-name"
                className="field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="res-phone">
                Mobile number
              </label>
              <input
                id="res-phone"
                className="field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="res-email">
                Email address
              </label>
              <input
                id="res-email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="res-years">
                Years of experience
              </label>
              <input
                id="res-years"
                className="field"
                inputMode="numeric"
                value={years}
                onChange={(e) => setYears(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="res-cat">
              Service category
            </label>
            <select
              id="res-cat"
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {Object.values(CATEGORY_MAP).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {parsed && suggestCategory(parsed.skills) === category ? (
              <p className="caption mt-1">
                Suggested from the skills found in your resume.
              </p>
            ) : null}
          </div>

          {parsed?.skills.length ? (
            <div>
              <p className="label">Skills found — remove any that are wrong</p>
              <ul className="flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <li key={skill}>
                    <button
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className="badge badge-verified cursor-pointer"
                    >
                      {skill}
                      <Check size={10} strokeWidth={2.5} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {parsed?.certifications.length ? (
            <div>
              <p className="label">Credentials mentioned</p>
              <ul className="flex flex-wrap gap-1.5">
                {parsed.certifications.map((cert) => (
                  <li key={cert}>
                    <Badge tone="neutral">{cert}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {parsed?.rawText &&
          parsed.rawText.trim().length >= MIN_EXTRACTABLE_CHARS ? (
            <details className="rounded-md border border-stone-200 bg-bone p-3">
              <summary className="cursor-pointer text-[12px] tracking-[-0.02em] text-stone-600">
                What was read from the file
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap font-[family-name:var(--font-system-ui)] text-[11px] leading-[1.45] text-stone-600">
                {parsed.rawText.slice(0, 2000)}
              </pre>
            </details>
          ) : null}

          <div className="flex items-center gap-2 border-t border-stone-200 pt-4">
            <ActionButton onClick={save} busy={busy} disabled={!canSave}>
              Save resume to profile
            </ActionButton>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setFile(null);
                setFileUrl("");
                setParsed(null);
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </>
      ) : null}
    </Card>
  );
}
