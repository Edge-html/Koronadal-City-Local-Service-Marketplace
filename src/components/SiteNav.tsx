"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";
import { CountBadge } from "@/components/FlowGuide";
import { useAuth } from "@/context/AuthContext";
import { useActivity } from "@/context/ActivityContext";
import { firebaseConfigured } from "@/lib/firebase";
import { ActionNotifications } from "@/components/ActionNotifications";
import { Avatar } from "@/components/ui";
import { useUnreadMessageCount } from "@/hooks/useUnreadMessageCount";

function UnreadMessageBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-white tabular-nums" aria-label={`${count} unread conversations`} aria-live="polite">
    {count > 99 ? "99+" : count}
  </span>;
}

export function SiteNav() {
  const pathname = usePathname();
  const { user, role, loading, logout, profile } = useAuth();
  const unreadMessageCount = useUnreadMessageCount(user?.uid ?? null);
  const { customerCount, workerCount, adminCount, customerJobs, workerJobs, admin } = useActivity();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const account = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const links = role === "admin"
    ? [{ href: "/admin", label: "Review queue", count: adminCount }, { href: "/browse", label: "Worker directory", count: 0 }]
    : role === "worker"
      ? [{ href: "/", label: "Home", count: 0 }, { href: "/dashboard/worker", label: "My jobs", count: workerCount }, { href: "/dashboard/worker#my-services", label: "My service offers", count: 0 }, { href: "/dashboard/messages", label: "Messages", count: unreadMessageCount }]
      : role === "customer"
        ? [{ href: "/", label: "Home", count: 0 }, { href: "/browse", label: "Find a worker", count: 0 }, { href: "/dashboard/customer", label: "My requests", count: customerCount }, { href: "/dashboard/messages", label: "Messages", count: unreadMessageCount }]
        : [{ href: "/landing", label: "Home", count: 0 }, { href: "/browse", label: "Find a worker", count: 0 }, { href: "/platform", label: "How it works", count: 0 }];
  const accountName = user?.displayName?.trim() || user?.email?.split("@")[0] || "Account";
  const accountLinks = role === "worker" ? [
    { href: "/dashboard/worker/profile", label: "My profile", count: 0 },
    { href: "/dashboard/worker/credentials", label: "Verification documents", count: 0 },
    { href: "/browse", label: "Hire a worker", count: 0 },
    { href: "/dashboard/customer", label: "My requests as a customer", count: customerCount },
    { href: "/dashboard/messages", label: "Messages", count: unreadMessageCount },
  ] : role === "admin" ? [{ href: "/admin", label: "Review queue", count: adminCount }]
    : [{ href: "/dashboard/customer", label: "My requests", count: customerCount }, { href: "/dashboard/customer/profile", label: "My profile", count: 0 }, { href: "/dashboard/messages", label: "Messages", count: unreadMessageCount }];

  useEffect(() => { setOpen(false); setAccountOpen(false); }, [pathname]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!account.current?.contains(event.target as Node)) setAccountOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        if (accountOpen) { setAccountOpen(false); accountButton.current?.focus(); }
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [accountOpen]);

  const renderLinks = (mobile = false) => links.map((link) => <Link key={link.href} href={link.href}
    onClick={() => setOpen(false)} aria-current={pathname === link.href ? "page" : undefined}
    className={`flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm no-underline transition-colors ${mobile ? "justify-between" : ""} ${pathname === link.href ? "bg-ink-black font-medium text-newsprint" : "text-stone-700 hover:bg-bone"}`}>
    {link.label}{link.href === "/dashboard/messages" ? <UnreadMessageBadge count={link.count} /> : <CountBadge count={link.count} />}
  </Link>);

  return <>
    {!firebaseConfigured ? <div className="border-b border-stone-200 bg-bone py-2"><p className="container-page text-xs text-stone-700">Preview mode — accounts and live data are unavailable.</p></div> : null}
    <header className="sticky top-0 z-50 border-b border-stone-200 bg-newsprint/95 backdrop-blur-sm">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-6"><Wordmark href={user ? "/" : "/landing"} /><nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">{renderLinks()}</nav></div>
        <div className="flex items-center gap-2">
          {user && role ? <ActionNotifications role={role} customerJobs={customerJobs} workerJobs={workerJobs} admin={admin} /> : null}
          {loading ? <span className="h-9 w-20 animate-pulse rounded bg-stone-200" /> : user ? (
            <div className="relative" ref={account} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false); }}>
              <button type="button" ref={accountButton} className="btn-ghost gap-2" aria-expanded={accountOpen} aria-controls="account-panel" aria-label={`Open account menu for ${accountName}`} onClick={() => setAccountOpen((v) => !v)}>
                <Avatar name={accountName} size={28} photoUrl={typeof profile?.photoUrl === "string" ? profile.photoUrl : undefined} className="border-0 bg-white text-xs" />
                <span className="hidden max-w-[14ch] truncate text-sm sm:inline">{accountName}</span>
                {role === "worker" ? <CountBadge count={customerCount} /> : null}
                <ChevronDown size={14} />
              </button>
              {accountOpen ? <div id="account-panel" className="absolute right-0 top-full mt-2 w-64 max-w-[85vw] rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
                <div className="border-b border-stone-100 px-3 py-3"><p className="truncate text-sm font-semibold">{accountName}</p><p className="mt-1 text-xs capitalize text-stone-500">{role === "customer" ? "Customer" : role} account</p></div>
                <nav aria-label="Account">{accountLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => { setAccountOpen(false); setOpen(false); }} className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-stone-800 no-underline hover:bg-stone-100">
                  {link.label}{link.href === "/dashboard/messages" ? <UnreadMessageBadge count={link.count} /> : <CountBadge count={link.count} />}
                </Link>)}</nav>
                <button type="button" onClick={async () => { setAccountOpen(false); await logout(); }} className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-lg border-t border-stone-100 px-3 py-2 text-sm hover:bg-stone-100"><LogOut size={14} />Sign out</button>
              </div> : null}
            </div>
          ) : <div className="hidden items-center gap-2 sm:flex"><Link href="/login" className="btn-ghost">Sign in</Link><Link href="/signup" className="btn-primary">Create account</Link></div>}
          <button type="button" className="btn-ghost px-2 lg:hidden" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close navigation" : "Open navigation"}>
            {open ? <X size={20} /> : <Menu size={20} />}<CountBadge count={role === "worker" ? workerCount : role === "admin" ? adminCount : customerCount} />
          </button>
        </div>
      </div>
      {open ? <nav id="mobile-nav" aria-label="Mobile" className="container-page flex flex-col gap-1 border-t border-stone-200 py-3 lg:hidden">
        {renderLinks(true)}{!user ? <><Link href="/login" className="btn-neutral">Sign in</Link><Link href="/signup" className="btn-primary">Create account</Link></> : null}
      </nav> : null}
    </header>
  </>;
}
