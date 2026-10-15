"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Megaphone,
  MessageSquare,
  Plus,
  Users,
} from "lucide-react";
import { ActionButton } from "@/components/JobCard";
import {
  Badge,
  Card,
  EmptyState,
  Notice,
  SectionHeader,
  Skeleton,
  safeAsync,
} from "@/components/ui";
import { BARANGAYS, CATEGORIES, CATEGORY_MAP } from "@/lib/constants";
import { formatPeso } from "@/lib/commission";
import {
  createOffer,
  listInquiriesForWorker,
  listOffersForWorker,
  setOfferStatus,
} from "@/lib/data";
import { formatDate } from "@/lib/utils";
import type { Inquiry, ServiceOffer, Worker } from "@/lib/types";

/**
 * "My Services" — the work a worker has put on offer.
 *
 * Distinct from "My jobs". A job is a household asking this worker for
 * something specific; an offer is the worker saying what work they take on and
 * at what price, which households then respond to. A worker needs both
 * surfaces, because most of the work that finds them does not come from the
 * job queue at all.
 *
 * The inquiry count is derived, not stored: see listInquiriesForWorker for why
 * a counter on the offer document is not an option here.
 */
export function MyServices({ worker }: { worker: Worker }) {
  const [offers, setOffers] = useState<ServiceOffer[] | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [composing, setComposing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [rows, inqs] = await Promise.all([
      listOffersForWorker(worker.uid),
      listInquiriesForWorker(worker.uid),
    ]);
    setOffers(rows);
    setInquiries(inqs);
  }, [worker.uid]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rows, inqs] = await Promise.all([
          listOffersForWorker(worker.uid),
          listInquiriesForWorker(worker.uid),
        ]);
        if (cancelled) return;
        setOffers(rows);
        setInquiries(inqs);
      } catch (err) {
        console.error("[my-services] load failed:", err);
        if (cancelled) return;
        setOffers([]);
        setError(
          "Could not load your offers. If this says permissions, the deployed Firestore rules predate this feature — see the README.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [worker.uid]);

  // Grouped once rather than per card: a worker with six offers should cost
  // one pass over the inquiry list, not six.
  const byOffer = useMemo(() => {
    const map = new Map<string, Inquiry[]>();
    for (const inquiry of inquiries) {
      const list = map.get(inquiry.offerId);
      if (list) list.push(inquiry);
      else map.set(inquiry.offerId, [inquiry]);
    }
    return map;
  }, [inquiries]);

  const totalInquiries = inquiries.length;
  const recentInquiries = [...inquiries]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  return (
    <section id="my-services" className="container-page scroll-mt-20 pb-20 pt-8">
      <SectionHeader
        eyebrow="My services"
        title="Work you have on offer"
        description="Post what you take on and the price you start from. Households browse these directly and contact you — you do not wait to be assigned."
        action={
          <ActionButton
            variant={composing ? "neutral" : "primary"}
            onClick={() => setComposing((v) => !v)}
            icon={
              composing ? (
                <EyeOff size={13} strokeWidth={1.5} />
              ) : (
                <Plus size={13} strokeWidth={1.5} />
              )
            }
          >
            {composing ? "Close the form" : "Post an offer"}
          </ActionButton>
        }
      />

      {error ? (
        <Notice tone="alert" className="mt-6">
          {error}
        </Notice>
      ) : null}

      <div id="inquiries" className="mt-8 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label">Recent inquiries</p>
            <h3 className="mt-1 text-[20px] font-medium tracking-[-0.03em] text-ink-black">
              Who asked about your services
            </h3>
          </div>
          {offers !== null ? <p className="meta">{totalInquiries} total</p> : null}
        </div>
        {offers === null ? (
          <Skeleton className="mt-4 h-24 w-full" />
        ) : recentInquiries.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {recentInquiries.map((inquiry) => {
              const offer = offers.find((item) => item.id === inquiry.offerId);
              return (
                <Card key={inquiry.id} className="p-5">
                  <p className="text-[15px] font-medium text-ink-black">{inquiry.consumerName}</p>
                  <p className="caption mt-1">{formatDate(inquiry.createdAt)} · {offer?.title ?? "Your service"}</p>
                  <p className="mt-3 text-[13px] leading-[1.5] text-stone-700">
                    {inquiry.message || "Interested in your service."}
                  </p>
                  {offer ? (
                    <a href={`#offer-${offer.id}`} className="mt-3 inline-block text-[13px] text-ink-black underline underline-offset-2">
                      View service and all inquiries
                    </a>
                  ) : null}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="mt-4 p-5">
            <p className="text-[14px] text-ink-black">No inquiries yet.</p>
            <p className="caption mt-1">When someone asks about an offer, their name and message will appear here.</p>
          </Card>
        )}
      </div>

      {composing ? (
        <div className="mt-6">
          <OfferForm
            worker={worker}
            onDone={async () => {
              setComposing(false);
              await load();
            }}
          />
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {offers === null ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="flex flex-col gap-3 p-5">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ))
        ) : offers.length === 0 ? (
          // No action here: "Post an offer" sits in the section header directly
          // above, and a second button would duplicate it and put a second
          // blue element on the page.
          <EmptyState
            icon={<Megaphone size={22} strokeWidth={1.25} />}
            title="No offers posted"
            description="Job requests only reach you when a household picks you from the directory. Posting an offer puts you in front of people browsing for a trade instead of waiting to be selected."
          />
        ) : (
          <>
            <p className="meta">
              {offers.length} {offers.length === 1 ? "offer" : "offers"} ·{" "}
              {totalInquiries} {totalInquiries === 1 ? "inquiry" : "inquiries"} in
              total
            </p>
            {offers.map((offer) => {
              const hits = byOffer.get(offer.id) ?? [];
              const open = expanded === offer.id;

              return (
                <Card key={offer.id} id={`offer-${offer.id}`} className="flex flex-col gap-4 p-5 scroll-mt-24">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
                          {offer.title}
                        </h3>
                        <Badge tone={offer.status === "open" ? "verified" : "muted"}>
                          {offer.status === "open" ? "Open" : "Closed"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[13px] text-stone-600">
                        {CATEGORY_MAP[offer.categoryId]?.name ?? "General"} ·{" "}
                        {offer.barangay}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="flex items-center gap-1.5 text-[13px] text-stone-700 tabular-nums"
                        title={`${hits.length} households have responded`}
                      >
                        <Users size={13} strokeWidth={1.5} className="text-stone-400" />
                        {hits.length}
                        <span className="text-stone-500">
                          {hits.length === 1 ? "inquiry" : "inquiries"}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={safeAsync(async () => {
                          await setOfferStatus(
                            offer.id,
                            offer.status === "open" ? "closed" : "open",
                          );
                          await load();
                        }, "toggle-offer-status")}
                      >
                        {offer.status === "open" ? (
                          <>
                            <EyeOff size={13} strokeWidth={1.5} />
                            Close
                          </>
                        ) : (
                          <>
                            <Eye size={13} strokeWidth={1.5} />
                            Reopen
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {offer.description ? (
                    <p className="text-[13px] leading-[1.5] text-stone-600">
                      {offer.description}
                    </p>
                  ) : null}

                  <dl className="grid grid-cols-3 gap-3 border-t border-stone-200 pt-3">
                    <div>
                      <dt className="caption">From</dt>
                      <dd className="text-[13px] text-stone-700 tabular-nums">
                        {formatPeso(offer.priceFrom)}
                      </dd>
                    </div>
                    <div>
                      <dt className="caption">Posted</dt>
                      <dd className="text-[13px] text-stone-700">
                        {formatDate(offer.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="caption">Status</dt>
                      <dd className="text-[13px] text-stone-700">
                        {offer.status === "open" ? "Visible to households" : "Hidden"}
                      </dd>
                    </div>
                  </dl>

                  {hits.length ? (
                    <div className="border-t border-stone-200 pt-3">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        aria-expanded={open}
                        onClick={() => setExpanded(open ? null : offer.id)}
                      >
                        <MessageSquare size={13} strokeWidth={1.5} />
                        {open ? "Hide responses" : "View responses"}
                      </button>

                      {open ? (
                        <ul className="mt-3 flex flex-col gap-2">
                          {hits.map((inquiry) => (
                            <li
                              key={inquiry.id}
                              className="rounded-md border border-stone-200 bg-bone p-3"
                            >
                              <p className="text-[13px] font-medium tracking-[-0.02em] text-ink-black">
                                {inquiry.consumerName}
                              </p>
                              <p className="caption mt-0.5">
                                {formatDate(inquiry.createdAt)}
                              </p>
                              {inquiry.message ? (
                                <p className="mt-2 text-[13px] leading-[1.5] text-stone-700">
                                  {inquiry.message}
                                </p>
                              ) : (
                                <p className="caption mt-2">
                                  Sent without a message.
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : (
                    <p className="border-t border-stone-200 pt-3 text-[12px] leading-[1.4] text-stone-500">
                      No responses yet. Offers with a price and a scope of work
                      tend to get contacted far more often than a bare listing.
                    </p>
                  )}
                </Card>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function OfferForm({
  worker,
  onDone,
}: {
  worker: Worker;
  onDone: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(worker.categoryId);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(String(worker.hourlyRate || ""));
  const [barangay, setBarangay] = useState(worker.barangay || BARANGAYS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const priceNum = Number(price) || 0;
  const valid = title.trim().length >= 3 && priceNum > 0;

  async function run() {
    setBusy(true);
    setError("");
    try {
      await createOffer(worker, {
        title: title.trim(),
        categoryId,
        description: description.trim(),
        priceFrom: priceNum,
        barangay,
      });
      await onDone();
    } catch (err) {
      console.error("[my-services] create failed:", err);
      setError(
        "Could not post the offer. If this mentions permissions, the deployed Firestore rules predate this feature — see the README.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
          Post an offer
        </h3>
        <p className="caption mt-0.5">
          Visible to every signed-in household browsing that trade. Set a
          starting price rather than a fixed one — you confirm the scope when
          they respond.
        </p>
      </div>

      {error ? <Notice tone="alert">{error}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="of-title">
            What you offer
          </label>
          <input
            id="of-title"
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Kitchen cabinet fabrication and refitting"
          />
        </div>
        <div>
          <label className="label" htmlFor="of-cat">
            Trade
          </label>
          <select
            id="of-cat"
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
        <div>
          <label className="label" htmlFor="of-price">
            Starting price (PHP)
          </label>
          <input
            id="of-price"
            className="field"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="1200"
          />
        </div>
        <div>
          <label className="label" htmlFor="of-brgy">
            Area you cover
          </label>
          <select
            id="of-brgy"
            className="field"
            value={barangay}
            onChange={(e) => setBarangay(e.target.value)}
          >
            {BARANGAYS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="of-desc">
          Scope of work
        </label>
        <textarea
          id="of-desc"
          className="field min-h-[80px] resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is included, what costs extra, and roughly how long it takes."
        />
      </div>

      <ActionButton onClick={run} busy={busy} disabled={!valid}>
        Post offer
      </ActionButton>
    </Card>
  );
}
