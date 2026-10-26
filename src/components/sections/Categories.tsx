import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/ui";
import { CATEGORIES } from "@/lib/constants";

export function Categories() {
  return (
    <section id="categories" className="section container-page ">
      <SectionHeader
        eyebrow="Scope of work"
        title="Household services from local providers"
        description="Browse the common service groups. Workers can list their specific skills and service rates on their profiles."
      />

      <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-2">
        {CATEGORIES.map((category, index) => (
          <article
            key={category.id}
            className="group relative isolate flex flex-col gap-3 overflow-hidden bg-white p-5 transition-colors hover:bg-bone"
          >
            {category.id === "welding" ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,.94) 38%, rgba(255,255,255,.66) 100%), url('/images/metalwork.webp')",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "100% 100%, 50% 100%",
                  backgroundPosition: "center, right center",
                }}
              />
            ) : null}

            <div className="relative z-10 flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="caption tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="caption">Koronadal City</span>
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
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function shortName(name: string) {
  return name.split(" ")[0].toLowerCase().replace("&", "");
}
