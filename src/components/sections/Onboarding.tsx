import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { ONBOARDING_PATHWAYS } from "@/lib/constants";

export function Onboarding() {
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
