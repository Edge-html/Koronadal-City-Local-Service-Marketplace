"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Upload, Wallet as WalletIcon } from "lucide-react";
import { FlowGuide } from "@/components/FlowGuide";
import { DashboardShell } from "@/components/DashboardShell";
import { ActionButton } from "@/components/JobCard";
import { Card, Notice, StatCard } from "@/components/ui";
import { WALLET_TOPUP_METHODS } from "@/lib/constants";
import { getPaymentSettings, getWorkerByUid, listLedger, listTopUpRequestsForWorker, topUpWallet, type PaymentSettings } from "@/lib/data";
import { PaymentQrImage } from "@/components/PaymentSettings";
import { uploadPaymentImage } from "@/lib/payment-files";
import { COMMISSION_RATE, availableBalance, formatPeso } from "@/lib/commission";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";
import type { LedgerEntry, Worker } from "@/lib/types";

export default function WalletPage() {
  const { user, loading: authLoading } = useAuth();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [amount, setAmount] = useState("500");
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [topUpRequests, setTopUpRequests] = useState<Awaited<ReturnType<typeof listTopUpRequestsForWorker>>>([]);
  const [message, setMessage] = useState("");
  const [method, setMethod] = useState<"gcash" | "cliqq">("gcash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    const w = await getWorkerByUid(user!.uid);
    setWorker(w);
    if (w) {
      const [ledger, requests, settings] = await Promise.all([
        listLedger(w.uid), listTopUpRequestsForWorker(w.uid), getPaymentSettings(),
      ]);
      setEntries(ledger);
      setPendingCount(requests.filter((r) => r.status === "pending").length);
      setTopUpRequests(requests.slice(0, 5));
      setPaymentSettings(settings);
    }
  };

  useEffect(() => {
    if (authLoading || !user) return;
    refresh().catch(() => setError("Could not load your wallet. Please refresh."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const coverage = useMemo(() => {
    if (!worker) return 0;
    return availableBalance(worker.walletBalance, worker.walletLocked);
  }, [worker]);

  // How many commission-locked jobs the current balance could underwrite.
  const laborCoverage = useMemo(() => {
    if (!coverage || coverage <= 0) return 0;
    return Math.floor(coverage / COMMISSION_RATE);
  }, [coverage]);

  async function topUp() {
    const value = Number(amount);
    if (!worker || !Number.isFinite(value) || value <= 0) return;

    setBusy(true);
    setError("");
    try {
      if (!receipt) throw new Error("Upload a screenshot of your payment receipt.");
      if (method === "gcash" && !paymentSettings) throw new Error("The administrator has not configured the GCash destination yet.");
      const receiptPath = await uploadPaymentImage(receipt, "receipt");
      await topUpWallet(worker, value, method, reference, receiptPath);
      setMessage("Request submitted. Your balance changes only after an administrator verifies the payment.");
      setReference("");
      setReceipt(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the top-up request.");
    } finally {
      setBusy(false);
    }
  }

  if (!worker) {
    return (
      <DashboardShell
        eyebrow="Worker console"
        title="Wallet"
        subtitle="Your prepaid balance funds the 10% labor commission."
      >
        <p className="meta">
          {error || "No worker profile found. Complete onboarding first."}
        </p>
      </DashboardShell>
    );
  }

  const breached = worker.walletBalance < 0;

  return (
    <DashboardShell
      eyebrow="Worker console"
      title="Wallet"
      subtitle="A prepaid balance funds the 10% labor commission without the platform ever handling client funds."
    >
      <div className="flex flex-col gap-4">
        <FlowGuide steps={[
          { title: "1. Pay the platform", detail: "Use the official GCash number or QR shown below, or pay through CliQQ. This deposit is for your platform commission, not your job earnings." },
          { title: "2. Upload proof", detail: "Enter the exact amount and transaction reference, then upload a clear receipt screenshot." },
          { title: "3. Wait for admin review", detail: "An admin checks the receipt and approves or rejects the request. Your wallet changes only after approval." },
        ]} />
        {breached ? (
          <Card className="flex items-start gap-3 attention-border p-5">
            <AlertTriangle
              size={15}
              strokeWidth={1.5}
              className="attention mt-0.5 shrink-0"
            />
            <p className="text-[13px] leading-[1.5] text-stone-700">
              Your balance is below zero. You are paused from receiving new job
              requests until you reload.
            </p>
          </Card>
        ) : null}

        {error ? <Notice tone="alert">{error}</Notice> : null}
        {message ? <Notice>{message}</Notice> : null}

        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard
            label="Prepaid balance"
            value={formatPeso(worker.walletBalance)}
            sublabel={breached ? "Breached" : "Available to draw against"}
          />
          <StatCard
            label="Locked on approvals"
            value={formatPeso(worker.walletLocked)}
            sublabel="Settles on completion"
          />
          <StatCard
            label="Unlocked headroom"
            value={formatPeso(coverage)}
            sublabel={
              laborCoverage > 0
                ? `Covers ~${formatPeso(laborCoverage)} of labor`
                : "Reload to accept jobs"
            }
          />
          <StatCard
            label="Commission rate"
            value={`${COMMISSION_RATE * 100}%`}
            sublabel="Labor only, materials exempt"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[380px_1fr] lg:items-start">
          {/* Top-up */}
          <Card className="flex flex-col gap-4 p-5">
            <div>
              <h2 className="flex items-center gap-2 text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
                <WalletIcon size={15} strokeWidth={1.5} />
                Top up
              </h2>
              <p className="caption mt-1">
                Pay the platform commission deposit and submit proof for admin review.
              </p>
            </div>

            <fieldset>
              <legend className="label">Method</legend>
              <div className="flex flex-col gap-2">
                {WALLET_TOPUP_METHODS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMethod(option.id)}
                    aria-pressed={method === option.id}
                    className={
                      method === option.id
                        ? "flex flex-col gap-0.5 rounded-md border border-ink-black bg-white p-3 text-left"
                        : "flex flex-col gap-0.5 rounded-md border border-stone-200 bg-bone p-3 text-left transition-colors hover:border-stone-400"
                    }
                  >
                    <span className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
                      {option.name}
                    </span>
                    <span className="caption">{option.detail}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {method === "gcash" ? (
              paymentSettings ? <div className="rounded-lg border border-stone-200 bg-bone p-4">
                <p className="label mb-2">Pay this official GCash account</p>
                <dl className="mb-3 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="caption">Account name</dt><dd className="mt-1 font-medium text-ink-black">{paymentSettings.gcashAccountName}</dd></div>
                  <div><dt className="caption">GCash number</dt><dd className="mt-1 font-medium text-ink-black tabular-nums">{paymentSettings.gcashNumber || "Use QR code"}</dd></div>
                </dl>
                {paymentSettings.gcashQrPath ? <PaymentQrImage path={paymentSettings.gcashQrPath} /> : null}
                <p className="mt-3 text-xs leading-relaxed text-stone-600">Confirm the account name before sending. The administrator will compare your receipt and reference with the platform’s GCash history.</p>
              </div> : <Notice tone="alert">GCash top-ups are temporarily unavailable because the administrator has not configured the official account yet.</Notice>
            ) : <div className="rounded-lg border border-stone-200 bg-bone p-4 text-sm leading-relaxed text-stone-600">Pay through a 7-Eleven CliQQ terminal or app, then keep the receipt and upload its screenshot below.</div>}

            <div>
              <label className="label" htmlFor="topup-amount">
                Amount (PHP)
              </label>
              <input
                id="topup-amount"
                className="field"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[200, 500, 1000, 2500].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAmount(String(value))}
                    className="rounded-md border border-stone-200 bg-bone px-2.5 py-1 text-[12px] tracking-[-0.02em] text-stone-700 transition-colors hover:border-stone-400"
                  >
                    {formatPeso(value)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="topup-reference">Payment reference or receipt number</label>
              <input id="topup-reference" className="field" value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="GCash or CliQQ transaction reference" />
            </div>

            <div>
              <label className="label" htmlFor="topup-receipt">Receipt screenshot</label>
              <label htmlFor="topup-receipt" className="flex min-h-20 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 bg-bone p-4 text-sm text-stone-700 hover:border-stone-500">
                <Upload size={15} />{receipt ? receipt.name : "Choose receipt image"}
              </label>
              <input id="topup-receipt" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
              <p className="caption mt-1">Required. Upload a clear JPG, PNG, or WebP image under 4 MB.</p>
            </div>

            <ActionButton
              onClick={topUp}
              busy={busy}
              disabled={!(Number(amount) > 0) || reference.trim().length < 4 || !receipt || (method === "gcash" && !paymentSettings)}
            >
              Request {formatPeso(Number(amount) || 0)} top-up
            </ActionButton>

            <p className="caption border-t border-stone-200 pt-3">
              {pendingCount} pending request{pendingCount === 1 ? "" : "s"}. The customer still pays you directly for the job; this wallet only covers your separate platform commission.
            </p>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-stone-200 px-5 py-4">
              <h2 className="text-[16px] font-medium text-ink-black">Top-up request status</h2>
              <p className="caption mt-1">Check whether your payment is waiting for review or has been processed.</p>
            </div>
            {topUpRequests.length === 0 ? <p className="px-5 py-6 text-sm text-stone-500">No top-up requests yet.</p> :
              <ul className="divide-y divide-stone-200">{topUpRequests.map((request) => <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div><p className="text-sm font-medium text-ink-black">{formatPeso(request.amount)} via {request.method.toUpperCase()}</p><p className="caption mt-1">Reference: {request.reference} · {formatDate(request.createdAt)}</p>{request.status === "rejected" ? <p className="mt-1 text-xs text-stone-700">Admin note: {request.reviewNote || "Please submit a new request with a clear receipt and valid reference."} Submit a new request after correcting it.</p> : null}</div>
                <span className="rounded-md border border-stone-200 px-2.5 py-1 text-xs text-stone-700">{request.status === "approved" ? "Approved · wallet credited" : request.status === "rejected" ? "Rejected · action needed" : "Pending admin review"}</span>
              </li>)}</ul>}
          </Card>

          {/* Ledger */}
          <Card className="overflow-hidden p-0">
            <div className="border-b border-stone-200 px-5 py-4">
              <h2 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
                Ledger
              </h2>
              <p className="caption mt-0.5">
                Every lock, settlement, and top-up in order
              </p>
            </div>

            {entries.length === 0 ? (
              <p className="px-5 py-8 text-[14px] text-stone-500">
                No wallet activity yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className="bg-bone text-left">
                      {["Entry", "Type", "Amount", "Balance", "Date"].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-5 py-2.5 font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] font-medium text-stone-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="border-b border-stone-200 px-5 py-3">
                          <span className="text-[13px] leading-[1.4] text-stone-700">
                            {entry.note}
                          </span>
                        </td>
                        <td className="border-b border-stone-200 px-5 py-3">
                          <span className="caption">
                            {LEDGER_LABELS[entry.kind] ?? entry.kind}
                          </span>
                        </td>
                        <td
                          className={
                            entry.amount >= 0
                              ? "border-b border-stone-200 px-5 py-3 text-[13px] text-stone-700 tabular-nums"
                              : "border-b border-stone-200 px-5 py-3 text-[13px] text-ink-black tabular-nums"
                          }
                        >
                          {entry.amount >= 0 ? "+" : ""}
                          {formatPeso(entry.amount)}
                        </td>
                        <td className="border-b border-stone-200 px-5 py-3 text-[13px] text-stone-700 tabular-nums">
                          {formatPeso(entry.balanceAfter)}
                        </td>
                        <td className="border-b border-stone-200 px-5 py-3">
                          <span className="caption">
                            {formatDate(entry.createdAt as string)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

const LEDGER_LABELS: Record<string, string> = {
  top_up: "Top-up",
  commission_lock: "Commission lock",
  commission_settle: "Commission settled",
  referral_credit: "Referral credit",
};
