"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Notice, LoadingBlock } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

/** Navigation and account controls live in SiteNav on every screen. */
export function DashboardShell({ title, subtitle, eyebrow, bannerImages, children }: {
  title: string; subtitle?: string; eyebrow?: string; bannerImages?: readonly [string, string]; children: ReactNode;
}) {
  const { user, loading, profileError } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!loading && !user) {
      const requestedPage = `${pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(requestedPage)}`);
    }
  }, [loading, user, router, pathname]);
  if (loading) return <LoadingBlock label="Loading your account" />;
  if (!user) return null;
  return <section className="container-page py-8 sm:py-10">
    <header
      className={bannerImages
        ? "relative isolate -mx-6 -mt-8 mb-6 overflow-hidden border-b border-stone-200 px-6 py-8 sm:-mt-10 sm:py-10"
        : "border-b border-stone-200 pb-6"}
      style={bannerImages ? { backgroundColor: "#f8fafc" } : undefined}
    >
      {bannerImages ? <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-y-0 left-0 w-[62%] bg-cover bg-center"
          style={{ backgroundImage: `url('${bannerImages[0]}')` }}
        />
        <div
          className="absolute inset-y-0 right-0 w-[38%] bg-cover bg-center"
          style={{ backgroundImage: `url('${bannerImages[1]}')` }}
        />
        <div
          className="absolute inset-0"
          style={{ backgroundImage: "linear-gradient(90deg, rgba(248,250,252,.98) 0%, rgba(248,250,252,.86) 38%, rgba(248,250,252,.36) 100%)" }}
        />
      </div> : null}
      <div className={bannerImages ? "relative z-10" : undefined}>
        {eyebrow ? <p className="text-xs font-medium text-stone-600">{eyebrow}</p> : null}
        <h1 className="mt-1.5 text-[28px] font-medium leading-tight tracking-tight text-ink-black">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-stone-700">{subtitle}</p> : null}
      </div>
    </header>
    <div className="mt-6">
      {profileError ? <div className="mb-4"><Notice tone="alert">{profileError}</Notice></div> : null}
      {children}
    </div>
  </section>;
}
