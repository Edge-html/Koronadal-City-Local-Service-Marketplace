"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { LoadingBlock } from "@/components/ui";

/**
 * Routes each account to the right place.
 *
 * `/` already decides between the two consoles by mode, so there is nothing
 * for this page to render except a redirect. Workers are pointed at the full
 * lifecycle console rather than at `/`, because "My jobs" on the home page is a
 * shortlist for clearing incoming requests; `/dashboard/worker` is where
 * quoting, completion and settlement happen.
 */
export default function DashboardPage() {
  const { user, role, mode, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=/dashboard");
      return;
    }
    if (role === "admin") {
      router.replace("/admin");
      return;
    }

    router.replace(mode === "worker" && role === "worker" ? "/dashboard/worker" : "/");
  }, [loading, user, role, mode, router]);

  return <LoadingBlock label="Routing to your console" />;
}