"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGrid, LogOut, Menu, User, X } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";
import { useAuth } from "@/context/AuthContext";
import { firebaseConfigured } from "@/lib/firebase";
import { cx, initials } from "@/lib/utils";

/**
 * Commission and compliance used to be separate top-level links that both
 * resolved to sections of /platform. Three nav entries pointing into one page
 * is noise, so they fold into a single destination; the on-page index on
 * /platform carries the detail.
 *
 * The primary links follow the signed-in role. A worker's home is their
 * services and inquiries; a household's home is the worker finder.
 */
const PUBLIC_LINKS = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Find a worker" },
  { href: "/#categories", label: "Services" },
  { href: "/platform", label: "How it works" },
];
const WORKER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/#inquiries", label: "Inquiries" },
  { href: "/#my-services", label: "My services" },
  { href: "/browse", label: "Find a worker" },
];
const CUSTOMER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Find a worker" },
  { href: "/dashboard/customer", label: "My requests" },
  { href: "/#categories", label: "Services" },
];

export function SiteNav() {
  const pathname = usePathname();
  const { user, role, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const links =
    role === "admin"
      ? [{ href: "/admin", label: "Review queue" }, ...PUBLIC_LINKS]
      : role === "worker"
        ? WORKER_LINKS
        : role === "customer"
          ? CUSTOMER_LINKS
          : PUBLIC_LINKS;
  const accountHref = role === "admin" ? "/admin" : role === "worker" ? "/" : "/dashboard/customer";

  // displayName is set at signup, but fall back to the email local-part so
  // the header never renders an empty identity chip.
  const accountName =
    (user?.displayName as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "Account";

  // Mobile sheet closes on navigation.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /**
   * Anchor links to the same parent share one active state — lighting up
   * "Commission", "Compliance" and "How it works" all at once on /platform
   * would be noise. Only the parent-level link lights up.
   */
  const isActive = (href: string) => {
    const [path, hash] = href.split("#");
    if (path !== pathname) return false;
    // A hash link is a different destination from the bare path, even though
    // both are `/`. Only the bare one lights up.
    return !hash;
  };

  return (
    <>
      {!firebaseConfigured ? (
        <div className="border-b border-stone-200 bg-bone no-print">
          <div className="container-page flex items-center justify-between gap-4 py-2">
            <p className="font-[family-name:var(--font-system-ui)] text-[11px] leading-[1.4] tracking-[-0.36px] text-stone-700">
              Preview mode — Firebase is not configured, so accounts and live
              data are unavailable.
            </p>
            <Link href="/browse" className="shrink-0 text-[11px] tracking-[-0.02em] text-ink-black underline underline-offset-2">
              What&apos;s needed
            </Link>
          </div>
        </div>
      ) : null}

      <header
        className={cx(
          "sticky top-0 z-50 border-b transition-colors duration-200",
          scrolled
            ? "border-stone-200 bg-newsprint/90 backdrop-blur-sm"
            : "border-transparent bg-newsprint",
        )}
      >
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Wordmark />
          <nav
            className="hidden items-center gap-1 lg:flex"
            aria-label="Primary"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cx(
                  "rounded-md px-3 py-2 text-[14px] tracking-[-0.02em] no-underline transition-colors",
                  isActive(link.href)
                    ? "text-ink-black"
                    : "text-stone-700 hover:bg-bone hover:text-ink-black",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {loading ? (
            <span className="h-9 w-24 animate-pulse rounded-md bg-stone-200/70" />
          ) : user ? (
            <>
              <Link
                href={accountHref}
                className="btn-ghost gap-2"
                title="Open your account"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bone text-[10px] font-medium text-stone-700">
                  {initials(accountName)}
                </span>
                <span className="max-w-[18ch] truncate text-[14px] tracking-[-0.02em] text-ink-black">
                  {accountName}
                </span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="btn-ghost"
                aria-label="Sign out"
              >
                <LogOut size={14} strokeWidth={1.5} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link href="/signup" className="btn-neutral">
                Join as a worker
              </Link>
              <Link href="/browse" className="btn-primary">
                Find a worker
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="btn-ghost -mr-2 px-2 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? (
            <X size={18} strokeWidth={1.5} />
          ) : (
            <Menu size={18} strokeWidth={1.5} />
          )}
        </button>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="animate-in border-t border-stone-200 bg-newsprint lg:hidden"
        >
          <nav
            className="container-page flex flex-col gap-1 py-4"
            aria-label="Mobile"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-3 text-[15px] tracking-[-0.02em] text-ink-black no-underline hover:bg-bone"
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-3 flex flex-col gap-2 border-t border-stone-200 pt-4">
              {user ? (
                <>
                  <Link href={accountHref} className="btn-neutral w-full">
                    <LayoutGrid size={14} strokeWidth={1.5} />
                    {accountName}
                  </Link>
                  {/* Review queue is already the first link in the list above. */}
                  <button
                    type="button"
                    onClick={logout}
                    className="btn-ghost w-full"
                  >
                    <LogOut size={14} strokeWidth={1.5} />
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/browse" className="btn-primary w-full">
                    Find a worker
                  </Link>
                  <Link href="/signup" className="btn-neutral w-full">
                    <User size={14} strokeWidth={1.5} />
                    Join as a worker
                  </Link>
                  <Link href="/login" className="btn-ghost w-full">
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
      </header>
    </>
  );
}
