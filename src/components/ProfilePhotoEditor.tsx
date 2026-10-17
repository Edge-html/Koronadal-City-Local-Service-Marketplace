"use client";

import { useState } from "react";
import { Avatar, Notice } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export function ProfilePhotoEditor({ name, photoUrl, onSaved }: { name: string; photoUrl?: string; onSaved: (url: string) => void }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function upload() {
    if (!user || !file) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      const token = await user.getIdToken();
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/profile-photo", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
      const result = await response.json() as { error?: string; photoUrl?: string };
      if (!response.ok || !result.photoUrl) throw new Error(result.error || "Photo upload failed.");
      onSaved(result.photoUrl); setFile(null); setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Photo upload failed."); }
    finally { setBusy(false); }
  }
  return <section className="flex flex-wrap items-center gap-4 rounded-lg border border-stone-200 bg-white p-4">
    <Avatar name={name} size={64} photoUrl={photoUrl} />
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div><h2 className="text-sm font-medium">Profile photo</h2><p className="caption mt-1">Shown on your account and profile. JPG, PNG, or WebP, maximum 4 MB.</p></div>
      <input className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {error ? <Notice tone="alert">{error}</Notice> : null}{saved ? <Notice>Profile photo updated.</Notice> : null}
      <button type="button" className="btn-neutral btn-sm self-start" disabled={!file || busy} onClick={upload}>{busy ? "Uploading…" : "Save profile photo"}</button>
    </div>
  </section>;
}
