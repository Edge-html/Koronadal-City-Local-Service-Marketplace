import { BadgeCheck, MessageCircle, Sparkles } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui";

export function Commission() {
  return <section id="commission" className="section container-page">
    <SectionHeader eyebrow="Simple service terms" title="Agree on the details together" description="KoroHanap connects local households and service providers. The people doing the work decide the exact scope, rate, schedule, and payment method directly." />
    <div className="mt-10 grid gap-4 lg:grid-cols-3">
      <Card className="flex flex-col gap-3 p-6"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-800"><MessageCircle size={16} /></span><h3 className="text-lg font-medium">Discuss in private chat</h3><p className="text-sm leading-relaxed text-stone-600">Clarify what the job includes, the service rate, timing, materials, and payment method in the job conversation.</p></Card>
      <Card className="flex flex-col gap-3 p-6"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-800"><BadgeCheck size={16} /></span><h3 className="text-lg font-medium">Both confirm before work</h3><p className="text-sm leading-relaxed text-stone-600">The worker and household each confirm the agreed plan in chat. Work moves to in progress after both confirm.</p></Card>
      <Card className="flex flex-col gap-3 p-6"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-800"><Sparkles size={16} /></span><h3 className="text-lg font-medium">Optional Pro profile</h3><p className="text-sm leading-relaxed text-stone-600">Workers may turn on Pro for a profile badge and highlighted placement. It is free during the pilot; the app does not collect payment details.</p></Card>
    </div>
    <Card className="mt-4 p-5"><p className="text-sm leading-relaxed text-stone-600">KoroHanap does not require a wallet top-up, charge a job commission, or process payments. Households pay workers directly using the method both sides choose.</p></Card>
  </section>;
}
