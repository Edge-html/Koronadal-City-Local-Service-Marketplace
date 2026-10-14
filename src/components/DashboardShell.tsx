"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LoadingBlock } from "@/components/ui";
import { cx, initials } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
}

/**
 * Signed-in chrome. Two shells exist because the customer and worker
 * consoles show genuinely different data, and mixing them would dilute both.
 */
export function DashboardShell({
  tabs = [],
  title,
  subtitle,
  eyebrow,
  children,
}: {
  tabs?: Tab[];
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  const { user, role, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading) return <LoadingBlock label="Loading your account" />;
  if (!user) return null;

  if (role === "admin") {
    return (
      <DashboardFrame
        title={title}
        eyebrow={eyebrow}
        subtitle={subtitle}
        userName={user.displayName || user.email || "Account"}
        initials={initials(user.displayName || user.email || "U")}
        onSignOut={logout}
        tabs={[
          { href: "/admin", label: "Review queue" },
          { href: "/dashboard", label: "My account" },
        ]}
        pathname={pathname}
      >
        {children}
      </DashboardFrame>
    );
  }

  const baseTabs: Tab[] =
    role === "worker"
      ? [
          { href: "/dashboard/worker", label: "Jobs" },
          { href: "/dashboard/wallet", label: "Wallet" },
          { href: "/dashboard/worker/profile", label: "Profile" },
        ]
      : [
          { href: "/dashboard/customer", label: "My requests" },
          { href: "/browse", label: "Find a worker" },
        ];

  const allTabs = [...tabs, ...baseTabs];

  return (
    <DashboardFrame
      title={title}
      eyebrow={eyebrow}
      subtitle={subtitle}
      userName={user.displayName || user.email || "Account"}
      initials={initials(user.displayName || user.email || "U")}
      onSignOut={logout}
      tabs={allTabs}
      pathname={pathname}
    >
      {children}
    </DashboardFrame>
  );
}

function DashboardFrame({
  title,
  subtitle,
  eyebrow,
  userName,
  initials: mark,
  onSignOut,
  tabs,
  pathname,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  userName: string;
  initials: string;
  onSignOut: () => void;
  tabs: Tab[];
  pathname: string;
  children: ReactNode;
}) {
  return (
    <section className="container-page py-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-stone-200 pb-6">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] text-stone-500">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-1.5 text-[28px] leading-[1.2] font-medium tracking-[-0.02em] text-ink-black">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-[62ch] text-[15px] leading-[1.45] text-stone-600">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-2.5 py-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-bone text-[10px] font-medium text-stone-700">
              {mark}
            </span>
            <span className="max-w-[16ch] truncate text-[13px] tracking-[-0.02em] text-ink-black">
              {userName}
            </span>
          </span>
          <button
            type="button"
            onClick={onSignOut}
            className="btn-ghost px-2"
            aria-label="Sign out"
          >
            <LogOut size={15} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <nav
        className="mt-5 flex flex-wrap gap-2"
        aria-label="Dashboard sections"
      >
        {tabs.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href !== "/dashboard" && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(
                "rounded-md px-4 py-2 text-[14px] tracking-[-0.02em] no-underline transition-colors",
                active
                  ? "border border-stone-200 bg-white text-ink-black shadow-[0_2px_3px_rgba(0,0,0,0.08)]"
                  : "border border-transparent text-stone-500 hover:bg-bone hover:text-ink-black",
              )}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">{children}</div>
    </section>
  );
}