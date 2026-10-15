"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { LoadingBlock } from "@/components/ui";

/**
 * Routes each account to the right place.
 *
 * The role-aware home page shows services to workers and the finder to
 * households. Administrators have their own review queue.
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

    router.replace("/");
  }, [loading, user, role, router]);

  return <LoadingBlock label="Routing to your console" />;
}
