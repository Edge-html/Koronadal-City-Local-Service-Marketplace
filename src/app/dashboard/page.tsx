"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { LoadingBlock } from "@/components/ui";

/** Routes each role to the console that actually applies to them. */
export default function DashboardPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=/dashboard");
      return;
    }
    if (role === "admin") router.replace("/admin");
    else if (role === "worker") router.replace("/dashboard/worker");
    else router.replace("/dashboard/customer");
  }, [loading, user, role, router]);

  return <LoadingBlock label="Routing to your console" />;
}