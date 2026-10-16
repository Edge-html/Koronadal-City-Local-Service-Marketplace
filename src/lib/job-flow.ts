import type { Job } from "@/lib/types";

export type JobView = "customer" | "worker";
export type JobFilter = "all" | "action" | "waiting" | "active" | "history";

export function needsAction(job: Job, view: JobView): boolean {
  return view === "customer"
    ? job.status === "quoted" || (job.status === "completed" && !!job.settledAt)
    : ["requested", "accepted"].includes(job.status) || (job.status === "completed" && !job.settledAt);
}

export function jobGroup(job: Job, view: JobView): JobFilter {
  if (needsAction(job, view)) return "action";
  if (job.status === "in_progress") return "active";
  if (["reviewed", "cancelled"].includes(job.status) || (view === "worker" && job.status === "completed" && !!job.settledAt)) return "history";
  return "waiting";
}

export function nextStep(job: Job, view: JobView): { title: string; detail: string } {
  const worker = view === "worker";
  switch (job.status) {
    case "requested": return worker
      ? { title: "1. Respond to this request", detail: "Read the job details, then accept if you are available. Accepting reveals contact details." }
      : { title: "1. Waiting for the worker", detail: "Your request is sent. When the worker accepts, their contact details will appear here." };
    case "accepted": return worker
      ? { title: "2. Send your quote", detail: "Discuss the work with the customer, then enter labor and materials costs. Wait for approval before starting." }
      : { title: "2. Waiting for a quote", detail: "The worker accepted. Contact them to discuss the work. Their quote will appear here automatically." };
    case "quoted": return worker
      ? { title: "3. Waiting for approval", detail: "Your quote has been sent. The customer must approve it before work starts." }
      : { title: "3. Review and approve the quote", detail: "Check the labor, materials, and total below. Approve if you agree, or contact the worker to discuss it." };
    case "in_progress": return worker
      ? { title: "4. Complete the agreed work", detail: "The customer approved your quote. Arrange the work with them, then mark it complete when finished." }
      : { title: "4. Work is in progress", detail: "Your quote is approved. Coordinate the schedule with your worker and pay them directly when the work is done." };
    case "completed": return job.settledAt
      ? worker
        ? { title: "5. All done", detail: "Commission is settled. The customer can now leave a review." }
        : { title: "5. Leave a review", detail: "The job is complete. Share your experience to help other customers choose a worker." }
      : worker
        ? { title: "5. Settle the platform commission", detail: "The work is complete. Use Settle commission below to finish the job and unlock the customer's review." }
        : { title: "5. Waiting for the worker to finish settlement", detail: "Pay the worker directly if you have not yet paid. Reviews open once they settle the platform commission." };
    case "reviewed": return { title: "Job finished", detail: "The work and review are complete. This request is kept in your history." };
    case "cancelled": return { title: "Request declined", detail: worker ? "This request is closed. No further action is needed." : "The worker was unavailable. Find another worker to send a new request." };
    case "disputed": return { title: "Under admin review", detail: "A dispute has been recorded. Keep your agreement and payment records available for follow-up." };
    default: return { title: "Request update", detail: "Check the current status before taking action." };
  }
}

export function visibleJobs(jobs: Job[], view: JobView, filter: JobFilter) {
  const priority: Record<JobFilter, number> = { action: 0, active: 1, waiting: 2, history: 3, all: 4 };
  return jobs.filter((job) => filter === "all" || jobGroup(job, view) === filter)
    .sort((a, b) => priority[jobGroup(a, view)] - priority[jobGroup(b, view)] || b.requestedAt.localeCompare(a.requestedAt));
}
