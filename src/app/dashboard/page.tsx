"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { LoadingBlock } from "@/components/ui";

/**
 * Routes each account to the right place.
 *
 * Worker accounts open the worker console; household accounts open the worker
 * finder on `/`. Workers can still browse and manage their own household
 * requests through explicit links.
 */
export default function DashboardPage() {
  const { user, role, loading } = useAuth();
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

    if (!role) return;

    router.replace(role === "worker" ? "/dashboard/worker" : "/");
  }, [loading, user, role, router]);

  return <LoadingBlock label="Routing to your console" />;
}
