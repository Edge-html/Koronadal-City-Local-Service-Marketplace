"use client";

import { FileText, GraduationCap, Phone, AtSign } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { Worker } from "@/lib/types";

/**
 * Read-only resume summary on the public worker profile.
 *
 * Households decide who to book from this page, so the resume sits here rather
 * than buried in a dashboard. Phone stays masked until a request is accepted,
 * which is the Data Privacy Act requirement and is not relaxed just because a
 * resume is attached.
 */
export function ResumeSummary({ worker }: { worker: Worker }) {
  const resume = worker.resume;
  if (!resume) return null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-6 py-4">
        <h2 className="flex items-center gap-2 text-[18px] leading-[1.3] font-medium tracking-[-0.36px] text-ink-black">
          <FileText size={16} strokeWidth={1.5} />
          Resume
        </h2>
        <span className="caption">
          Uploaded {formatDate(resume.uploadedAt)}
        </span>
      </div>

      <div className="flex flex-col gap-5 px-6 py-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          {resume.fullName ? (
            <div>
              <dt className="caption">Name</dt>
              <dd className="mt-0.5 text-[14px] tracking-[-0.02em] text-ink-black">
                {resume.fullName}
              </dd>
            </div>
          ) : null}

          {resume.yearsExperience ? (
            <div>
              <dt className="caption">Experience</dt>
              <dd className="mt-0.5 text-[14px] tracking-[-0.02em] text-ink-black tabular-nums">
                {resume.yearsExperience} years
              </dd>
            </div>
          ) : null}

          {resume.email ? (
            <div className="flex items-start gap-2">
              <AtSign
                size={13}
                strokeWidth={1.5}
                className="mt-1 shrink-0 text-stone-400"
              />
              <div>
                <dt className="caption">Email</dt>
                <dd className="mt-0.5 text-[14px] tracking-[-0.02em] text-ink-black break-all">
                  {resume.email}
                </dd>
              </div>
            </div>
          ) : null}

          {resume.phone ? (
            <div className="flex items-start gap-2">
              <Phone
                size={13}
                strokeWidth={1.5}
                className="mt-1 shrink-0 text-stone-400"
              />
              <div>
                <dt className="caption">Mobile</dt>
                <dd className="mt-0.5 text-[14px] tracking-[-0.02em] text-ink-black">
                  {maskPhone(resume.phone)}
                </dd>
              </div>
            </div>
          ) : null}
        </dl>

        {resume.skills.length ? (
          <div>
            <p className="caption">Skills</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {resume.skills.map((skill) => (
                <li key={skill}>
                  <Badge tone="neutral">{skill}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {resume.certifications.length ? (
          <div>
            <p className="caption">Credentials mentioned</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {resume.certifications.map((cert) => (
                <li key={cert}>
                  <Badge tone="muted" icon={<GraduationCap size={10} strokeWidth={1.5} />}>
                    {cert}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="caption border-t border-stone-200 pt-4">
          Details supplied by the worker from their uploaded resume
          ({resume.fileName}).
        </p>
      </div>
    </Card>
  );
}

/** Contact masking stays in force on a public profile, resume or not. */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "•••• ••••";
  return `••• ••• ${digits.slice(-4)}`;
}