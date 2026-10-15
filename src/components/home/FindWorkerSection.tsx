"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { EmptyState, SectionHeader, Skeleton } from "@/components/ui";
import { WorkerCard } from "@/components/WorkerCard";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/constants";
import { listDirectoryWorkers } from "@/lib/data";
import { normalize } from "@/lib/utils";
import type { Worker } from "@/lib/types";

/**
 * "Find a worker" on the home page.
 *
 * A deliberately short version of the directory: search, and the ten trades as
 * chips. The full filter rail — barangay, minimum rating, background check,
 * TESDA — stays on /browse, and there is a link through for anyone who wants
 * it. Duplicating all of it here would give the home page two filtering
 * systems that drift apart.
 *
 * Shows the first six matches, which is enough to judge the marketplace is
 * real and to open the one that fits. The rest are one click away.
 */
export function FindWorkerSection({ limit = 6 }: { limit?: number }) {
  const [workers, setWorkers] = useState<Worker[] | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listDirectoryWorkers()
      .then((rows) => {
        if (!cancelled) {
          setWorkers(rows);
          setError("");
        }
      })
      .catch((err) => {
        console.error("[home] directory read failed:", err);
        if (cancelled) return;
        setWorkers([]);
        setError(
          "The worker directory is not readable with the current Firestore rules.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!workers) return [];
    const q = normalize(query);
    return workers
      .filter((worker) => {
        if (category && worker.categoryId !== category) return false;
        if (!q) return true;
        return normalize(
          [
            worker.fullName,
            CATEGORY_MAP[worker.categoryId]?.name ?? "",
            worker.barangay,
            worker.bio,
          ].join(" "),
        ).includes(q);
      })
      // Verified first: the directory's whole claim is that these people have
      // been checked, so an unverified entry should not outrank a checked one.
      .sort((a, b) => Number(b.verified) - Number(a.verified));
  }, [workers, query, category]);

  const shown = filtered.slice(0, limit);
  const remaining = filtered.length - shown.length;

  return (
    <section id="find-a-worker" className="container-page scroll-mt-20 pb-20 pt-8 sm:pt-10">
      <SectionHeader
        eyebrow="Find a worker"
        title="Verified trades, ready to book"
        description="Every profile here has cleared a background check. Contact details stay masked until a request is formally accepted."
        action={
          // The one blue element on the home page. The directory cards below
          // are the real way in, but this is the single action that carries
          // forward, so it takes the accent.
          <Link href="/browse" className="btn-primary no-underline">
            <SlidersHorizontal size={13} strokeWidth={1.5} />
            All filters
          </Link>
        }
      />

      {/* Search + trades */}
      <div className="mt-8 flex flex-col gap-4">
        <div className="max-w-md">
          <label className="label" htmlFor="home-search">
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
              id="home-search"
              type="search"
              className="field pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, service, or keyword"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory("")}
            aria-pressed={!category}
            className={
              !category
                ? "rounded-md border border-ink-black bg-white px-3 py-1.5 text-[12px] tracking-[-0.02em] text-ink-black"
                : "rounded-md border border-stone-200 bg-bone px-3 py-1.5 text-[12px] tracking-[-0.02em] text-stone-600 transition-colors hover:border-stone-400"
            }
          >
            All ten trades
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(category === c.id ? "" : c.id)}
              aria-pressed={category === c.id}
              className={
                category === c.id
                  ? "rounded-md border border-ink-black bg-white px-3 py-1.5 text-[12px] tracking-[-0.02em] text-ink-black"
                  : "rounded-md border border-stone-200 bg-bone px-3 py-1.5 text-[12px] tracking-[-0.02em] text-stone-600 transition-colors hover:border-stone-400"
              }
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {workers === null ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="card flex flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-14 w-full" />
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={error ? "Directory not readable" : "No matches"}
            description={
              error
                ? "This usually means the Firestore rules for this project have not been deployed. Publish firestore.rules from the Firebase console, then reload."
                : workers.length === 0
                  ? "The directory is empty. Run the seed script to load demo workers, or wait for the first registration to clear verification."
                  : "Try a different trade, or clear the search box."
            }
          />
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((worker) => (
                <WorkerCard key={worker.id} worker={worker} />
              ))}
            </ul>

            {remaining > 0 ? (
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-stone-200 pt-5">
                <p className="meta">
                  {remaining} more{" "}
                  {remaining === 1 ? "worker matches" : "workers match"} these
                  filters.
                </p>
                <Link
                  href={category ? `/browse?category=${category}` : "/browse"}
                  className="text-[13px] tracking-[-0.02em] text-ink-black underline underline-offset-2"
                >
                  See all of them
                </Link>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
