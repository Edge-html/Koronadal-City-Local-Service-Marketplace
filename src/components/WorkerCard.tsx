import Link from "next/link";
import { Avatar, Badge, StarRating } from "@/components/ui";
import { CATEGORY_MAP } from "@/lib/constants";
import { formatPeso } from "@/lib/commission";
import type { Worker } from "@/lib/types";

/**
 * Directory entry for one worker.
 *
 * Lives in its own file because two surfaces render it: the full /browse
 * directory with its filter rail, and the "Find a worker" section on the home
 * page. A card that looks one way in the directory and another on the home
 * page would read as two products.
 */
export function WorkerCard({ worker }: { worker: Worker }) {
  const trade = CATEGORY_MAP[worker.categoryId];

  return (
    <li>
      <Link
        href={`/worker/${worker.id}`}
        className="card flex h-full flex-col gap-3 p-5 no-underline transition-colors hover:bg-bone"
      >
        <div className="flex items-start gap-3">
          <Avatar name={worker.fullName} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[16px] leading-[1.3] font-medium tracking-[-0.32px] text-ink-black">
                {worker.fullName}
              </h3>
              {worker.verified ? (
                <Badge tone="verified" className="shrink-0">
                  Verified
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[13px] text-stone-600">
              {trade?.name ?? "General"}
            </p>
          </div>
        </div>

        <StarRating value={worker.rating} count={worker.reviewCount} />

        <dl className="grid grid-cols-2 gap-2 border-t border-stone-200 pt-3">
          <div>
            <dt className="caption">Barangay</dt>
            <dd className="text-[13px] text-stone-700">{worker.barangay}</dd>
          </div>
          <div>
            <dt className="caption">Experience</dt>
            <dd className="text-[13px] text-stone-700 tabular-nums">
              {worker.yearsExperience} yrs
            </dd>
          </div>
          <div>
            <dt className="caption">From</dt>
            <dd className="text-[13px] text-stone-700 tabular-nums">
              {formatPeso(worker.hourlyRate)}/hr
            </dd>
          </div>
          <div>
            <dt className="caption">Jobs done</dt>
            <dd className="text-[13px] text-stone-700 tabular-nums">
              {worker.jobsCompleted}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {worker.tesdaCertified ? (
            <Badge tone="neutral">TESDA Certified</Badge>
          ) : null}
          {worker.walletBalance < 0 ? (
            <Badge tone="muted">Wallet paused</Badge>
          ) : null}
        </div>
      </Link>
    </li>
  );
}