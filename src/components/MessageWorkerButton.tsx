"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getOrCreateConversation } from "@/lib/data";
import type { Worker } from "@/lib/types";

export function MessageWorkerButton({ worker }: { worker: Worker }) {
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!user) return <Link href={`/login?next=${encodeURIComponent(`/worker/${worker.id}`)}`} className="btn-neutral w-full no-underline"><MessageSquare size={14} />Sign in to message</Link>;
  if (user.uid === worker.uid) return null;

  return <div>
    <button type="button" className="btn-neutral w-full" disabled={busy} onClick={async () => {
      setBusy(true); setError("");
      try {
        const id = await getOrCreateConversation(worker, { id: user.uid, name: user.displayName || user.email || "Household" });
        router.push(`/dashboard/messages?conversation=${encodeURIComponent(id)}`);
      } catch (err) { setError(err instanceof Error ? err.message : "Could not open a conversation."); }
      finally { setBusy(false); }
    }}><MessageSquare size={14} />{busy ? "Opening…" : "Message this worker"}</button>
    {error ? <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p> : null}
  </div>;
}
