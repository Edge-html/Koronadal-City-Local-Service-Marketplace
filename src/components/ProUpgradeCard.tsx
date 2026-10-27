"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ActionButton } from "@/components/JobCard";
import { Card, Notice } from "@/components/ui";
import { ProPaymentImage, ProPaymentImagePreview } from "@/components/ProPaymentImage";
import { getProPaymentInfo, submitProPaymentRequest, type ProPaymentRequest, type ProPaymentSettings } from "@/lib/data";
import { uploadProPaymentImage } from "@/lib/pro-payment-files";
import type { Worker } from "@/lib/types";

function peso(value: number) {
  return `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

export function ProUpgradeCard({ worker }: { worker: Worker }) {
  const [settings, setSettings] = useState<ProPaymentSettings | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<ProPaymentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    getProPaymentInfo().then((info) => {
      if (!active) return;
      setSettings(info.settings);
      setPaymentRequest(info.request);
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "Could not load Pro payment details.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [worker.id]);

  const settingsReady = Boolean(settings?.gcashAccountName && settings.gcashNumber && settings.gcashQrPath && settings.proFee > 0);
  const pending = paymentRequest?.status === "pending";
  const proActive = worker.isPro || paymentRequest?.status === "approved";
  const eligible = worker.verified && worker.status === "active";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!receipt || !settingsReady) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const proofPath = await uploadProPaymentImage(receipt, "receipt");
      await submitProPaymentRequest(worker.id, proofPath, reference);
      const info = await getProPaymentInfo();
      setPaymentRequest(info.request);
      setOpen(false);
      setReceipt(null);
      setReference("");
      setNotice("Your GCash payment was submitted. Pro will activate after an administrator reviews the receipt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the Pro payment.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Card className="flex flex-wrap items-center justify-between gap-4 border-blue-200 bg-blue-50/50 p-5">
      <div className="flex items-start gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-black">
            {proActive ? "KoroHanap Pro is active" : pending ? "Pro payment under review" : eligible ? "Try KoroHanap Pro" : "Pro available after verification"}
          </h2>
          <p className="mt-1 max-w-[65ch] text-sm text-stone-600">
            {proActive
              ? "Your Pro badge, highlighted profile, and priority placement are active."
              : pending
                ? "Your GCash receipt is waiting for administrator review. Pro features will turn on after approval."
                : eligible
                  ? "Get a Pro badge, a highlighted profile card, and priority placement in the worker directory."
                  : "Complete worker verification before submitting a Pro payment."}
          </p>
          {paymentRequest?.status === "rejected" && paymentRequest.reviewNote
            ? <p className="mt-2 text-xs text-rose-700">Previous payment: {paymentRequest.reviewNote}</p>
            : null}
          {notice ? <p role="status" className="mt-2 text-xs text-emerald-800">{notice}</p> : null}
          {error && !open ? <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p> : null}
        </div>
      </div>
      {proActive ? (
        <span className="rounded-lg bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-900">Pro active</span>
      ) : (
        <ActionButton variant="primary" busy={loading} disabled={pending || !eligible} onClick={() => { setError(""); setOpen(true); }}>
          {pending ? "Payment under review" : !eligible ? "Available after verification" : paymentRequest?.status === "rejected" ? "Resubmit payment" : "Activate Pro"}
        </ActionButton>
      )}
    </Card>

    {open ? <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="pro-payment-title" className="my-auto max-h-[min(92vh,900px)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="caption text-blue-800">KoroHanap Pro</p>
            <h2 id="pro-payment-title" className="mt-1 text-xl font-semibold text-ink-black">Activate your Pro profile</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-stone-600 hover:bg-stone-100" aria-label="Close Pro activation window"><X size={18} /></button>
        </header>

        <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[.9fr_1.1fr]">
          <div>
            <h3 className="text-sm font-semibold text-ink-black">Pro benefits</h3>
            <ul className="mt-3 space-y-3 text-sm text-stone-600">
              <li><strong className="text-stone-900">Pro badge:</strong> stand out as a Pro worker in the directory.</li>
              <li><strong className="text-stone-900">Highlighted profile:</strong> make your profile easier to notice.</li>
              <li><strong className="text-stone-900">Priority placement:</strong> appear ahead of standard profiles in worker listings.</li>
            </ul>
            {settingsReady ? <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-950">Pro activation fee: <strong>{peso(settings!.proFee)}</strong></p> : null}
            <p className="mt-4 text-xs leading-relaxed text-stone-500">Pay through GCash, then enter the transfer reference and attach a clear screenshot of the receipt. An administrator will verify the payment before Pro activates.</p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            {error ? <Notice tone="alert">{error}</Notice> : null}
            {!settingsReady ? <Notice tone="alert">The administrator has not finished setting up GCash payments yet. Please try again later.</Notice> : <>
              <div className="rounded-xl border border-stone-200 p-4">
                <p className="text-sm font-semibold text-stone-900">Pay to this GCash account</p>
                <p className="mt-2 text-sm text-stone-700"><span className="text-stone-500">Account name:</span> {settings!.gcashAccountName}</p>
                <p className="mt-1 text-sm text-stone-700"><span className="text-stone-500">GCash number:</span> {settings!.gcashNumber}</p>
                <p className="mt-1 text-sm text-stone-700"><span className="text-stone-500">Amount:</span> {peso(settings!.proFee)}</p>
                <div className="mt-4 flex justify-center rounded-lg bg-white p-2">
                  <ProPaymentImage path={settings!.gcashQrPath} alt="Administrator's GCash QR code" className="h-52 w-52 rounded-md object-contain" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="pro-payment-reference">GCash reference number</label>
                <input id="pro-payment-reference" className="field" value={reference} onChange={(event) => setReference(event.target.value)} minLength={4} maxLength={50} required placeholder="Enter the reference from your GCash receipt" />
              </div>
              <div>
                <label className="label" htmlFor="pro-payment-receipt">Payment receipt screenshot</label>
                <input id="pro-payment-receipt" className="field" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} />
                <p className="caption mt-1">JPG, PNG, or WebP; up to 4 MB. Only you and administrators can view it.</p>
                {receipt ? <ProPaymentImagePreview file={receipt} alt="GCash receipt preview" className="mt-3 max-h-48 w-full rounded-lg border border-stone-200 object-contain" /> : null}
              </div>
            </>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-stone-200 pt-4">
              <button type="button" className="btn-neutral" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" disabled={busy || !settingsReady || !receipt || reference.trim().length < 4} className="btn-primary">
                {busy ? "Submitting…" : "Submit payment for review"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div> : null}
  </>;
}
