"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Skeleton,
  StarRating,
} from "@/components/ui";
import { BARANGAYS, CATEGORIES, CATEGORY_MAP } from "@/lib/constants";
import { listDirectoryWorkers } from "@/lib/data";
import { formatPeso } from "@/lib/commission";
import { normalize } from "@/lib/utils";
import type { Worker } from "@/lib/types";

/**
 * `useSearchParams` opts the tree into client-side rendering, so it needs a
 * Suspense boundary or the static prerender of /browse fails.
 */
export default function BrowsePage() {
  return (
    <Suspense fallback={<BrowseSkeleton />}>
      <BrowseInner />
    </Suspense>
  );
}

function BrowseSkeleton() {
  return (
    <section className="container-page py-12">
      <div className="h-3 w-24 animate-pulse rounded bg-stone-200/70" />
      <div className="mt-3 h-8 w-80 max-w-full animate-pulse rounded bg-stone-200/70" />
      <div className="mt-4 h-4 w-[52ch] max-w-full animate-pulse rounded bg-stone-200/70" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="h-96 animate-pulse rounded-xl border border-stone-200 bg-white" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-xl border border-stone-200 bg-white"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function BrowseInner() {
  const params = useSearchParams();
  const categoryParam = params.get("category") ?? "";

  const [workers, setWorkers] = useState<Worker[] | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(categoryParam);
  const [barangay, setBarangay] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [tesdaOnly, setTesdaOnly] = useState(false);

  useEffect(() => {
    setCategory(categoryParam);
  }, [categoryParam]);

  useEffect(() => {
    let cancelled = false;
    listDirectoryWorkers()
      .then((rows) => {
        if (!cancelled) setWorkers(rows);
      })
      .catch(() => {
        if (!cancelled) setWorkers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!workers) return [];
    const q = normalize(query);

    return workers.filter((worker) => {
      if (category && worker.categoryId !== category) return false;
      if (barangay && worker.barangay !== barangay) return false;
      if (minRating && worker.rating < minRating) return false;
      if (verifiedOnly && !worker.verified) return false;
      if (tesdaOnly && !worker.tesdaCertified) return false;
      if (!q) return true;

      // Match on name, trade title, barangay, and bio so the fallback
      // search still lands on the right person.
      return normalize(
        [
          worker.fullName,
          CATEGORY_MAP[worker.categoryId]?.name ?? "",
          worker.barangay,
          worker.bio,
        ].join(" "),
      ).includes(q);
    });
  }, [workers, query, category, barangay, minRating, verifiedOnly, tesdaOnly]);

  const clearAll = useCallback(() => {
    setQuery("");
    setCategory("");
    setBarangay("");
    setMinRating(0);
    setVerifiedOnly(false);
    setTesdaOnly(false);
  }, []);

  const activeFilters =
    (category ? 1 : 0) +
    (barangay ? 1 : 0) +
    (minRating ? 1 : 0) +
    (verifiedOnly ? 1 : 0) +
    (tesdaOnly ? 1 : 0);

  return (
    <section className="container-page py-12">
      <header className="max-w-[70ch]">
        <p className="font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] text-stone-500">
          Directory
        </p>
        <h1 className="mt-2 text-[28px] leading-[1.2] font-medium tracking-[-0.02em] text-ink-black">
          Browse verified workers
        </h1>
        <p className="mt-3 text-[16px] leading-[1.4] text-stone-600">
          Every profile below has cleared a background check. Filter by trade,
          barangay, and rating. Contact details unlock only once a request is
          formally accepted.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
        {/* Filters */}
        <Card className="flex flex-col gap-5 p-5 lg:sticky lg:top-20">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[14px] font-medium tracking-[-0.02em] text-ink-black">
              <SlidersHorizontal size={14} strokeWidth={1.5} />
              Filters
            </h2>
            {activeFilters > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-[12px] tracking-[-0.02em] text-stone-600 underline underline-offset-2 hover:text-ink-black"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div>
            <label className="label" htmlFor="search">
              Search
            </label>
            <div className="relative">
              <Search
                size={14}
                strokeWidth={1.5}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-400"
              />
              <input
                id="search"
                type="search"
                className="field pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, trade, or keyword"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="category">
              Service category
            </label>
            <select
              id="category"
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All ten trades</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="barangay">
              Barangay
            </label>
            <select
              id="barangay"
              className="field"
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
            >
              <option value="">All barangays</option>
              {BARANGAYS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="label">Minimum rating</legend>
            <div className="flex flex-wrap gap-1.5">
              {[0, 4, 4.5, 4.8].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMinRating(value)}
                  aria-pressed={minRating === value}
                  className={
                    minRating === value
                      ? "rounded-md border border-ink-black bg-white px-2.5 py-1.5 text-[12px] tracking-[-0.02em] text-ink-black"
                      : "rounded-md border border-stone-200 bg-bone px-2.5 py-1.5 text-[12px] tracking-[-0.02em] text-stone-600 transition-colors hover:border-stone-400"
                  }
                >
                  {value === 0 ? "Any" : `${value}+`}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="label">Credentials</legend>
            {[
              { id: "verified", label: "Background checked", value: verifiedOnly, set: setVerifiedOnly },
              { id: "tesda", label: "TESDA certified", value: tesdaOnly, set: setTesdaOnly },
            ].map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 text-[13px] text-stone-700"
              >
                <input
                  type="checkbox"
                  checked={option.value}
                  onChange={(e) => option.set(e.target.checked)}
                  className="h-3.5 w-3.5 accent-ink-black"
                />
                {option.label}
              </label>
            ))}
          </fieldset>
        </Card>

        {/* Results */}
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="meta">
              {workers === null
                ? "Loading workers"
                : `${filtered.length} of ${workers.length} workers`}
            </p>
            {query || activeFilters > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1 text-[12px] tracking-[-0.02em] text-stone-600 hover:text-ink-black"
              >
                <X size={12} strokeWidth={1.5} />
                Reset
              </button>
            ) : null}
          </div>

          {workers === null ? (
            <WorkerSkeletons />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={workers.length === 0 ? "No workers listed yet" : "No matches"}
              description={
                workers.length === 0
                  ? "The directory is empty. Run the seed script to load demo workers, or wait for the first registration to clear verification."
                  : "Try widening your filters — clearing the barangay or rating constraint usually helps."
              }
              action={
                workers.length === 0
                  ? { label: "Join as a worker", href: "/signup?role=worker" }
                  : undefined
              }
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filtered.map((worker) => (
                <WorkerCard key={worker.id} worker={worker} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function WorkerCard({ worker }: { worker: Worker }) {
  const trade = CATEGORY_MAP[worker.categoryId];

  return (
    <li>
      <Link
        href={`/worker/${worker.id}`}
        className="card flex h-full flex-col gap-3 p-5 no-underline transition-colors hover:bg-bone"
      >
        <div className="flex items-start gap-3">
          <Avatar name={worker.fullName} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
                {worker.fullName}
              </h2>
              {worker.verified ? (
                <Badge tone="verified" className="shrink-0">
                  Verified
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[13px] text-stone-600">
              {trade?.name ?? "General"}
            </p>
          </div>
        </div>

        <StarRating value={worker.rating} count={worker.reviewCount} />

        <dl className="grid grid-cols-2 gap-2 border-t border-stone-200 pt-3">
          <div>
            <dt className="caption">Barangay</dt>
            <dd className="text-[13px] text-stone-700">{worker.barangay}</dd>
          </div>
          <div>
            <dt className="caption">Experience</dt>
            <dd className="text-[13px] text-stone-700 tabular-nums">
              {worker.yearsExperience} yrs
            </dd>
          </div>
          <div>
            <dt className="caption">From</dt>
            <dd className="text-[13px] text-stone-700 tabular-nums">
              {formatPeso(worker.hourlyRate)}/hr
            </dd>
          </div>
          <div>
            <dt className="caption">Jobs done</dt>
            <dd className="text-[13px] text-stone-700 tabular-nums">
              {worker.jobsCompleted}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {worker.tesdaCertified ? (
            <Badge tone="neutral">TESDA Certified</Badge>
          ) : null}
          {worker.walletBalance < 0 ? (
            <Badge tone="muted">Wallet paused</Badge>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function WorkerSkeletons() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="card flex flex-col gap-3 p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-14 w-full" />
        </li>
      ))}
    </ul>
  );
}