"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { MessageWorkerButton } from "@/components/MessageWorkerButton";
import { Card, EmptyState, Skeleton } from "@/components/ui";
import { formatPeso } from "@/lib/commission";
import { listDirectoryWorkers, listOpenOffers } from "@/lib/data";
import { normalize } from "@/lib/utils";
import type { ServiceOffer, Worker } from "@/lib/types";
import { useServiceCategories } from "@/hooks/useServiceCategories";

/** A service-first feed. Worker profiles remain in the separate directory. */
export function ServiceOffersSection() {
  const categories = useServiceCategories();
  const [offers, setOffers] = useState<ServiceOffer[] | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listOpenOffers(), listDirectoryWorkers()])
      .then(([offerRows, workerRows]) => {
        if (cancelled) return;
        setOffers(offerRows);
        setWorkers(workerRows);
      })
      .catch((loadError) => {
        console.error("[service-feed] load failed:", loadError);
        if (cancelled) return;
        setOffers([]);
        setError("Could not load service offers. Refresh the page and try again.");
      });
    return () => { cancelled = true; };
  }, []);

  const workersByUid = useMemo(() => new Map(workers.map((worker) => [worker.uid, worker])), [workers]);
  const visibleOffers = useMemo(() => {
    const q = normalize(query);
    return (offers ?? [])
      .filter((offer) => workersByUid.has(offer.workerUid))
      .filter((offer) => categories.some((category) => category.id === offer.categoryId && category.enabled !== false))
      .filter((offer) => !categoryId || offer.categoryId === categoryId)
      .filter((offer) => !q || normalize([
        offer.title,
        offer.description,
        offer.barangay,
        categories.find((category) => category.id === offer.categoryId)?.name ?? "",
        workersByUid.get(offer.workerUid)?.fullName ?? "",
      ].join(" ")).includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [offers, workersByUid, categoryId, query, categories]);

  return (
    <section id="services" className="container-page scroll-mt-20 pb-16 pt-6 sm:pb-20">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-700">Service offers</p>
          <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.035em] text-ink-black">Work local providers are ready to do</h2>
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-stone-600">Browse offers posted by workers. Message the provider directly or open their profile to see all their services.</p>
        </div>
        <Link href="/browse" className="btn-neutral w-fit no-underline">Find a worker</Link>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 focus-within:border-blue-600">
          <Search size={16} className="shrink-0 text-stone-500" aria-hidden />
          <span className="sr-only">Search service offers</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by service, trade, area, or worker" className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400" />
        </label>
        <label>
          <span className="sr-only">Filter offers by service category</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="field min-h-11">
            <option value="">All services</option>
            {categories.filter((category) => category.enabled !== false).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-5">
        {offers === null ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <li key={index}><Skeleton className="h-56 rounded-xl" /></li>)}</ul>
        ) : visibleOffers.length === 0 ? (
          <Card className="p-5"><EmptyState title={error ? "Offers unavailable" : offers.length === 0 ? "No services posted yet" : "No matching offers"} description={error || (offers.length === 0 ? "Verified workers’ service posts will appear here. You can also browse worker profiles." : "Try another service or search term.")} action={{ label: "Find a worker", href: "/browse" }} /></Card>
        ) : (
          <>
            <p className="meta mb-3">{visibleOffers.length} {visibleOffers.length === 1 ? "service offer" : "service offers"}</p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleOffers.map((offer) => {
                const worker = workersByUid.get(offer.workerUid);
                if (!worker) return null;
                const trade = categories.find((category) => category.id === offer.categoryId)?.name ?? "Home service";
                return <li key={offer.id}>
                  <Card className="flex h-full flex-col p-5 transition hover:border-blue-300 hover:shadow-md">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-blue-700">{trade}</p>
                          <h3 className="mt-1 text-lg font-semibold leading-snug text-ink-black">{offer.title}</h3>
                        </div>
                        <span className="shrink-0 rounded-md bg-blue-50 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-blue-900">From {formatPeso(offer.priceFrom)}</span>
                      </div>
                      {offer.description ? <p className="mt-3 text-sm leading-relaxed text-stone-600">{offer.description}</p> : null}
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-stone-500"><MapPin size={13} />{offer.barangay}</p>
                      <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500">Offered by <Link href={`/worker/${worker.id}`} className="font-medium text-stone-800 underline underline-offset-2">{worker.fullName}</Link>{worker.verified ? " · Verified worker" : ""}</p>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      <MessageWorkerButton worker={worker} />
                      <Link href={`/worker/${worker.id}`} className="btn-ghost w-full no-underline">View profile &amp; service offers</Link>
                    </div>
                  </Card>
                </li>;
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
