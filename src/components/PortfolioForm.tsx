"use client";
import { useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
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
      await onDone();
    } catch {
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
          Voluntary after a completed job. Enriches your public profile.
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
          <input id="pf-before" className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setBeforePhoto(event.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label className="label" htmlFor="pf-after">After photo (optional)</label>
          <input id="pf-after" className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAfterPhoto(event.target.files?.[0] ?? null)} />
        </div>
      </div>
      <p className="caption">JPG, PNG, or WebP; up to 4 MB per photo. Photos appear on your public profile.</p>

      {error ? <Notice tone="alert">{error}</Notice> : null}
      <ActionButton
        onClick={run}
        busy={busy}
        disabled={title.trim().length < 3}
        icon={<Upload size={13} strokeWidth={1.5} />}
      >
        Publish entry
      </ActionButton>
    </Card>
  );
}

