"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MyServices } from "@/components/MyServices";
import { Notice, Skeleton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { getWorkerByUid } from "@/lib/data";
import type { Worker } from "@/lib/types";

/** The worker home is for services and inquiries; jobs have their own console. */
export function WorkerHome() {
  const { user, loading: authLoading } = useAuth();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    getWorkerByUid(user.uid)
      .then((result) => {
        if (cancelled) return;
        setWorker(result);
        setLoaded(true);
      })
      .catch((err) => {
        console.error("[home] worker profile load failed:", err);
        if (cancelled) return;
        setError("Could not load your worker profile. Please refresh to try again.");
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (!worker || !window.location.hash) return;
    const id = window.location.hash.slice(1);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, [worker]);

  if (!loaded) {
    return (
      <section className="container-page py-16">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-4 h-12 w-96 max-w-full" />
        <Skeleton className="mt-8 h-40 w-full" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="container-page py-16">
        <Notice tone="alert">{error}</Notice>
      </section>
    );
  }

  if (!worker) {
    return (
      <section className="section container-page">
        <p className="label">Worker home</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-[44px] leading-[1.05] text-ink-black sm:text-[56px]">
          Start offering your services.
        </h1>
        <p className="mt-4 max-w-[54ch] text-[16px] leading-[1.5] text-stone-600">
          Finish your worker profile to appear in the directory and receive inquiries.
        </p>
        <Link href="/dashboard/worker/onboarding" className="btn-primary mt-6 w-fit no-underline">
          Complete worker profile
        </Link>
      </section>
    );
  }

  if (!worker.verified) {
    return (
      <section className="section container-page">
        <p className="label">Worker home</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-[44px] leading-[1.05] text-ink-black sm:text-[56px]">
          Your services are under review.
        </h1>
        <p className="mt-4 max-w-[54ch] text-[16px] leading-[1.5] text-stone-600">
          An administrator needs to approve your credentials before households can find your profile or send inquiries.
        </p>
        <Link href="/dashboard/worker/credentials" className="btn-primary mt-6 w-fit no-underline">
          Review your credentials
        </Link>
      </section>
    );
  }

  return (
    <>
      <section className="container-page pt-12 sm:pt-16">
        <p className="label">Worker home</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-[44px] leading-[1.05] text-ink-black sm:text-[56px]">
          Your services and inquiries.
        </h1>
        <p className="mt-4 max-w-[54ch] text-[16px] leading-[1.5] text-stone-600">
          See who has asked about your offers and update what you provide.
        </p>
      </section>
      <MyServices worker={worker} />
    </>
  );
}
