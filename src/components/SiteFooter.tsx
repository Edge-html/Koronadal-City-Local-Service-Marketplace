import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

const COLUMNS = [
  {
    title: "Marketplace",
    links: [
      { href: "/browse", label: "Browse workers" },
      { href: "/#categories", label: "Service categories" },
      { href: "/platform#workflow", label: "How it works" },
      { href: "/platform#commission", label: "Pricing & commission" },
    ],
  },
  {
    title: "For workers",
    links: [
      { href: "/signup?role=worker", label: "Create a profile" },
      { href: "/platform#onboarding", label: "Onboarding pathways" },
      { href: "/dashboard/worker", label: "Worker dashboard" },
      { href: "/platform#referrals", label: "Referral program" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/platform#compliance", label: "Regulatory alignment" },
      { href: "/platform#fairness", label: "Fair competition" },
      { href: "/platform#privacy", label: "Data privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-stone-200 bg-newsprint">
      <div className="container-page py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-4">
            <Wordmark />
            <p className="max-w-[34ch] text-[14px] leading-[1.4] text-stone-600">
              A verified marketplace connecting Koronadal City households with
              vetted, accountable blue-collar service professionals.
            </p>
            <p className="caption">Koronadal City, South Cotabato</p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="mb-3 font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] text-stone-500">
                {col.title}
              </h3>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="footer-link">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-stone-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="caption">
            Platform intermediary status under the Philippine Labor Code. Not an
            employer of record.
          </p>
          <p className="caption">
            Operates in alignment with RA 10173 and RA 7394.
          </p>
        </div>
      </div>
    </footer>
  );
}