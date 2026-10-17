"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { ProfilePhotoEditor } from "@/components/ProfilePhotoEditor";
import { useAuth } from "@/context/AuthContext";

export default function CustomerProfilePage() {
  const { user, profile } = useAuth();
  const name = typeof profile?.fullName === "string" ? profile.fullName : user?.displayName || "Customer";
  const photoUrl = typeof profile?.photoUrl === "string" ? profile.photoUrl : "";
  return <DashboardShell eyebrow="Customer account" title="My profile" subtitle="Manage the photo shown with your requests.">
    {user ? <ProfilePhotoEditor name={name} photoUrl={photoUrl} onSaved={() => undefined} /> : <p className="meta">Sign in to edit your profile.</p>}
  </DashboardShell>;
}
