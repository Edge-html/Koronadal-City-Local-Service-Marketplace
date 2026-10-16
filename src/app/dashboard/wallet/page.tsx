"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Wallet as WalletIcon } from "lucide-react";
import { FlowGuide } from "@/components/FlowGuide";
import { DashboardShell } from "@/components/DashboardShell";
import { ActionButton } from "@/components/JobCard";
import { Card, Notice, StatCard } from "@/components/ui";
import { WALLET_TOPUP_METHODS } from "@/lib/constants";
import { getWorkerByUid, listLedger, listTopUpRequestsForWorker, topUpWallet } from "@/lib/data";
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
  const [pendingCount, setPendingCount] = useState(0);
  const [message, setMessage] = useState("");
  const [method, setMethod] = useState<"gcash" | "cliqq">("gcash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    const w = await getWorkerByUid(user!.uid);
    setWorker(w);
    if (w) {
      setEntries(await listLedger(w.uid));
      setPendingCount((await listTopUpRequestsForWorker(w.uid)).filter((r) => r.status === "pending").length);
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
      await topUpWallet(worker, value, method, reference);
      setMessage("Request submitted. Your balance changes only after an administrator verifies the payment.");
      setReference("");
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
          { title: "Make your payment", detail: "Choose a payment method and pay the amount you want to add to your platform balance." },
          { title: "Submit the reference", detail: "Enter the amount and payment reference below so an admin can verify it." },
          { title: "Wait for verification", detail: "Your balance is credited after approval. This balance covers your platform commission." },
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
                Submit a payment reference for administrator verification
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

            <ActionButton
              onClick={topUp}
              busy={busy}
              disabled={!(Number(amount) > 0) || reference.trim().length < 4}
            >
              Request {formatPeso(Number(amount) || 0)} top-up
            </ActionButton>

            <p className="caption border-t border-stone-200 pt-3">
              {pendingCount} pending request{pendingCount === 1 ? "" : "s"}. Arrange payment with the platform team through your chosen
              channel, then enter its transaction reference. An administrator
              must verify payment before funds are credited.
            </p>
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