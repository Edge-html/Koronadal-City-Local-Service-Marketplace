"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, BriefcaseBusiness, MapPin, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Avatar, Badge, Card, EmptyState, Skeleton, StarRating } from "@/components/ui";
import { MessageWorkerButton } from "@/components/MessageWorkerButton";
import { BARANGAYS } from "@/lib/constants";
import { firebaseConfigured } from "@/lib/firebase";
import { FirebaseSetupNotice } from "@/components/FirebaseSetupNotice";
import { listDirectoryWorkers } from "@/lib/data";
import { formatPeso } from "@/lib/commission";
import { normalize } from "@/lib/utils";
import { useServiceCategories } from "@/hooks/useServiceCategories";
import type { Worker } from "@/lib/types";

type SortMode = "featured" | "rating" | "completed";

/**
 * Service-provider directory, arranged like a familiar job-board feed:
 * search and filters at the top, selectable results on the left, and a
 * persistent profile preview on the right.
 */
export default function BrowsePage() {
  return <Suspense fallback={<BrowseSkeleton />}><BrowseInner /></Suspense>;
}

function BrowseSkeleton() {
  return <section className="container-page py-8 sm:py-10">
    <div className="mx-auto max-w-4xl">
      <Skeleton className="h-8 w-72 max-w-full" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <Skeleton className="mt-6 h-16 w-full rounded-xl" />
    </div>
    <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(320px,390px)_minmax(0,1fr)]">
      <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}</div>
      <Skeleton className="hidden h-[560px] w-full rounded-xl lg:block" />
    </div>
  </section>;
}

function BrowseInner() {
  const categories = useServiceCategories();
  const params = useSearchParams();
  const categoryParam = params.get("category") ?? "";
  const [workers, setWorkers] = useState<Worker[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(categoryParam);
  const [barangay, setBarangay] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [tesdaOnly, setTesdaOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>("featured");
  const [selectedId, setSelectedId] = useState("");
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  useEffect(() => setCategory(categoryParam), [categoryParam]);

  useEffect(() => {
    if (!firebaseConfigured) {
      setWorkers([]);
      return;
    }
    let cancelled = false;
    listDirectoryWorkers()
      .then((rows) => {
        if (!cancelled) {
          setWorkers(rows);
          setLoadError("");
          setSelectedId((current) => current || rows[0]?.id || "");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[browse] directory read failed:", err);
        setWorkers([]);
        setLoadError(/permission|insufficient/i.test(String(err?.message ?? ""))
          ? "The worker directory is not readable with the current Firestore rules."
          : "Could not load the worker directory.");
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!workers) return [];
    const q = normalize(query);
    const rows = workers.filter((worker) => {
      const services = worker.serviceIds ?? [worker.categoryId];
      if (category && !services.includes(category)) return false;
      if (barangay && worker.barangay !== barangay && !(worker.serviceAreas ?? []).includes(barangay)) return false;
      if (Number(minRating) && worker.rating < Number(minRating)) return false;
      if (verifiedOnly && !worker.verified) return false;
      if (tesdaOnly && !worker.tesdaCertified) return false;
      if (!q) return true;
      return normalize([
        worker.fullName,
        ...services.map((id) => categories.find((item) => item.id === id)?.name ?? id),
        worker.barangay,
        ...(worker.serviceAreas ?? []),
        worker.bio,
        worker.specialtyDescription ?? "",
      ].join(" ")).includes(q);
    });

    return rows.sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating || b.reviewCount - a.reviewCount;
      if (sort === "completed") return b.jobsCompleted - a.jobsCompleted || b.rating - a.rating;
      return Number(Boolean(b.isPro)) - Number(Boolean(a.isPro)) || b.rating - a.rating || b.jobsCompleted - a.jobsCompleted;
    });
  }, [workers, query, category, barangay, minRating, verifiedOnly, tesdaOnly, categories, sort]);

  const selected = filtered.find((worker) => worker.id === selectedId) ?? filtered[0] ?? null;
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    if (!mobilePreviewOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobilePreviewOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobilePreviewOpen]);

  function clearFilters() {
    setQuery("");
    setCategory("");
    setBarangay("");
    setMinRating("0");
    setVerifiedOnly(false);
    setTesdaOnly(false);
  }

  const activeFilters = (category ? 1 : 0) + (barangay ? 1 : 0) + (Number(minRating) ? 1 : 0) + Number(verifiedOnly) + Number(tesdaOnly);

  return <section className="container-page py-8 sm:py-10">
    {!firebaseConfigured ? <FirebaseSetupNotice className="mt-8" /> : <>
      <header className="relative isolate mx-auto max-w-4xl overflow-hidden rounded-2xl px-3 py-5 text-center sm:px-6 sm:py-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(248,250,252,.12) 0%, rgba(248,250,252,.34) 52%, #f8fafc 100%), linear-gradient(90deg, rgba(248,250,252,.86), rgba(248,250,252,.62)), url('/images/service-sign.webp')",
            backgroundRepeat: "no-repeat",
            backgroundSize: "100% 100%, 100% 100%, cover",
            backgroundPosition: "center, center, center 42%",
          }}
        />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Koronadal City services</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.04em] text-ink-black sm:text-[36px]">Find the right local service provider</h1>
        <p className="mx-auto mt-2 max-w-[64ch] text-[15px] leading-relaxed text-stone-600">Search verified workers, compare service rates, and browse their service offers before you get in touch.</p>

        <form onSubmit={(event) => event.preventDefault()} className="mt-6 grid overflow-hidden rounded-xl border border-stone-300 bg-white p-2 shadow-sm md:grid-cols-[minmax(0,1fr)_250px_auto]">
          <label className="flex min-h-12 items-center gap-3 px-3 text-left">
            <Search size={19} className="shrink-0 text-stone-500" aria-hidden />
            <span className="sr-only">Service or worker</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Service, skill, or worker name" className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400" />
          </label>
          <label className="flex min-h-12 items-center gap-3 border-t border-stone-200 px-3 text-left md:border-l md:border-t-0">
            <MapPin size={18} className="shrink-0 text-stone-500" aria-hidden />
            <span className="sr-only">Barangay</span>
            <select value={barangay} onChange={(event) => setBarangay(event.target.value)} className="w-full bg-transparent text-sm text-stone-700 outline-none">
              <option value="">All barangays</option>
              {BARANGAYS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-primary min-h-12 rounded-lg px-6"><Search size={15} />Find workers</button>
        </form>

        <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-left text-[13px] text-blue-950">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-700 text-xs font-bold text-white" aria-hidden>i</span>
          <p>Compare worker profiles and service offers. Agree on the work and final price together in private chat.</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <label className="sr-only" htmlFor="feed-service">Service</label>
          <select id="feed-service" value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-10 rounded-full border border-stone-300 bg-white px-4 text-[13px] text-stone-700 outline-none focus:border-blue-600">
            <option value="">All services</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <label className="sr-only" htmlFor="feed-rating">Minimum rating</label>
          <select id="feed-rating" value={minRating} onChange={(event) => setMinRating(event.target.value)} className="min-h-10 rounded-full border border-stone-300 bg-white px-4 text-[13px] text-stone-700 outline-none focus:border-blue-600">
            <option value="0">Any rating</option><option value="4">4.0+ stars</option><option value="4.5">4.5+ stars</option>
          </select>
          <button type="button" aria-pressed={verifiedOnly} onClick={() => setVerifiedOnly((value) => !value)} className={`min-h-10 rounded-full border px-4 text-[13px] transition-colors ${verifiedOnly ? "border-blue-700 bg-blue-50 text-blue-900" : "border-stone-300 bg-white text-stone-700 hover:border-blue-400"}`}><BadgeCheck size={14} className="mr-1 inline" />Verified</button>
          <button type="button" aria-pressed={tesdaOnly} onClick={() => setTesdaOnly((value) => !value)} className={`min-h-10 rounded-full border px-4 text-[13px] transition-colors ${tesdaOnly ? "border-blue-700 bg-blue-50 text-blue-900" : "border-stone-300 bg-white text-stone-700 hover:border-blue-400"}`}>TESDA certified</button>
          {activeFilters > 0 ? <button type="button" onClick={clearFilters} className="min-h-10 px-2 text-[13px] font-medium text-blue-700 hover:text-blue-900"><SlidersHorizontal size={13} className="mr-1 inline" />Clear filters</button> : null}
        </div>
      </header>

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(320px,390px)_minmax(0,1fr)]">
        <section aria-label="Worker results">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div><h2 className="text-[16px] font-semibold text-ink-black">Service providers</h2><p className="meta mt-1">{workers === null ? "Loading results…" : `${filtered.length} of ${workers.length} workers`}</p></div>
            <label className="flex items-center gap-2 text-xs text-stone-600"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="rounded-md border border-stone-300 bg-white px-2 py-2 text-xs text-stone-800 outline-none focus:border-blue-600"><option value="featured">Featured</option><option value="rating">Top rated</option><option value="completed">Most jobs</option></select></label>
          </div>

          {workers === null ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
            : filtered.length === 0 ? <Card className="p-6"><EmptyState title={loadError ? "Directory not readable" : workers.length === 0 ? "No workers listed yet" : "No matches"} description={loadError ? "The directory may need the updated Firestore rules. Check the Firebase project rules and reload." : workers.length === 0 ? "The directory is empty. Workers will appear after their applications are approved." : "Try a broader search or clear one of the filters."} action={workers.length === 0 && !loadError ? { label: "Join as a worker", href: "/signup?role=worker" } : undefined} /></Card>
              : <ul className="space-y-3">{filtered.map((worker) => <li key={worker.id} className={`overflow-hidden rounded-xl border bg-white shadow-sm transition hover:border-blue-400 hover:shadow-md ${selected?.id === worker.id ? "border-blue-600 ring-1 ring-blue-600/20" : "border-stone-200"}`}>
                <button type="button" onClick={() => { setSelectedId(worker.id); setMobilePreviewOpen(true); }} aria-pressed={selected?.id === worker.id} className="w-full p-4 text-left">
                  <div className="flex items-start gap-3">
                    <Avatar name={worker.fullName} size={48} photoUrl={worker.photoUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5"><h3 className="font-semibold text-ink-black">{worker.fullName}</h3>{worker.verified ? <Badge tone="verified">Verified</Badge> : null}{worker.isPro ? <Badge className="bg-blue-100 text-blue-900">Pro</Badge> : null}</div>
                      <p className="mt-1 line-clamp-1 text-[13px] font-medium text-stone-700">{serviceNames(worker, categories).join(" · ") || "Local service provider"}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-stone-500"><MapPin size={12} />{worker.barangay}{worker.serviceAreas?.length ? ` + ${worker.serviceAreas.length} areas` : ""}</p>
                    </div>
                    <span className="shrink-0 text-right"><span className="block text-[10px] text-stone-500">Starting rate</span><span className="font-semibold text-ink-black">{formatPeso(worker.serviceRate)}</span></span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
                    <StarRating value={worker.rating} count={worker.reviewCount} />
                    <span className="inline-flex items-center gap-1 text-xs text-stone-500"><BriefcaseBusiness size={13} />{worker.jobsCompleted} jobs completed</span>
                  </div>
                  {worker.bio && worker.profileVisibility?.bio !== false ? <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-stone-600">{worker.bio}</p> : null}
                </button>
                <div className="px-4 pb-4">
                  <MessageWorkerButton worker={worker} />
                </div>
              </li>)}</ul>}
        </section>

        <div className="hidden lg:block lg:sticky lg:top-20">
          {selected ? <WorkerPreview worker={selected} categories={categories} /> : <Card className="grid min-h-[480px] place-items-center p-8 text-center"><div><Sparkles className="mx-auto text-blue-700" /><h2 className="mt-3 font-semibold text-ink-black">Choose a worker to preview</h2><p className="mt-1 max-w-sm text-sm text-stone-600">Select someone from the results to see their services, experience, and profile link.</p></div></Card>}
        </div>
      </div>
      {selected && mobilePreviewOpen ? <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-2 lg:hidden" onClick={() => setMobilePreviewOpen(false)}>
        <section role="dialog" aria-modal="true" aria-label={`${selected.fullName}'s worker details`} onClick={(event) => event.stopPropagation()} className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex justify-end border-b border-stone-100 bg-white/95 px-3 py-2 backdrop-blur">
            <button type="button" onClick={() => setMobilePreviewOpen(false)} className="btn-neutral min-h-9 px-3" aria-label="Close worker details"><X size={15} />Close</button>
          </div>
          <WorkerPreview worker={selected} categories={categories} />
        </section>
      </div> : null}
    </>}
  </section>;
}

function serviceNames(worker: Worker, categories: ReturnType<typeof useServiceCategories>) {
  return (worker.serviceIds ?? [worker.categoryId]).map((id) => categories.find((item) => item.id === id)?.name ?? id).filter(Boolean);
}

function WorkerPreview({ worker, categories }: { worker: Worker; categories: ReturnType<typeof useServiceCategories> }) {
  const names = serviceNames(worker, categories);
  const areas = [worker.barangay, ...(worker.serviceAreas ?? [])].filter((area, index, all) => area && all.indexOf(area) === index);
  return <Card className="overflow-hidden border-stone-200 bg-white shadow-sm">
    <div className="border-b border-stone-200 bg-gradient-to-r from-blue-50 to-white p-6 sm:p-7">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={worker.fullName} size={68} photoUrl={worker.photoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-[22px] font-semibold tracking-[-0.03em] text-ink-black">{worker.fullName}</h2>{worker.verified ? <Badge tone="verified"><BadgeCheck size={11} />Verified</Badge> : null}{worker.isPro ? <Badge className="bg-blue-100 text-blue-900"><Sparkles size={10} />Pro</Badge> : null}</div>
          <p className="mt-1 text-sm text-stone-600">{names.join(" · ") || "Local service provider"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600"><StarRating value={worker.rating} count={worker.reviewCount} />{worker.tesdaCertified ? <span className="font-medium text-blue-800">TESDA certified</span> : null}</div>
        </div>
      </div>
    </div>
    <div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-7">
      <div className="rounded-lg bg-blue-50 p-4"><p className="text-xs text-blue-900">Starting service rate</p><p className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-ink-black">{worker.profileVisibility?.rate === false ? "Discuss in chat" : formatPeso(worker.serviceRate)}</p><p className="mt-1 text-xs leading-relaxed text-stone-600">Final scope and price are agreed directly before work begins.</p></div>
      <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-stone-600">Experience</p><p className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-ink-black">{worker.profileVisibility?.experience === false ? "Ask worker" : `${worker.yearsExperience} years`}</p><p className="mt-1 text-xs leading-relaxed text-stone-600">{worker.jobsCompleted} completed {worker.jobsCompleted === 1 ? "job" : "jobs"} on KoroHanap</p></div>
      <div className="sm:col-span-2"><h3 className="text-sm font-semibold text-ink-black">Services</h3><div className="mt-2 flex flex-wrap gap-2">{names.map((name) => <span key={name} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900">{name}</span>)}</div></div>
      {worker.profileVisibility?.serviceAreas !== false ? <div className="sm:col-span-2"><h3 className="text-sm font-semibold text-ink-black">Areas served</h3><p className="mt-1 flex items-start gap-2 text-sm text-stone-600"><MapPin size={15} className="mt-0.5 shrink-0 text-blue-700" />{areas.join(" · ") || worker.barangay}</p></div> : null}
      {worker.bio && worker.profileVisibility?.bio !== false ? <div className="sm:col-span-2"><h3 className="text-sm font-semibold text-ink-black">About</h3><p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-600">{worker.bio}</p></div> : null}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2"><Link href={`/worker/${worker.id}`} className="btn-primary no-underline">View profile &amp; service offers</Link><span className="text-xs text-stone-500">Contact details stay private until a request is accepted.</span></div>
    </div>
  </Card>;
}
