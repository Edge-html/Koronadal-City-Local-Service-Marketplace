"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Send } from "lucide-react";
import { ActionButton } from "@/components/JobCard";
import {
  Badge,
  Card,
  Notice,
  Skeleton,
  safeAsync,
} from "@/components/ui";
import { CATEGORY_MAP } from "@/lib/constants";
import { formatPeso } from "@/lib/commission";
import { createInquiry, listOpenOffersForWorker } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import type { ServiceOffer, Worker } from "@/lib/types";

/**
 * The worker's open offers, on their public profile.
 *
 * This is the half of the offer loop a household actually uses. An offer says
 * what the worker takes on and from what price; responding to one opens the
 * conversation without committing anyone to a job, which is a lighter step than
 * "send request" and the reason most first contact happens here.
 *
 * Contact masking still applies. Responding to an offer reveals nothing about
 * the household beyond what they choose to type.
 */
export function WorkerOffers({ worker }: { worker: Worker }) {
  const { user } = useAuth();
  const [offers, setOffers] = useState<ServiceOffer[] | null>(null);
  const [responded, setResponded] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listOpenOffersForWorker(worker.uid)
      .then((rows) => {
        if (!cancelled) setOffers(rows.filter((o) => o.status === "open"));
      })
      .catch((err) => {
        console.error("[offers] load failed:", err);
        if (cancelled) return;
        setOffers([]);
        setError(
          "Offers are not readable with the current Firestore rules. Publish firestore.rules from the Firebase console to enable this section.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [worker.uid]);

  const respond = useCallback(
    async (offer: ServiceOffer, message: string) => {
      if (!user) return;
      setBusyId(offer.id);
      setError("");
      try {
        await createInquiry(
          offer,
          { id: user.uid, name: user.displayName || user.email || "Household" },
          message,
        );
        setResponded((prev) => ({
          ...prev,
          [offer.id]: message.trim() || "Interested",
        }));
      } catch (err) {
        console.error("[offers] respond failed:", err);
        setError(
          "Could not send your response. If this mentions permissions, the deployed Firestore rules predate offers — publish firestore.rules and try again.",
        );
      } finally {
        setBusyId(null);
      }
    },
    [user],
  );

  // Nothing to show: stay out of the way rather than adding an empty card
  // between the resume and the portfolio. But not when the read failed —
  // otherwise the section disappears precisely when it has something to say,
  // which is the case an operator most needs to see.
  if (!error && offers && offers.length === 0) return null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-stone-200 px-6 py-4">
        <h2 className="flex items-center gap-2 text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
          <Megaphone size={16} strokeWidth={1.5} />
          Services on offer
        </h2>
        <p className="caption mt-0.5">
          Work {worker.fullName.split(" ")[0]} currently takes on, with a
          starting price
        </p>
      </div>

      {error ? (
        <div className="px-6 pt-4">
          <Notice tone="alert">{error}</Notice>
        </div>
      ) : null}

      {offers === null ? (
        <div className="flex flex-col gap-3 px-6 py-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-stone-200">
          {offers.map((offer) => (
            <OfferRow
              key={offer.id}
              offer={offer}
              sent={responded[offer.id]}
              busy={busyId === offer.id}
              signedIn={!!user}
              onRespond={respond}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function OfferRow({
  offer,
  sent,
  busy,
  signedIn,
  onRespond,
}: {
  offer: ServiceOffer;
  /** The message this household already sent, if any. */
  sent?: string;
  busy: boolean;
  signedIn: boolean;
  onRespond: (offer: ServiceOffer, message: string) => Promise<void>;
}) {
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <li className="flex flex-col gap-3 px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
            {offer.title}
          </h3>
          <p className="caption mt-0.5">
            {CATEGORY_MAP[offer.categoryId]?.name ?? "General"} · {offer.barangay}
          </p>
        </div>
        <span className="text-[14px] tracking-[-0.02em] text-ink-black tabular-nums">
          from {formatPeso(offer.priceFrom)}
        </span>
      </div>

      {offer.description ? (
        <p className="text-[13px] leading-[1.45] text-stone-600">
          {offer.description}
        </p>
      ) : null}

      {sent ? (
        <Badge tone="verified">
          <Send size={10} strokeWidth={1.5} />
          You responded
        </Badge>
      ) : composing ? (
        <div className="flex flex-col gap-2">
          <label className="label" htmlFor={`msg-${offer.id}`}>
            What do you need done?
          </label>
          <textarea
            id={`msg-${offer.id}`}
            className="field min-h-[70px] resize-y"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the job, your barangay, and when you need it."
          />
          <div className="flex items-center gap-2">
            <ActionButton
              variant="neutral"
              busy={busy}
              disabled={message.trim().length < 5}
              onClick={safeAsync(async () => {
                await onRespond(offer, message);
                setComposing(false);
                setMessage("");
              }, "respond-offer")}
            >
              Send response
            </ActionButton>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setComposing(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Neutral, not primary: this page already spends its one blue element on
   "Send request", and a worker with four offers would otherwise put four
   more blue buttons on the screen. */
        <div className="flex items-center gap-2">
          {signedIn ? (
            <ActionButton
              variant="neutral"
              onClick={() => setComposing(true)}
              icon={<Send size={13} strokeWidth={1.5} />}
            >
              I&apos;m interested
            </ActionButton>
          ) : (
            <Link href="/login" className="btn-neutral no-underline">
              Sign in to respond
            </Link>
          )}
        </div>
      )}
    </li>
  );
}