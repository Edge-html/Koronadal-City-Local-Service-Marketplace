import type { Worker } from "@/lib/types";

export type ProfileStrengthItem = {
  key: string;
  label: string;
  weight: number;
  complete: boolean;
  href: string;
  action: string;
};

export function getProfileStrength(worker: Worker): ProfileStrengthItem[] {
  const hasPortfolio = worker.portfolio.length > 0;
  const hasPortfolioPhoto = worker.portfolio.some((entry) => entry.beforeUrl || entry.afterUrl || entry.beforePath || entry.afterPath);
  return [
    { key: "photo", label: "Add a profile photo", weight: 15, complete: Boolean(worker.photoUrl?.trim()), href: "/dashboard/worker/profile", action: "Add photo" },
    { key: "bio", label: "Write a short introduction (80+ characters)", weight: 15, complete: worker.bio.trim().length >= 80, href: "/dashboard/worker/profile", action: "Edit profile" },
    { key: "skills", label: "Select at least 3 skills", weight: 15, complete: worker.skills.length >= 3, href: "/dashboard/worker/profile#resume-skills", action: "Add skills" },
    { key: "resume", label: "Upload a resume", weight: 15, complete: Boolean(worker.resume?.fileName || worker.resume?.fileUrl), href: "/dashboard/worker/profile#resume-skills", action: "Upload resume" },
    { key: "portfolio", label: "Add a completed job to your portfolio", weight: 10, complete: hasPortfolio, href: "/dashboard/worker/profile#portfolio", action: "Add work sample" },
    { key: "portfolio-photo", label: "Include a before or after photo", weight: 10, complete: hasPortfolioPhoto, href: "/dashboard/worker/profile#portfolio", action: "Add photos" },
    { key: "work-details", label: "Set your service rate, expertise and work area", weight: 10, complete: Boolean(worker.serviceRate > 0 && worker.barangay.trim() && (worker.specialtyDescription?.trim().length ?? 0) >= 2), href: "/dashboard/worker/profile", action: "Review details" },
    { key: "verification", label: "Get your credentials approved", weight: 10, complete: worker.verified, href: "/dashboard/worker/credentials", action: "View verification" },
  ];
}

