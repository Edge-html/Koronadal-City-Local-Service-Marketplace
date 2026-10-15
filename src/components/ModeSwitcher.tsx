"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Hammer } from "lucide-react";
import { cx } from "@/lib/utils";

/** Workers can also hire someone without changing their account's home page. */
export function ModeSwitcher({
  available,
  className,
}: {
  available: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const findingService = pathname === "/browse" || pathname.startsWith("/dashboard/customer");
  const options = [
    {
      id: "customer",
      label: "Finding a service",
      note: "Browse workers and track requests",
      icon: Hammer,
      href: "/browse",
      active: findingService,
      disabled: false,
    },
    {
      id: "worker",
      label: "Working as a provider",
      note: "Inquiries and services",
      icon: Briefcase,
      href: "/",
      active: !findingService,
      disabled: !available,
    },
  ];

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <p className="label mb-0">Switch views</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon;
          const classes = cx(
            "flex flex-col gap-1 rounded-md border p-3 text-left no-underline transition-colors",
            option.active
              ? "border-ink-black bg-white"
              : "border-stone-200 bg-bone hover:border-stone-400",
            option.disabled && "cursor-not-allowed opacity-50",
          );
          const content = (
            <>
              <span className="flex items-center gap-2">
                <Icon size={14} strokeWidth={1.5} className={option.active ? "text-ink-black" : "text-stone-500"} />
                <span className={cx("text-[13px] font-medium tracking-[-0.02em]", option.active ? "text-ink-black" : "text-stone-700")}>
                  {option.label}
                </span>
              </span>
              <span className="caption">{option.disabled ? "Finish your worker application to unlock this view" : option.note}</span>
            </>
          );

          return option.disabled ? (
            <div key={option.id} className={classes} aria-disabled="true">{content}</div>
          ) : (
            <Link key={option.id} href={option.href} className={classes} aria-current={option.active ? "page" : undefined}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
