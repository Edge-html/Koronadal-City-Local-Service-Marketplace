"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Image from "next/image";
import { useState } from "react";
import { Star } from "lucide-react";
import { cx, initials } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Badges — the ladder of emphasis, in ink only.                       */
/* ------------------------------------------------------------------ */

/**
 * Tones are named for what they mean, not how they look.
 *
 * They used to be named after hues — amber, coral, ember, violet — which was
 * accurate until the palette went achromatic. Leaving those names behind would
 * have meant a `tone="coral"` badge with nothing coral about it and no way for
 * the next person to discover the mapping. The rendering ladder lives in
 * globals.css under `.badge-*`.
 */
export type Tone =
  /** Confirmed fact. Solid ink. */
  | "verified"
  /** Waiting on this user to act. Hatched. */
  | "action"
  /** Risk, or blocked. Heavy outline. */
  | "alert"
  /** Work in flight. Soft fill, hairline. */
  | "active"
  /** Just arrived, untouched. Dashed outline. */
  | "new"
  /** Settled. */
  | "neutral"
  /** Closed out. */
  | "muted";

const TONE_CLASS: Record<Tone, string> = {
  verified: "badge-verified",
  action: "badge-action",
  alert: "badge-alert",
  active: "badge-active",
  new: "badge-new",
  neutral: "badge-neutral",
  muted: "badge-muted",
};

export function Badge({
  tone = "neutral",
  children,
  icon,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("badge", TONE_CLASS[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  id,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return <Tag id={id} className={cx("card", className)}>{children}</Tag>;
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "font-[family-name:var(--font-system-ui)] text-[10px] leading-[1.3] tracking-[-0.3px] uppercase text-stone-500",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  /**
   * A control that belongs with the heading rather than in the body. Keeping
   * the section's primary action up here leaves the body free of a second
   * call to action competing with it.
   */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cx(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <div
        className={cx(
          "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
          align === "center" && "sm:flex-col sm:items-center",
        )}
      >
        <h2 className="section-title">{title}</h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? (
        <p className={cx("section-desc", align === "center" && "mx-auto max-w-[560px]")}>
          {description}
        </p>
      ) : null}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Data display                                                        */
/* ------------------------------------------------------------------ */

/** Compact metric display. Big number in Ink Black, label/sublabel muted. */
export function StatCard({
  label,
  value,
  sublabel,
  className,
}: {
  label: string;
  value: ReactNode;
  sublabel?: string;
  className?: string;
}) {
  return (
    <div className={cx("rounded-md border border-stone-200 bg-white p-4", className)}>
      <p className="font-[family-name:var(--font-system-ui)] text-[12px] leading-[1.3] tracking-[-0.36px] text-stone-500">
        {label}
      </p>
      <p className="mt-2 text-[24px] leading-[1.2] font-medium tracking-[-0.48px] text-ink-black tabular-nums">
        {value}
      </p>
      {sublabel ? <p className="caption">{sublabel}</p> : null}
    </div>
  );
}

export function StarRating({
  value,
  count,
  size = 13,
  showValue = true,
}: {
  value: number;
  count?: number;
  size?: number;
  showValue?: boolean;
}) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1.5 text-stone-600">
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = rounded >= i;
          const half = !filled && rounded >= i - 0.5;
          return (
            <Star
              key={i}
              width={size}
              height={size}
              strokeWidth={1.5}
              className={
                filled
                  ? "fill-ink-black text-ink-black"
                  : half
                    ? "fill-stone-400 text-stone-400"
                    : "fill-transparent text-stone-200"
              }
            />
          );
        })}
      </span>
      {showValue ? (
        <span className="font-[family-name:var(--font-system-ui)] text-[12px] tracking-[-0.36px] tabular-nums">
          {value > 0 ? value.toFixed(1) : "â€”"}
          {count !== undefined ? (
            <span className="text-stone-400"> ({count})</span>
          ) : null}
        </span>
      ) : null}
      <span className="sr-only">
        {value > 0 ? `${value.toFixed(1)} out of 5 stars` : "Not yet rated"}
      </span>
    </span>
  );
}

export function Avatar({
  name,
  size = 40,
  className,
    photoUrl,
}: {
  name: string;
  size?: number;
  className?: string;
    photoUrl?: string;
}) {
    const [imageFailed, setImageFailed] = useState(false);
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-stone-200 bg-bone font-[family-name:var(--font-geist)] font-medium tracking-[-0.02em] text-stone-700",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
        aria-label={name ? `${name} profile photo` : "Profile photo"}
    >
        {photoUrl && !imageFailed ? <Image src={photoUrl} alt="" width={size} height={size} unoptimized onError={() => setImageFailed(true)} className="h-full w-full rounded-full object-cover" /> : initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Async handlers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Wraps an async event handler so its rejection is always observed.
 *
 * Handlers that reset state in `finally` without a `catch` let a rejected
 * Firestore call escape as an unhandled promise rejection — visible in the
 * console as "Uncaught (in promise)" with no indication that the user's action
 * silently did nothing. This settles the promise at the boundary.
 */
export function safeAsync(
  fn: () => void | Promise<void>,
  label = "action",
): () => void {
  return () => {
    try {
      Promise.resolve(fn()).catch((error) => {
        console.error(`[${label}] failed:`, error);
      });
    } catch (error) {
      console.error(`[${label}] failed:`, error);
    }
  };
}

/* ------------------------------------------------------------------ */
/* Empty & loading states                                              */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-20 text-center">
      {icon ? <div className="text-stone-400">{icon}</div> : null}
      <h3 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
        {title}
      </h3>
      {description ? (
        <p className="max-w-[44ch] text-[14px] leading-[1.4] text-stone-600">
          {description}
        </p>
      ) : null}
      {action ? (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx("animate-pulse rounded-md bg-stone-200/70", className)}
      aria-hidden
    />
  );
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-20 text-stone-500"
      role="status"
    >
      <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-stone-200 border-t-ink-black" />
      <span className="font-[family-name:var(--font-system-ui)] text-[12px] tracking-[-0.36px]">
        {label}â€¦
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export function Notice({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "alert";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "alert" ? "alert" : "status"}
      className={cx(
        "rounded-md border px-3 py-2.5 text-[13px] leading-[1.4]",
        // The two tones used to differ only by a word of grey in the text
        // colour, which is not a difference a reader can act on. Now that hue
        // is gone entirely, an alert earns its own container: a hard ink
        // border and a solid ink leading rule, so it reads as a distinct
        // object rather than a slightly darker paragraph.
        tone === "alert"
          ? "border-ink-black bg-white text-ink-black [border-left-width:3px]"
          : "border-stone-200 bg-bone text-stone-700",
        className,
      )}
    >
      {children}
    </div>
  );
}
