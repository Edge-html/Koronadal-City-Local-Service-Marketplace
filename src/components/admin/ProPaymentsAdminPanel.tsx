"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/JobCard";
import { ProPaymentImage, ProPaymentImagePreview } from "@/components/ProPaymentImage";
import { Card, Notice } from "@/components/ui";
import { getProPaymentInfo, reviewProPaymentRequest, saveProPaymentSettings, type ProPaymentRequest, type ProPaymentSettings } from "@/lib/data";
import { uploadProPaymentImage } from "@/lib/pro-payment-files";
import { formatDate } from "@/lib/utils";

const EMPTY_SETTINGS: ProPaymentSettings = {
  gcashAccountName: "",
  gcashNumber: "",
  gcashQrPath: "",
  proFee: 0,
};

export function ProPaymentsAdminPanel() {
  const [settings, setSettings] = useState<ProPaymentSettings>(EMPTY_SETTINGS);
  const [requests, setRequests] = useState<ProPaymentRequest[]>([]);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const info = await getProPaymentInfo();
    setSettings(info.settings ?? EMPTY_SETTINGS);
    setRequests(info.requests);
  }, []);

  useEffect(() => {
    refresh().catch(() => setError("Could not load the Pro payment queue."))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function saveSettings() {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const gcashQrPath = qrFile ? await uploadProPaymentImage(qrFile, "qr") : settings.gcashQrPath;
      const next = { ...settings, gcashQrPath };
      await saveProPaymentSettings(next);
      setSettings(next);
      setQrFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setStatus("Pro payment destination saved. Workers will see these GCash details in the activation window.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the Pro payment destination.");
    } finally {
      setBusy(false);
    }
  }

  async function review(request: ProPaymentRequest, approve: boolean) {
    const reviewNote = notes[request.id]?.trim() ?? "";
    if (!approve && reviewNote.length < 5) {
      setError("Enter a short reason before rejecting this receipt.");
      return;
    }
    setBusyId(request.id);
    setError("");
    setStatus("");
    try {
      await reviewProPaymentRequest(request.id, approve, reviewNote);
      await refresh();
      setStatus(approve ? `${request.workerName}'s payment was approved. Pro is now active.` : `${request.workerName}'s payment was rejected.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review this Pro payment.");
    } finally {
      setBusyId(null);
    }
  }

  const hasQr = Boolean(qrFile || settings.gcashQrPath);
  return <div className="flex flex-col gap-4">
    {error ? <Notice tone="alert">{error}</Notice> : null}
    {status ? <Notice>{status}</Notice> : null}

    <Card className="p-5">
      <h2 className="text-base font-semibold text-ink-black">Pro activation payment setup</h2>
      <p className="mt-1 max-w-[75ch] text-sm text-stone-600">Set the activation fee and official GCash destination. Workers see these details when they choose Activate Pro. Upload the QR code from the account that will receive payment.</p>
      {loading ? <p className="mt-4 text-sm text-stone-500">Loading payment settings…</p> : <form onSubmit={(event) => { event.preventDefault(); void saveSettings(); }} className="mt-5 grid gap-4 md:grid-cols-[1fr_230px]">
        <div className="flex flex-col gap-3">
          <div><label className="label" htmlFor="pro-fee">Pro activation fee (PHP)</label><input id="pro-fee" className="field" type="number" min="1" max="100000" step="1" required value={settings.proFee || ""} onChange={(event) => setSettings({ ...settings, proFee: Number(event.target.value) })} placeholder="e.g. 99" /></div>
          <div><label className="label" htmlFor="pro-gcash-name">GCash account name</label><input id="pro-gcash-name" className="field" maxLength={100} required value={settings.gcashAccountName} onChange={(event) => setSettings({ ...settings, gcashAccountName: event.target.value })} placeholder="Name shown in GCash" /></div>
          <div><label className="label" htmlFor="pro-gcash-number">GCash number</label><input id="pro-gcash-number" className="field" inputMode="numeric" pattern="09[0-9]{9}" maxLength={11} required value={settings.gcashNumber} onChange={(event) => setSettings({ ...settings, gcashNumber: event.target.value })} placeholder="09XXXXXXXXX" /></div>
          <div><label className="label" htmlFor="pro-gcash-qr">GCash QR code</label><input ref={inputRef} id="pro-gcash-qr" className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setQrFile(event.target.files?.[0] ?? null)} /><p className="caption mt-1">JPG, PNG, or WebP; maximum 4 MB. A QR code is required before workers can submit payment.</p>
            {qrFile ? <button type="button" className="mt-2 text-xs text-stone-600 underline underline-offset-2" onClick={() => { setQrFile(null); if (inputRef.current) inputRef.current.value = ""; }}>Clear selected QR image</button> : null}</div>
          <button type="submit" disabled={busy || loading || !settings.proFee || !settings.gcashAccountName.trim() || !settings.gcashNumber.trim() || !hasQr} className="btn-primary">
            {busy ? "Saving…" : "Save Pro payment details"}
          </button>
        </div>
        <div className="flex justify-center md:justify-end">
          {qrFile ? <ProPaymentImagePreview file={qrFile} alt="New Pro payment QR preview" className="h-52 w-52 rounded-lg border border-stone-200 bg-white object-contain p-2" />
            : settings.gcashQrPath ? <ProPaymentImage path={settings.gcashQrPath} alt="Current Pro payment GCash QR code" className="h-52 w-52 rounded-lg border border-stone-200 bg-white object-contain p-2" />
              : <div className="flex h-52 w-52 items-center justify-center rounded-lg border border-dashed border-stone-300 p-4 text-center text-sm text-stone-500">No QR code uploaded</div>}
        </div>
      </form>}
    </Card>

    <Card className="overflow-hidden p-0">
      <div className="border-b border-stone-200 px-5 py-4">
        <h2 className="text-base font-semibold text-ink-black">Worker Pro payment requests <span className="ml-1 text-stone-500">({requests.length})</span></h2>
        <p className="mt-1 text-sm text-stone-600">Check the GCash transfer in the receiving account before approving. Approval activates the worker&apos;s Pro benefits.</p>
      </div>
      {loading ? <p className="p-5 text-sm text-stone-500">Loading payment requests…</p> : requests.length === 0 ? <p className="p-5 text-sm text-stone-500">No payments are waiting for review.</p> : <ul className="divide-y divide-stone-200">
        {requests.map((request) => <li key={request.id} className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-semibold text-ink-black">{request.workerName}</h3><p className="mt-1 text-sm text-stone-600">GCash reference <strong className="font-mono text-stone-900">{request.reference}</strong></p><p className="mt-1 text-xs text-stone-500">Amount: ₱{request.amount.toLocaleString("en-PH")} · Submitted {formatDate(request.submittedAt)}</p></div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">Pending review</span>
            </div>
            <div className="mt-4 max-w-md"><label className="label" htmlFor={`pro-review-note-${request.id}`}>Rejection note (required only if rejecting)</label><textarea id={`pro-review-note-${request.id}`} className="field min-h-20" maxLength={500} value={notes[request.id] ?? ""} onChange={(event) => setNotes({ ...notes, [request.id]: event.target.value })} placeholder="Tell the worker what to correct if the receipt cannot be verified." /></div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton busy={busyId === request.id} onClick={() => review(request, true)}>Approve payment and activate Pro</ActionButton>
              <ActionButton variant="neutral" busy={busyId === request.id} onClick={() => review(request, false)}>Reject payment</ActionButton>
            </div>
          </div>
          <div><p className="label mb-2">Uploaded receipt</p><ProPaymentImage path={request.proofPath} alt={`GCash payment receipt from ${request.workerName}`} className="h-56 w-full rounded-lg border border-stone-200 bg-white object-contain p-2" /></div>
        </li>)}
      </ul>}
    </Card>
  </div>;
}
