"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Briefcase, Hammer, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cx } from "@/lib/utils";
import type { DashboardMode } from "@/lib/types";

/**
 * Switches which console an account opens on.
 *
 * The two are not exclusive: a plumber can hire an electrician and a
 * household can decide to start offering services. So this changes the default
 * landing console rather than granting or removing any capability.
 */
export function ModeSwitcher({
  available,
  className,
}: {
  /** Whether a verified worker profile exists to switch into. */
  available: boolean;
  className?: string;
}) {
  const { mode, setMode } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const options: Array<{
    id: DashboardMode;
    label: string;
    note: string;
    icon: typeof Hammer;
    href: string;
    disabled?: boolean;
  }> = [
    {
      id: "customer",
      label: "Finding a service",
      note: "Browse workers, post requests",
      icon: Hammer,
      href: "/browse",
    },
    {
      id: "worker",
      label: "Working as a provider",
      note: "Job requests, quotes, wallet",
      icon: Briefcase,
      href: "/dashboard/worker",
      disabled: !available,
    },
  ];

  async function go(next: DashboardMode, href: string) {
    if (busy || next === mode) return;
    setBusy(true);
    try {
      await setMode(next);
      router.push(href);
    } catch (err) {
      console.error("[mode] switch failed:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <p className="label mb-0">Using this account to</p>
        {busy ? (
          <Loader2 size={13} strokeWidth={1.5} className="animate-spin text-stone-400" />
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const active = mode === option.id;
          const Icon = option.icon;

          return (
            <button
              key={option.id}
              type="button"
              disabled={busy || option.disabled}
              onClick={() => go(option.id, option.href)}
              aria-pressed={active}
              title={
                option.disabled
                  ? "Finish your worker application to unlock this view"
                  : undefined
              }
              className={cx(
                "flex flex-col gap-1 rounded-md border p-3 text-left transition-colors",
                active
                  ? "border-ink-black bg-white"
                  : "border-stone-200 bg-bone hover:border-stone-400",
                option.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="flex items-center gap-2">
                <Icon
                  size={14}
                  strokeWidth={1.5}
                  className={active ? "text-ink-black" : "text-stone-500"}
                />
                <span
                  className={cx(
                    "text-[13px] font-medium tracking-[-0.02em]",
                    active ? "text-ink-black" : "text-stone-700",
                  )}
                >
                  {option.label}
                </span>
              </span>
              <span className="caption">
                {option.disabled
                  ? "Locked until your application is approved"
                  : option.note}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
