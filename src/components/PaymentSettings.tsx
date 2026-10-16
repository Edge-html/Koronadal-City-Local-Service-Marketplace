"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Card, Notice } from "@/components/ui";
import { ActionButton } from "@/components/JobCard";
import { getPaymentSettings, savePaymentSettings, type PaymentSettings } from "@/lib/data";
import { loadPaymentImage, uploadPaymentImage } from "@/lib/payment-files";

export function PaymentQrImage({ path, alt = "Platform GCash QR code" }: { path: string; alt?: string }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let url = "";
    loadPaymentImage(path).then((value) => {
      url = value;
      if (active) setSrc(value);
      else URL.revokeObjectURL(value);
    }).catch(() => { if (active) setError("QR image could not be loaded."); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [path]);
  if (error) return <p className="text-xs text-stone-500">{error}</p>;
  if (!src) return <div className="h-48 w-48 animate-pulse rounded-lg bg-stone-100" aria-label="Loading QR code" />;
  return <Image src={src} alt={alt} width={192} height={192} unoptimized className="h-48 w-48 rounded-lg border border-stone-200 bg-white object-contain p-2" />;
}

function LocalImagePreview({ file }: { file: File }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return src ? <Image src={src} alt="New GCash QR preview" width={192} height={192} unoptimized className="h-48 w-48 rounded-lg border border-stone-200 object-contain p-2" /> : null;
}

export function PaymentSettingsCard() {
  const [settings, setSettings] = useState<PaymentSettings>({ gcashAccountName: "", gcashNumber: "", gcashQrPath: "" });
  const [qr, setQr] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPaymentSettings().then((value) => {
      if (value) setSettings(value);
    }).catch(() => setError("Could not load the current payment setup."))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true); setError(""); setSaved(false);
    try {
      const gcashQrPath = qr ? await uploadPaymentImage(qr, "qr") : settings.gcashQrPath;
      const next = { ...settings, gcashQrPath };
      await savePaymentSettings(next);
      setSettings(next); setQr(null); setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the payment setup.");
    } finally { setBusy(false); }
  }

  return <Card className="flex flex-col gap-4 p-5">
    <div><h2 className="text-base font-medium text-ink-black">Worker top-up destination</h2>
      <p className="caption mt-1">Workers see these official GCash details before submitting a payment receipt.</p></div>
    {loading ? <p className="text-sm text-stone-500">Loading payment setup…</p> : <>
      {error ? <Notice tone="alert">{error}</Notice> : null}
      {saved ? <Notice>GCash payment details saved. Workers can now see the updated destination.</Notice> : null}
      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="flex flex-col gap-3">
          <div><label className="label" htmlFor="gcash-name">GCash account name</label>
            <input id="gcash-name" className="field" value={settings.gcashAccountName} onChange={(e) => setSettings({ ...settings, gcashAccountName: e.target.value })} placeholder="Official account holder" /></div>
          <div><label className="label" htmlFor="gcash-number">GCash number</label>
            <input id="gcash-number" className="field" inputMode="numeric" value={settings.gcashNumber} onChange={(e) => setSettings({ ...settings, gcashNumber: e.target.value })} placeholder="09XXXXXXXXX" /></div>
          <div><label className="label" htmlFor="gcash-qr">GCash QR image (optional if a number is provided)</label>
            <input ref={input} id="gcash-qr" type="file" accept="image/jpeg,image/png,image/webp" className="field" onChange={(e) => setQr(e.target.files?.[0] ?? null)} />
            <p className="caption mt-1">JPG, PNG, or WebP; maximum 4 MB. Uploading a new image replaces the QR shown to workers.</p></div>
        </div>
        <div>{qr ? <LocalImagePreview file={qr} />
          : settings.gcashQrPath ? <PaymentQrImage path={settings.gcashQrPath} />
            : <div className="flex h-48 w-48 items-center justify-center rounded-lg border border-dashed border-stone-300 p-4 text-center text-xs text-stone-500">No QR image uploaded</div>}</div>
      </div>
      <ActionButton onClick={save} busy={busy} disabled={!settings.gcashAccountName.trim() || (!settings.gcashNumber.trim() && !settings.gcashQrPath && !qr)}>Save payment details</ActionButton>
    </>}
  </Card>;
}
