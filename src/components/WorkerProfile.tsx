"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  GraduationCap,
  Loader2,
  Lock,
  MapPin,
  Send,
  ShieldCheck,
  Star,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  LoadingBlock,
  Notice,
  StarRating,
} from "@/components/ui";
import { CATEGORY_MAP } from "@/lib/constants";
import { ResumeSummary } from "@/components/ResumeSummary";
import { WorkerOffers } from "@/components/WorkerOffers";
import { useAuth } from "@/context/AuthContext";
import { createJobRequest, getWorker, listReviews } from "@/lib/data";
import { formatPeso } from "@/lib/commission";
import { timeAgo } from "@/lib/utils";
import type { Review, Worker } from "@/lib/types";

export function WorkerProfile({ id }: { id: string }) {
  const [worker, setWorker] = useState<Worker | null | "missing">(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let cancelled = false;
    getWorker(id)
      .then((w) => {
        if (!cancelled) setWorker(w ?? "missing");
      })
      .catch(() => {
        if (!cancelled) setWorker("missing");
      });
    listReviews(id)
      .then((rows) => {
        if (!cancelled) setReviews(rows);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (worker === null) return <LoadingBlock label="Loading profile" />;

  if (worker === "missing") {
    return (
      <section className="container-page py-20">
        <EmptyState
          title="Worker not found"
          description="This profile may have been removed, or the link is out of date."
          action={{ label: "Back to directory", href: "/browse" }}
        />
      </section>
    );
  }

  const trade = CATEGORY_MAP[worker.categoryId];

  return (
    <section className="container-page py-10">
      <Link
        href="/browse"
        className="inline-flex items-center gap-1 text-[13px] tracking-[-0.02em] text-stone-600 no-underline hover:text-ink-black"
      >
        <ArrowLeft size={13} strokeWidth={1.5} />
        Directory
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <div className="flex flex-wrap items-start gap-4">
              <Avatar name={worker.fullName} size={64} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[24px] leading-[1.2] font-medium tracking-[-0.48px] text-ink-black">
                    {worker.fullName}
                  </h1>
                  {worker.verified ? (
                    <Badge
                      tone="verified"
                      icon={<BadgeCheck size={11} strokeWidth={2} />}
                    >
                      Verified
                    </Badge>
                  ) : (
                    <Badge tone="muted">Pending verification</Badge>
                  )}
                  {worker.tesdaCertified ? (
                    <Badge
                      tone="neutral"
                      icon={<GraduationCap size={11} strokeWidth={1.5} />}
                    >
                      TESDA Certified
                    </Badge>
                  ) : null}
                </div>

                <p className="mt-1.5 text-[15px] text-stone-600">
                  {trade?.name ?? "General services"}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <StarRating value={worker.rating} count={worker.reviewCount} />
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-stone-600">
                    <MapPin
                      size={13}
                      strokeWidth={1.5}
                      className="text-stone-400"
                    />
                    {worker.barangay}
                  </span>
                  <span className="text-[13px] text-stone-600 tabular-nums">
                    {worker.yearsExperience} yrs experience
                  </span>
                </div>
              </div>
            </div>

            {worker.bio ? (
              <p className="mt-5 border-t border-stone-200 pt-5 text-[14px] leading-[1.55] text-stone-700">
                {worker.bio}
              </p>
            ) : null}

            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-200 pt-5 sm:grid-cols-4">
              {[
                ["Reference rate", `${formatPeso(worker.hourlyRate)}/hr`],
                ["Jobs completed", String(worker.jobsCompleted)],
                ["Reviews", String(worker.reviewCount)],
                ["Service floor", trade ? formatPeso(trade.floor) : "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="caption">{label}</dt>
                  <dd className="mt-1 text-[18px] leading-[1.2] font-medium tracking-[-0.36px] text-ink-black tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <ResumeSummary worker={worker} />

          <WorkerOffers worker={worker} />

          {/* Portfolio */}
          <Card className="overflow-hidden p-0">
            <div className="border-b border-stone-200 px-6 py-4">
              <h2 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
                Before &amp; after portfolio
              </h2>
              <p className="caption mt-0.5">
                Uploaded voluntarily after completed jobs
              </p>
            </div>

            {worker.portfolio.length === 0 ? (
              <p className="px-6 py-8 text-[14px] text-stone-500">
                No portfolio entries yet.
              </p>
            ) : (
              <ul className="divide-y divide-stone-200">
                {worker.portfolio.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-2 px-6 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
                          {entry.jobTitle}
                        </h3>
                        <p className="caption mt-0.5">
                          {timeAgo(entry.createdAt)}
                        </p>
                      </div>
                      <Badge tone="muted">
                        {CATEGORY_MAP[entry.categoryId]?.name ?? "General"}
                      </Badge>
                    </div>
                    {entry.note ? (
                      <p className="text-[13px] leading-[1.45] text-stone-600">
                        {entry.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Reviews */}
          <Card className="overflow-hidden p-0">
            <div className="border-b border-stone-200 px-6 py-4">
              <h2 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
                Household reviews
              </h2>
              <p className="caption mt-0.5">
                Recomputed from the full review set to prevent rating drift
              </p>
            </div>

            {reviews.length === 0 ? (
              <p className="px-6 py-8 text-[14px] text-stone-500">
                No reviews yet.
              </p>
            ) : (
              <ul className="divide-y divide-stone-200">
                {reviews.map((review) => (
                  <li key={review.id} className="flex flex-col gap-2 px-6 py-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
                        {review.consumerName}
                      </span>
                      <span className="flex items-center gap-1 text-[12px] text-stone-600 tabular-nums">
                        <Star
                          size={12}
                          strokeWidth={1.5}
                          className="fill-ink-black text-ink-black"
                        />
                        {review.rating}
                      </span>
                    </div>
                    <p className="text-[13px] leading-[1.5] text-stone-600">
                      {review.text}
                    </p>
                    <p className="caption">
                      {timeAgo(review.createdAt as string)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="lg:sticky lg:top-20">
          <RequestPanel worker={worker} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Job request — stage 1 into stage 2                                   */
/* ------------------------------------------------------------------ */

/**
 * Turns a Firestore write failure into something the person can act on.
 * These three causes need completely different responses, so naming the wrong
 * one wastes their time.
 */
function describeRequestFailure(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  const message = String((error as { message?: string })?.message ?? error);

  if (/ERR_BLOCKED_BY_CLIENT/i.test(message)) {
    return "Your browser blocked this request before it left the page. This is almost always an ad blocker or privacy extension intercepting Firebase. Allow this site, or retry in a private window with extensions off.";
  }
  if (code === "permission-denied" || /permission/i.test(message)) {
    return "The server rejected this request. The Firestore rules deployed for this project may not be the current version - check the browser console for the full error.";
  }
  if (code === "unavailable" || /network|failed to fetch/i.test(message)) {
    return "Could not reach the database. Check your connection and try again.";
  }
  return "Could not send the request. Please try again, and check the browser console for details.";
}

function RequestPanel({ worker }: { worker: Worker }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [barangay, setBarangay] = useState(worker.barangay);
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      await createJobRequest({
        consumerId: user!.uid,
        consumerName: user!.displayName || "Household",
        worker,
        categoryId: worker.categoryId,
        title: title.trim(),
        description: description.trim(),
        photoUrl: photoUrl.trim(),
        barangay: barangay.trim(),
      });
      router.push("/dashboard?sent=1");
    } catch (err) {
      // Do not guess the cause. A bare "check your connection" sent a real
      // report of an extension blocking firestore.googleapis.com down the
      // wrong path entirely.
      console.error("[job-request] send failed:", err);
      setError(describeRequestFailure(err));
    } finally {
      setBusy(false);
    }
  }, [user, worker, title, description, photoUrl, barangay, router]);

  if (loading) {
    return (
      <Card className="p-6">
        <LoadingBlock label="Checking session" />
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
          Sign in to request this worker
        </h2>
        <p className="text-[13px] leading-[1.45] text-stone-600">
          Creating an account takes a moment and keeps your request history in
          one place.
        </p>
        <Link href={`/login?next=/worker/${worker.id}`} className="btn-primary w-full">
          Sign in to continue
        </Link>
        <Link href="/signup" className="btn-neutral w-full">
          Create a household account
        </Link>
      </Card>
    );
  }

  const valid = title.trim().length >= 3 && description.trim().length >= 10;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
          Send a job request
        </h2>
        <p className="mt-1.5 text-[13px] leading-[1.45] text-stone-600">
          The worker receives an in-app
          notification.
        </p>
      </div>

      {error ? <Notice tone="alert">{error}</Notice> : null}

      <div className="flex flex-col gap-3">
        <div>
          <label className="label" htmlFor="req-title">
            What needs doing
          </label>
          <input
            id="req-title"
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Leaking kitchen pipe"
            maxLength={90}
          />
        </div>

        <div>
          <label className="label" htmlFor="req-desc">
            Description
          </label>
          <textarea
            id="req-desc"
            className="field min-h-[96px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue, where it is, and when you are available."
          />
          <p className="caption mt-1">
            Minimum 10 characters. The worker assesses scope before quoting.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="req-place">
            Service address barangay
          </label>
          <input
            id="req-place"
            className="field"
            value={barangay}
            onChange={(e) => setBarangay(e.target.value)}
            placeholder="Baras"
          />
        </div>

        <div>
          <label className="label" htmlFor="req-photo">
            Photo of the issue (optional)
          </label>
          <div className="flex gap-2">
            <input
              id="req-photo"
              className="field"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="Paste an image URL"
              inputMode="url"
            />
            <span className="flex w-10 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-bone text-stone-400">
              <Camera size={14} strokeWidth={1.5} aria-hidden />
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn-primary w-full"
        disabled={!valid || busy}
        onClick={submit}
      >
        {busy ? (
          <>
            <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
            Sending
          </>
        ) : (
          <>
            <Send size={14} strokeWidth={1.5} />
            Send request
          </>
        )}
      </button>

      {/* Privacy and payment expectations, stated before commitment. */}
      <div className="flex flex-col gap-2.5 border-t border-stone-200 pt-4">
        <p className="flex items-start gap-2 text-[12px] leading-[1.45] text-stone-600">
          <Lock
            size={13}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0 text-stone-400"
          />
          The worker&apos;s contact number unlocks after they accept your request.
        </p>
        <p className="flex items-start gap-2 text-[12px] leading-[1.45] text-stone-600">
          <ShieldCheck
            size={13}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0 text-stone-400"
          />
          You approve a two-part quote (labor and materials) before any work
          begins. Payment goes directly to the worker.
        </p>
      </div>
    </Card>
  );
}