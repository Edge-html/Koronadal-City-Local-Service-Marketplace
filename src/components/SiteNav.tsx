"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGrid, LogOut, Menu, User, X } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";
import { useAuth } from "@/context/AuthContext";
import { cx, initials } from "@/lib/utils";

const LINKS = [
  { href: "/browse", label: "Find a worker" },
  { href: "/#categories", label: "Services" },
  { href: "/#workflow", label: "How it works" },
  { href: "/#commission", label: "Commission" },
  { href: "/#compliance", label: "Compliance" },
];

export function SiteNav() {
  const pathname = usePathname();
  const { user, role, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Mobile sheet closes on navigation.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href !== "/" && pathname === href ? true : pathname.startsWith(href);

  return (
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
            {LINKS.map((link) => (
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
              <Link href="/dashboard" className="btn-ghost">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-bone text-[10px] font-medium text-stone-700">
                  {initials(
                    (user.displayName as string) || (user.email ?? "U"),
                  )}
                </span>
                Dashboard
              </Link>
              {role === "admin" ? (
                <Link href="/admin" className="btn-neutral btn-sm">
                  Review queue
                </Link>
              ) : null}
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
            {LINKS.map((link) => (
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
                  <Link href="/dashboard" className="btn-neutral w-full">
                    <LayoutGrid size={14} strokeWidth={1.5} />
                    Go to dashboard
                  </Link>
                  {role === "admin" ? (
                    <Link href="/admin" className="btn-neutral w-full">
                      Review queue
                    </Link>
                  ) : null}
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
  );
}