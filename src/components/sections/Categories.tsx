import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/ui";
import { CATEGORIES } from "@/lib/constants";
import { formatPeso } from "@/lib/commission";

export function Categories() {
  return (
    <section id="categories" className="section container-page ">
      <SectionHeader
        eyebrow="Scope of work"
        title="Ten essential household service categories"
        description="Each service carries its own scope of work, typical use cases, and a monitored price floor that keeps quoting fair on both sides of the transaction."
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
