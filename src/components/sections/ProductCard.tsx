import { Badge, Card, SectionHeader, StatCard } from "@/components/ui";
import { formatPeso } from "@/lib/commission";

const DEMO_ROWS = [
  { name: "Rodrigo A.", trade: "Carpentry", place: "Baras", tone: "amber" },
  { name: "Marisol T.", trade: "Plumbing", place: "Banga", tone: "coral" },
  { name: "Jomar P.", trade: "Electrical", place: "Gabi", tone: "ember" },
  { name: "Elena C.", trade: "Roofing", place: "Lemoy", tone: "violet" },
  { name: "Danilo R.", trade: "Welding", place: "Ecol", tone: "neutral" },
  { name: "Rodel M.", trade: "Painting", place: "Saravia", tone: "amber" },
] as const;

export function LiveProductCard() {
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
