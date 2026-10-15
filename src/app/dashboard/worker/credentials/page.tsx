"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { ActionButton } from "@/components/JobCard";
import { Card, Notice } from "@/components/ui";
import { uploadCredential } from "@/lib/credentials";
import { resubmitCredentials } from "@/lib/data";
import { DOC_TYPES, type DocType } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

const REQUIRED: DocType[] = ["government_id", "barangay_clearance", "recommendation_letter"];
const TYPES: DocType[] = [...REQUIRED, "tesda_certificate"];

export default function CredentialsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<Partial<Record<DocType, File>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!user || !REQUIRED.every((type) => files[type])) return;
    setBusy(true);
    setError("");
    try {
      const credentials = await Promise.all(TYPES.filter((type) => files[type]).map(async (type) => ({
        type,
        fileName: files[type]!.name,
        fileUrl: await uploadCredential(files[type]!),
        uploadedAt: new Date().toISOString(),
        reviewState: "pending" as const,
      })));
      await resubmitCredentials(credentials);
      router.push("/dashboard/worker");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit documents.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell eyebrow="Worker console" title="Submit credentials"
      subtitle="Upload fresh documents for the administrator's review.">
      <div className="mx-auto max-w-2xl space-y-4">
        {error ? <Notice tone="alert">{error}</Notice> : null}
        <Card className="space-y-4 p-5">
          <p className="text-[13px] leading-[1.5] text-stone-600">
            Older uploads saved as temporary browser links cannot be opened after that session.
            Upload all three required files again. Each file must be a PDF or image under 4 MB.
          </p>
          {TYPES.map((type) => (
            <div key={type}>
              <label className="label" htmlFor={type}>
                {DOC_TYPES[type].label} {DOC_TYPES[type].requirement === "mandatory" ? "(required)" : "(optional)"}
              </label>
              <input id={type} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                className="field" onChange={(event) => {
                  const file = event.target.files?.[0];
                  setFiles((current) => ({ ...current, [type]: file }));
                }} />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <ActionButton onClick={submit} busy={busy}
              disabled={loading || !user || !REQUIRED.every((type) => files[type])}>
              Submit for review
            </ActionButton>
            <Link href="/dashboard/worker" className="btn-neutral no-underline">Back to dashboard</Link>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
