import type { Job } from "@/lib/types";

export type JobView = "customer" | "worker";
export type JobFilter = "all" | "action" | "waiting" | "active" | "history";

export function needsAction(job: Job, view: JobView): boolean {
  return view === "customer"
    ? ((job.status === "accepted" || job.status === "quoted") && !job.consumerAgreedAt)
      || (job.status === "completed" && Boolean(job.agreementApprovedAt && !job.rating))
    : job.status === "requested"
      || ((job.status === "accepted" || job.status === "quoted") && !job.workerAgreedAt);
}

export function jobGroup(job: Job, view: JobView): JobFilter {
  if (needsAction(job, view)) return "action";
  if (job.status === "in_progress") return "active";
  if (["reviewed", "cancelled"].includes(job.status) || (view === "worker" && job.status === "completed")) return "history";
  return "waiting";
}

export function nextStep(job: Job, view: JobView): { title: string; detail: string } {
  const worker = view === "worker";
  switch (job.status) {
    case "requested": return worker
      ? { title: "1. Respond to this request", detail: "Read the job details, then accept if you are available. Accepting reveals contact details." }
      : { title: "1. Waiting for the worker", detail: "Your request is sent. When the worker accepts, their contact details will appear here." };
    case "accepted": return worker
      ? job.workerAgreedAt
        ? { title: "2. Waiting for the household", detail: "You confirmed the plan in chat. The household must confirm too before the job starts." }
        : { title: "2. Agree in chat", detail: "Discuss the job scope, total price, timing, and payment in your private chat. Confirm only when you both agree." }
      : job.consumerAgreedAt
        ? { title: "2. Waiting for the worker", detail: "You confirmed the plan in chat. The worker must confirm too before the job starts." }
        : { title: "2. Agree in chat", detail: "Discuss the job scope, total price, timing, and payment in your private chat. Confirm only when you both agree." };
    case "quoted": return worker
      ? { title: "Confirm the chat agreement", detail: "This request has an older quote. Confirm the current plan together in chat before starting." }
      : { title: "Confirm the chat agreement", detail: "This request has an older quote. Confirm the current plan together in chat before starting." };
    case "in_progress": return worker
      ? { title: "4. Complete the agreed work", detail: "Both of you confirmed the plan in chat. Coordinate the schedule, then mark the work complete." }
      : { title: "4. Work is in progress", detail: "Both of you confirmed the plan in chat. Coordinate the schedule and settle the agreed payment directly with the worker." };
    case "completed": return worker
      ? { title: "5. All done", detail: "This job is complete. The household can leave a review." }
      : { title: "5. Leave a review", detail: "The job is complete. Share your experience to help other customers choose a worker." };
    case "reviewed": return { title: "Job finished", detail: "The work and review are complete. This request is kept in your history." };
    case "cancelled": return { title: "Request declined", detail: worker ? "This request is closed. No further action is needed." : "The worker was unavailable. Find another worker to send a new request." };
    case "disputed": return { title: "Under admin review", detail: "A dispute has been recorded. Keep your agreement and payment records available for follow-up." };
    default: return { title: "Request update", detail: "Check the current status before taking action." };
  }
}

export function visibleJobs(jobs: Job[], view: JobView, filter: JobFilter) {
  const priority: Record<JobFilter, number> = { action: 0, active: 1, waiting: 2, history: 3, all: 4 };
  return jobs.filter((job) => filter === "all"
    ? view !== "worker" || jobGroup(job, view) !== "history"
    : jobGroup(job, view) === filter)
    .sort((a, b) => priority[jobGroup(a, view)] - priority[jobGroup(b, view)] || b.requestedAt.localeCompare(a.requestedAt));
}
