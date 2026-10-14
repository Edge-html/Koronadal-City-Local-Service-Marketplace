"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CirclePlay,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Card,
  SectionHeader,
  StatCard,
} from "@/components/ui";
import {
  BARANGAYS,
  CATEGORIES,
  COMPLIANCE_FRAMEWORK,
  FAIR_COMPETITION_PRINCIPLES,
  ONBOARDING_PATHWAYS,
  WALLET_TOPUP_METHODS,
  WORKFLOW_STAGES,
} from "@/lib/constants";
import { formatPeso } from "@/lib/commission";

/** Monochrome partner wordmarks for the trust bar. No color logos allowed. */
const TRUST_BAR = [
  "PESO Koronadal",
  "City Government",
  "Barangay Hall Network",
  "TESDA Region XII",
  "7-Eleven CliQQ",
  "GCash",
];

export default function LandingPage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Categories />
      <Workflow />
      <LiveProductCard />
      <Commission />
      <Onboarding />
      <Referrals />
      <Compliance />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Hero — the one place the display serif appears                      */
/* ------------------------------------------------------------------ */

function Hero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <section className="flex flex-col items-center px-6 pt-20 pb-6 text-center sm:pt-28">
      <LaunchPill mounted={mounted} />

      {/* Two lines: the statement lands in ink, the qualifier recedes. */}
      <h1 className="font-display mt-8 text-[clamp(34px,8vw,100px)] leading-[0.8]">
        <span className="block text-ink-black">Verified trades.</span>
        <span className="-mt-0.06em block text-stone-400">One clear price.</span>
      </h1>

      <p className="mt-8 max-w-[58ch] text-[16px] leading-[1.45] text-stone-600 sm:text-[17px]">
        The Koronadal City Local Service Marketplace connects households with
        background-checked professionals across ten essential trades. Pay cash
        or GCash directly to the worker. Nothing is held in escrow.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Link href="/browse" className="btn-primary w-full sm:w-auto">
          Browse verified workers
          <ArrowRight size={15} strokeWidth={1.5} />
        </Link>
        <Link href="/signup" className="btn-neutral w-full sm:w-auto">
          Join as a worker
        </Link>
      </div>

      <dl className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {[
          ["10", "essential trades"],
          ["24", "barangays served"],
          ["10%", "labor commission"],
        ].map(([value, label]) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="sr-only">{label}</dt>
            <dd className="text-[20px] leading-none font-medium tracking-[-0.4px] text-ink-black tabular-nums">
              {value}
            </dd>
            <span className="caption">{label}</span>
          </div>
        ))}
      </dl>
    </section>
  );
}

function LaunchPill({ mounted }: { mounted: boolean }) {
  return (
    <Link
      href="#workflow"
      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1.5 pr-3 pl-3 text-[12px] font-medium tracking-[-0.02em] text-ink-black no-underline transition-colors hover:bg-bone"
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-bone">
        <CirclePlay size={11} strokeWidth={1.5} className="text-stone-700" />
      </span>
      <span className={mounted ? "animate-in" : undefined}>
        Live in Koronadal City &middot; 10 essential trades
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Trust bar — monochrome wordmarks, single row                          */
/* ------------------------------------------------------------------ */

function TrustBar() {
  return (
    <section className="container-page pt-16">
      <div className="card flex flex-col items-center gap-6 px-6 py-6">
        <p className="caption text-center">
          Aligned with local government and national service networks
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {TRUST_BAR.map((name) => (
            <li
              key={name}
              className="text-[14px] leading-none font-medium tracking-[-0.02em] whitespace-nowrap text-stone-600"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Service categories                                                   */
/* ------------------------------------------------------------------ */

function Categories() {
  return (
    <section id="categories" className="section container-page ">
      <SectionHeader
        eyebrow="Scope of work"
        title="Ten essential household service categories"
        description="Each trade carries its own scope of work, typical use cases, and a monitored price floor that keeps quoting fair on both sides of the transaction."
      />

      <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-2">
        {CATEGORIES.map((category, index) => (
          <article
            key={category.id}
            className="group flex flex-col gap-3 bg-white p-5 transition-colors hover:bg-bone"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="caption tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="caption">Floor {formatPeso(category.floor)}</span>
            </div>

            <h3 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
              {category.name}
            </h3>

            <p className="text-[13px] leading-[1.45] text-stone-600">
              {category.scope}
            </p>

            <p className="text-[12px] leading-[1.4] text-stone-500">
              <span className="text-stone-700">Typical: </span>
              {category.useCases}
            </p>

            <Link
              href={`/browse?category=${category.id}`}
              className="mt-1 inline-flex items-center gap-1 self-start text-[13px] tracking-[-0.02em] text-stone-800 no-underline hover:text-ink-black hover:underline hover:underline-offset-2"
            >
              Find {shortName(category.name)}
              <ChevronRight size={13} strokeWidth={1.5} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function shortName(name: string) {
  return name.split(" ")[0].toLowerCase().replace("&", "");
}

/* ------------------------------------------------------------------ */
/* Workflow stepper — six stages                                        */
/* ------------------------------------------------------------------ */

function Workflow() {
  const [active, setActive] = useState(0);

  return (
    <section id="workflow" className="section container-page ">
      <SectionHeader
        eyebrow="Transaction lifecycle"
        title="Six stages, from first look to final review"
        description="A deliberately short path. Contact details stay masked until a request is formally accepted, and the price is fixed before any work begins."
      />

      {/* Stepper tab strip: five visible steps connected by hairlines. */}
      <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-stretch">
        {WORKFLOW_STAGES.map((stage, index) => {
          const isActive = index === active;
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => setActive(index)}
              aria-pressed={isActive}
              className={
                isActive
                  ? "flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-white px-4 py-2 text-left shadow-[0_2px_3px_rgba(0,0,0,0.08)]"
                  : "flex items-center justify-between gap-2 rounded-md px-4 py-2 text-left text-stone-500 transition-colors hover:bg-bone"
              }
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={
                    isActive
                      ? "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ink-black text-[9px] leading-none font-medium text-newsprint"
                      : "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-stone-200 text-[9px] leading-none tabular-nums text-stone-500"
                  }
                >
                  {stage.step}
                </span>
                <span
                  className={
                    isActive
                      ? "truncate text-[14px] tracking-[-0.02em] text-ink-black"
                      : "truncate text-[14px] tracking-[-0.02em] text-stone-500"
                  }
                >
                  {stage.name}
                </span>
              </span>
              {index < WORKFLOW_STAGES.length - 1 ? (
                <ChevronRight
                  size={13}
                  strokeWidth={1.5}
                  className="hidden shrink-0 text-stone-200 lg:block"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Stage detail panel. */}
      <Card className="mt-4 animate-in p-6">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <div>
            <p className="caption">Stage {WORKFLOW_STAGES[active].step} of 6</p>
            <h3 className="mt-2 text-[20px] leading-[1.2] font-medium tracking-[-0.4px] text-ink-black">
              {WORKFLOW_STAGES[active].name}
            </h3>
          </div>
          <p className="max-w-[70ch] text-[15px] leading-[1.5] text-stone-600">
            {WORKFLOW_STAGES[active].detail}
          </p>
        </div>
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Product UI card — the mid-page demonstration                          */
/* ------------------------------------------------------------------ */

const DEMO_ROWS = [
  { name: "Rodrigo A.", trade: "Carpentry", place: "Baras", tone: "amber" },
  { name: "Marisol T.", trade: "Plumbing", place: "Banga", tone: "coral" },
  { name: "Jomar P.", trade: "Electrical", place: "Gabi", tone: "ember" },
  { name: "Elena C.", trade: "Roofing", place: "Lemoy", tone: "violet" },
  { name: "Danilo R.", trade: "Welding", place: "Ecol", tone: "neutral" },
  { name: "Rodel M.", trade: "Painting", place: "Saravia", tone: "amber" },
] as const;

function LiveProductCard() {
  return (
    <section className="section container-page ">
      <SectionHeader
        eyebrow="Marketplace operations"
        title="Every request, tracked to settlement"
        description="The worker console keeps the full pipeline in one view: who asked, what was quoted, what has cleared, and what the wallet still owes."
      />

      {/* Product UI card: stat cards left, data table right. */}
      <Card className="mt-10 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-4 border-b border-stone-200 p-6">
          <div className="min-w-0">
            <h3 className="truncate text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
              Koronadal Worker Console
            </h3>
            <p className="caption mt-0.5">Live pipeline &middot; updated continuously</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone="neutral">SMS alerts on</Badge>
            <span
              className="relative inline-flex h-5 w-9 items-center rounded-full bg-bone"
              aria-hidden
            >
              <span className="absolute right-0.5 h-4 w-4 rounded-full bg-ink-black" />
            </span>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[260px_1fr]">
          <div className="flex flex-col gap-3">
            <StatCard label="Open requests" value="18" sublabel="Awaiting acceptance" />
            <StatCard label="Quotes awaiting approval" value="7" sublabel="10% labor commission locked" />
            <StatCard label="Jobs settled this week" value="31" sublabel="100% paid direct to worker" />
            <StatCard
              label="Commission collected"
              value={formatPeso(28450)}
              sublabel="Materials exempt from commission"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-stone-200">
            <table className="w-full border-collapse">
              <caption className="sr-only">
                Recent job requests across the Koronadal City marketplace
              </caption>
              <thead>
                <tr className="bg-bone text-left">
                  {["Request", "Trade", "Barangay", "Status"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-4 py-2.5 font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] font-medium text-stone-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEMO_ROWS.map((row, i) => (
                  <tr
                    key={row.name}
                    className={
                      i % 2 === 1 ? "bg-white" : "bg-bone/40"
                    }
                  >
                    <td className="border-b border-stone-200 px-4 py-3">
                      <span className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
                        {row.name}
                      </span>
                    </td>
                    <td className="border-b border-stone-200 px-4 py-3 text-[12px] text-stone-500">
                      {row.trade}
                    </td>
                    <td className="border-b border-stone-200 px-4 py-3 text-[12px] text-stone-500">
                      {row.place}
                    </td>
                    <td className="border-b border-stone-200 px-4 py-3">
                      <Badge
                        tone={
                          row.tone as "amber" | "coral" | "ember" | "violet" | "neutral"
                        }
                      >
                        {row.tone === "neutral"
                          ? "Settled"
                          : row.tone === "amber"
                            ? "Requested"
                            : row.tone === "coral"
                              ? "Accepted"
                              : row.tone === "ember"
                                ? "Quote sent"
                                : "In progress"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Commission model                                                     */
/* ------------------------------------------------------------------ */

function Commission() {
  return (
    <section id="commission" className="section container-page ">
      <SectionHeader
        eyebrow="Payment model"
        title="A non-custodial 10% commission on labor only"
        description="The platform never handles household funds. Workers settle directly with the client, and fund the commission through a prepaid platform balance."
      />

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-3 p-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-bone text-stone-700">
            <Wallet size={15} strokeWidth={1.5} />
          </span>
          <h3 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
            Direct worker settlement
          </h3>
          <p className="text-[13px] leading-[1.45] text-stone-600">
            100% of the transaction amount is paid straight from the household
            client to the worker via cash or direct GCash transfer.
          </p>
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-bone text-stone-700">
            <ShieldCheck size={15} strokeWidth={1.5} />
          </span>
          <h3 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
            Labor-only commission
          </h3>
          <p className="text-[13px] leading-[1.45] text-stone-600">
            The platform levies a 10% commission strictly on the labor fee.
            Material costs are fully exempt from commission deductions.
          </p>
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-bone text-stone-700">
            <BadgeCheck size={15} strokeWidth={1.5} />
          </span>
          <h3 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
            Prepaid wallet
          </h3>
          <p className="text-[13px] leading-[1.45] text-stone-600">
            On quote approval, 10% of the labor fee locks against the worker
            wallet. It settles on completion. A negative balance pauses new
            requests until the wallet reloads.
          </p>
        </Card>
      </div>

      {/* Worked example, using the same totals() the app runs on. */}
      <Card className="mt-4 overflow-hidden p-0">
        <div className="border-b border-stone-200 px-6 py-4">
          <h3 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
            Worked example &mdash; plumbing repair
          </h3>
          <p className="caption mt-0.5">
            Two-part quotation mandated by RA 7394
          </p>
        </div>

        <dl className="grid sm:grid-cols-4">
          {[
            ["Labor fee", formatPeso(2400), "Subject to 10% commission"],
            ["Material cost", formatPeso(1800), "Pass-through, zero commission"],
            ["Platform commission", formatPeso(240), "10% of labor only"],
            ["Paid to worker", formatPeso(4200), "Cash or GCash, direct"],
          ].map(([label, value, note], i) => (
            <div
              key={label}
              className={
                i > 0
                  ? "border-t border-stone-200 px-6 py-5 sm:border-t-0 sm:border-l"
                  : "px-6 py-5"
              }
            >
              <dt className="font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] text-stone-500">
                {label}
              </dt>
              <dd className="mt-1.5 text-[24px] leading-[1.2] font-medium tracking-[-0.48px] text-ink-black tabular-nums">
                {value}
              </dd>
              <dd className="caption mt-1">{note}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {WALLET_TOPUP_METHODS.map((method) => (
          <Card key={method.id} className="flex items-start gap-3 p-5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-bone text-stone-700">
              <Wallet size={14} strokeWidth={1.5} />
            </span>
            <div>
              <h4 className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
                {method.name}
              </h4>
              <p className="mt-1 text-[13px] leading-[1.4] text-stone-600">
                {method.detail}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Onboarding                                                           */
/* ------------------------------------------------------------------ */

function Onboarding() {
  return (
    <section id="onboarding" className="section container-page ">
      <SectionHeader
        eyebrow="Worker application"
        title="Two pathways into the marketplace"
        description="Inclusivity first, verification second. Workers who prefer in-person assistance and workers with a phone and a camera both end up on equal footing."
      />

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        {ONBOARDING_PATHWAYS.map((pathway) => (
          <Card key={pathway.id} className="flex flex-col gap-4 p-6">
            <div>
              <h3 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
                {pathway.name}
              </h3>
              <p className="mt-2 text-[13px] leading-[1.45] text-stone-600">
                {pathway.detail}
              </p>
            </div>

            <ul className="flex flex-col gap-2 border-t border-stone-200 pt-4">
              {pathway.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-stone-400"
                  />
                  <span className="text-[13px] leading-[1.4] text-stone-700">
                    {point}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/signup?role=worker"
              className="btn-neutral mt-auto w-fit"
            >
              Start registration
              <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          </Card>
        ))}
      </div>

      {/* Credentials table. */}
      <Card className="mt-4 overflow-hidden p-0">
        <div className="border-b border-stone-200 px-6 py-4">
          <h3 className="text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
            Mandatory &amp; optional credentials
          </h3>
          <p className="caption mt-0.5">
            Background check completes within 24&ndash;48 hours
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="bg-bone text-left">
                {["Document type", "Level", "Purpose / verification"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-6 py-2.5 font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] font-medium text-stone-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  label: "Standard Government Photo ID",
                  level: "mandatory",
                  note: "Verification of legal identity (UMID, Driver's License, PhilID, Voter's ID).",
                },
                {
                  label: "Barangay or Police Clearance",
                  level: "mandatory",
                  note: "Screening for legal records and neighborhood standing within the past 6 months.",
                },
                {
                  label: "Letter of Recommendation",
                  level: "mandatory",
                  note: "Written endorsement from a former employer, local community leader, or Barangay Official.",
                },
                {
                  label: "TESDA National Certificate (NC II/III)",
                  level: "optional",
                  note: 'Trade skills certification; grants an official "TESDA Certified" badge on the profile.',
                },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="border-b border-stone-200 px-6 py-4 text-[14px] font-medium tracking-[-0.02em] text-ink-black">
                    {row.label}
                  </td>
                  <td className="border-b border-stone-200 px-6 py-4">
                    <Badge tone={row.level === "mandatory" ? "neutral" : "muted"}>
                      {row.level === "mandatory" ? "Mandatory" : "Optional"}
                    </Badge>
                  </td>
                  <td className="border-b border-stone-200 px-6 py-4 text-[13px] leading-[1.45] text-stone-600">
                    {row.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Referrals                                                            */
/* ------------------------------------------------------------------ */

function Referrals() {
  return (
    <section id="referrals" className="section container-page ">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
        <div>
          <SectionHeader
            eyebrow="Worker referral program"
            title="Single-tier, job-verified, never MLM"
            description="Organic acquisition of vetted tradespeople runs on one mechanic: every registered worker holds a unique 6-character code, and credits only clear once the invited worker finishes a first paid job."
          />
          <ul className="mt-6 flex flex-col gap-4">
            {[
              {
                title: "Incentive structure",
                body: "The referring worker receives score credits for each successful invitee.",
              },
              {
                title: "Unique code issuance",
                body: "Every registered worker is issued a unique 6-character alphanumeric referral code located inside their mobile application dashboard or SMS menu.",
              },
              {
                title: "Qualification rule",
                body: "Credits are automatically disbursed immediately upon the invited worker successfully completing their first job, verified through consumer payment and job status closeout.",
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-2 h-px w-4 shrink-0 bg-stone-400"
                />
                <div>
                  <h3 className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-[1.45] text-stone-600">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* The referral card, rendered as the product would show it. */}
        <Card className="p-6">
          <p className="caption">Your referral code</p>
          <p className="mt-2 text-[32px] leading-none font-medium tracking-[0.12em] text-ink-black tabular-nums">
            K7M2QP
          </p>
          <p className="mt-4 text-[13px] leading-[1.45] text-stone-600">
            Share this code with a fellow trade professional. When their first job
            is completed and settled, credits post automatically.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <StatCard label="Credits earned" value="3" sublabel="Single tier only" />
            <StatCard label="Invites converted" value="3" sublabel="Job-verified" />
          </div>

          <div className="mt-5 border-t border-stone-200 pt-4">
            <p className="caption">
              Rewards are limited to single-tier, job-verified invites. Credits
              never compound down a chain.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Compliance                                                           */
/* ------------------------------------------------------------------ */

function Compliance() {
  return (
    <section id="compliance" className="section container-page ">
      <SectionHeader
        eyebrow="Regulatory alignment"
        title="Built inside the Philippine legal framework"
        description="The platform maintains strict alignment with current legislation to protect both service professionals and household consumers."
      />

      <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-2">
        {COMPLIANCE_FRAMEWORK.map((item) => (
          <article key={item.title} className="flex flex-col gap-2 bg-white p-6">
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
                {item.title}
              </h3>
            </div>
            <p className="caption">{item.subtitle}</p>
            <p className="text-[13px] leading-[1.45] text-stone-600">{item.body}</p>
          </article>
        ))}
      </div>

      <div id="fairness" className="mt-4 grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-3">
        {FAIR_COMPETITION_PRINCIPLES.map((item) => (
          <article key={item.title} className="flex flex-col gap-2 bg-white p-6">
            <h3 className="text-[14px] font-medium tracking-[-0.02em] text-ink-black">
              {item.title}
            </h3>
            <p className="text-[13px] leading-[1.45] text-stone-600">{item.body}</p>
          </article>
        ))}
      </div>

      <div
        id="privacy"
        className="mt-4 rounded-xl border border-stone-200 bg-bone px-6 py-5"
      >
        <p className="max-w-[80ch] text-[13px] leading-[1.5] text-stone-700">
          <span className="font-medium text-ink-black">Privacy by default. </span>
          Personally identifiable information, clearance documents, and contact
          details are encrypted at rest. Direct contact details are masked on
          every public profile and revealed only to counterparties once a job
          request is formally accepted.
        </p>
      </div>

      {/* Coverage summary. */}
      <Card className="mt-4 grid gap-6 p-6 sm:grid-cols-3">
        <div>
          <p className="caption">Barangays covered</p>
          <p className="mt-1 text-[24px] leading-[1.2] font-medium tracking-[-0.48px] text-ink-black tabular-nums">
            {BARANGAYS.length}
          </p>
        </div>
        <div>
          <p className="caption">Trade categories</p>
          <p className="mt-1 text-[24px] leading-[1.2] font-medium tracking-[-0.48px] text-ink-black tabular-nums">
            {CATEGORIES.length}
          </p>
        </div>
        <div>
          <p className="caption">Walk-in service points</p>
          <p className="mt-1 text-[24px] leading-[1.2] font-medium tracking-[-0.48px] text-ink-black tabular-nums">
            2
          </p>
          <p className="caption mt-1">Barangay kiosks &amp; PESO desk</p>
        </div>
      </Card>
    </section>
  );
}