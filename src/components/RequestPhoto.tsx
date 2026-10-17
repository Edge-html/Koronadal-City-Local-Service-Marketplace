"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getFirebaseAuth } from "@/lib/firebase";

export function RequestPhoto({ jobId, path, legacyUrl }: { jobId: string; path?: string; legacyUrl?: string }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    if (!path) {
      if (legacyUrl && /^https?:\/\//i.test(legacyUrl)) setSrc(legacyUrl);
      return () => undefined;
    }
    setFailed(false);
    setSrc("");
    (async () => {
      try {
        const token = await getFirebaseAuth().currentUser?.getIdToken();
        if (!token) throw new Error("Sign in to view this photo.");
        const query = new URLSearchParams({ jobId, path });
        const response = await fetch(`/api/request-files?${query}`, { headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("Photo unavailable.");
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [jobId, path, legacyUrl]);

  if (failed) return <p className="caption">Issue photo could not be loaded.</p>;
  if (!src) return path ? <p className="caption">Loading issue photo…</p> : null;
  return <Image src={src} alt="Photo of the reported issue" width={800} height={600} unoptimized className="max-h-72 w-auto max-w-full rounded-md border border-stone-200 object-contain" />;
}

