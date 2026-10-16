"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Notice, LoadingBlock } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

/** Navigation and account controls live in SiteNav on every screen. */
export function DashboardShell({ title, subtitle, eyebrow, children }: {
  title: string; subtitle?: string; eyebrow?: string; children: ReactNode;
}) {
  const { user, loading, profileError } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);
  if (loading) return <LoadingBlock label="Loading your account" />;
  if (!user) return null;
  return <section className="container-page py-8 sm:py-10">
    <header className="border-b border-stone-200 pb-6">
      {eyebrow ? <p className="text-xs font-medium text-stone-500">{eyebrow}</p> : null}
      <h1 className="mt-1.5 text-[28px] font-medium leading-tight tracking-tight text-ink-black">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-stone-600">{subtitle}</p> : null}
    </header>
    <div className="mt-6">
      {profileError ? <div className="mb-4"><Notice tone="alert">{profileError}</Notice></div> : null}
      {children}
    </div>
  </section>;
}
