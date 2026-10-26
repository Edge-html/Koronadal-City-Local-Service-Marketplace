import { Card, SectionHeader, StatCard } from "@/components/ui";

export function Referrals() {
  return (
    <section id="referrals" className="section container-page ">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
        <div>
          <SectionHeader
            eyebrow="Worker referral program"
            title="Single-tier referrals, tied to completed work"
            description="Workers can share a unique code. A referral credit is added after the invited worker completes their first job."
          />
          <ul className="mt-6 flex flex-col gap-4">
            {[
              {
                title: "Incentive structure",
                body: "The referring worker receives score credits for each successful invitee.",
              },
              {
                title: "Unique code issuance",
                body: "Every registered worker is issued a unique 6-character alphanumeric referral code in their worker dashboard.",
              },
              {
                title: "Qualification rule",
                body: "A credit is added after the invited worker's first completed job. No wallet top-up or payment proof is required.",
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
            Share this code with a fellow service professional. When their first job
            is completed, one referral credit posts automatically.
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
