"use client";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Card, Notice } from "@/components/ui";
import { ActionButton } from "@/components/JobCard";
import { addPortfolioEntry } from "@/lib/data";
import { CATEGORIES } from "@/lib/constants";
import { uploadPortfolioImages } from "@/lib/portfolio-files";

export function PortfolioForm({
  workerId,
  onDone,
}: {
  workerId: string;
  onDone: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("carpentry");
  const [note, setNote] = useState("");
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const beforeInput = useRef<HTMLInputElement>(null);
  const afterInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [posted, setPosted] = useState(false);

  async function run() {
    if (title.trim().length < 3) return;
    setBusy(true);
    setError("");
    setPosted(false);
    try {
      const id = `pf_${crypto.randomUUID()}`;
      const photos = beforePhoto || afterPhoto
        ? await uploadPortfolioImages(workerId, id, beforePhoto, afterPhoto)
        : {};
      await addPortfolioEntry(workerId, {
        id,
        jobTitle: title.trim(),
        categoryId,
        note: note.trim(),
        ...photos,
        ...(photos.beforePath ? { beforeUrl: `/api/portfolio-files?workerId=${encodeURIComponent(workerId)}&entryId=${encodeURIComponent(id)}&side=before` } : {}),
        ...(photos.afterPath ? { afterUrl: `/api/portfolio-files?workerId=${encodeURIComponent(workerId)}&entryId=${encodeURIComponent(id)}&side=after` } : {}),
        createdAt: new Date().toISOString(),
      });
      setTitle("");
      setCategoryId("carpentry");
      setNote("");
      setBeforePhoto(null);
      setAfterPhoto(null);
      if (beforeInput.current) beforeInput.current.value = "";
      if (afterInput.current) afterInput.current.value = "";
      setPosted(true);
      try {
        await onDone();
      } catch (refreshError) {
        // The portfolio write succeeded; a refresh failure must not make the
        // worker think the entry failed and submit a duplicate.
        console.error("[portfolio] entry saved but profile refresh failed:", refreshError);
      }
    } catch (saveError) {
      console.error("[portfolio] publish failed:", saveError);
      setError("Could not save your portfolio entry. Please try again.");
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
          Show households examples of your work. Published entries appear on your public profile.
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pf-before">Before photo (optional)</label>
          <input ref={beforeInput} id="pf-before" className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setBeforePhoto(event.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label className="label" htmlFor="pf-after">After photo (optional)</label>
          <input ref={afterInput} id="pf-after" className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAfterPhoto(event.target.files?.[0] ?? null)} />
        </div>
      </div>
      <p className="caption">JPG, PNG, or WebP; up to 4 MB per photo. Photos appear on your public profile.</p>

      {error ? <Notice tone="alert">{error}</Notice> : null}
      {posted ? <Notice>Portfolio entry published and added to your public profile.</Notice> : null}
      {!busy && title.trim().length < 3 ? <p className="caption" role="status">Enter a job title with at least 3 characters to publish.</p> : null}
      <ActionButton
        onClick={run}
        busy={busy}
        disabled={title.trim().length < 3}
        icon={<Upload size={13} strokeWidth={1.5} />}
      >
        {busy ? "Publishing entry…" : posted ? "Publish another entry" : "Publish entry"}
      </ActionButton>
    </Card>
  );
}

