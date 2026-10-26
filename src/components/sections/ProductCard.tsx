import { Badge, Card, SectionHeader, StatCard } from "@/components/ui";
import { JOB_STATUS_META } from "@/lib/constants";

/**
 * Sample rows for the marketing table.
 *
 * These carry a real job `status`, not a badge tone. The label and the tone are
 * both read from JOB_STATUS_META, so this table and the live job cards cannot
 * disagree about what a stage looks like or what it is called.
 */
const DEMO_ROWS = [
  { name: "Rodrigo A.", service: "Carpentry", place: "San Roque", status: "requested" },
  { name: "Marisol T.", service: "Plumbing", place: "Paraiso", status: "accepted" },
  { name: "Jomar P.", service: "Electrical", place: "Magsaysay", status: "quoted" },
  { name: "Elena C.", service: "Roofing", place: "Santo Niño", status: "in_progress" },
  { name: "Danilo R.", service: "Welding", place: "Zone III", status: "completed" },
  { name: "Rodel M.", service: "Painting", place: "Saravia", status: "reviewed" },
] as const;

export function LiveProductCard() {
  return (
    <section className="section container-page ">
      <SectionHeader
        eyebrow="Marketplace operations"
        title="Every request, tracked to completion"
        description="The worker console shows requests, agreement confirmations, active jobs, and completed work in one place."
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
            <Badge tone="neutral">In-app requests</Badge>
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
            <StatCard label="Accepted clients" value="7" sublabel="Agreed to work together" />
            <StatCard label="Jobs in progress" value="3" sublabel="Confirmed in chat" />
            <StatCard label="Completed jobs" value="31" sublabel="Kept in worker history" />
          </div>

          <div className="overflow-hidden rounded-xl border border-stone-200">
            <table className="w-full border-collapse">
              <caption className="sr-only">
                Recent job requests across the Koronadal City marketplace
              </caption>
              <thead>
                <tr className="bg-bone text-left">
                  {["Request", "Service", "Barangay", "Status"].map((h) => (
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
                      {row.service}
                    </td>
                    <td className="border-b border-stone-200 px-4 py-3 text-[12px] text-stone-500">
                      {row.place}
                    </td>
                    <td className="border-b border-stone-200 px-4 py-3">
                      <Badge
                        tone={JOB_STATUS_META[row.status].tone}
                      >
                        {JOB_STATUS_META[row.status].label}
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
