import Link from "next/link";
import { cx } from "@/lib/utils";

/**
 * Compact monogram mark. Deliberately monochrome: the single saturated color
 * in this system belongs to the primary action button and nothing else.
 *
 * Defaults to /landing, not /. The masthead is the brand's front door and
 * should introduce the marketplace; `/` is the signed-in working home, which
 * bounces a visitor straight back here when they have no account.
 */
export function Wordmark({
  href = "/landing",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group inline-flex items-center gap-2 rounded-md no-underline",
        className,
      )}
      aria-label="Koronadal Local Service Marketplace — landing page"
    >
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-[3px] bg-char text-[11px] leading-none font-medium tracking-[-0.04em] text-newsprint"
      >
        KC
      </span>
      <span className="text-[15px] leading-none font-medium tracking-[-0.02em] text-char">
        Koronadal<span className="text-stone-500"> Service</span>
      </span>
    </Link>
  );
}