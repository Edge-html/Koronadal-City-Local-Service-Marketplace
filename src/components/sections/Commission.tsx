import { BadgeCheck, ShieldCheck, Wallet } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui";
import { WALLET_TOPUP_METHODS } from "@/lib/constants";
import { formatPeso } from "@/lib/commission";

export function Commission() {
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
