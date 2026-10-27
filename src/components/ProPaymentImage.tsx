"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { loadProPaymentImage } from "@/lib/pro-payment-files";

export function ProPaymentImage({ path, alt, className = "" }: { path: string; alt: string; className?: string }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setSrc("");
    setFailed(false);
    loadProPaymentImage(path).then((url) => {
      objectUrl = url;
      if (active) setSrc(url);
      else URL.revokeObjectURL(url);
    }).catch(() => { if (active) setFailed(true); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (failed) return <div className={`flex items-center justify-center rounded-lg bg-stone-100 p-4 text-center text-xs text-stone-500 ${className}`}>Could not load image</div>;
  if (!src) return <div className={`animate-pulse rounded-lg bg-stone-100 ${className}`} aria-label="Loading image" />;
  return <Image src={src} alt={alt} width={640} height={640} unoptimized className={className} />;
}

export function ProPaymentImagePreview({ file, alt, className = "" }: { file: File; alt: string; className?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return src ? <Image src={src} alt={alt} width={640} height={640} unoptimized className={className} /> : null;
}
