"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import { toJob } from "@/lib/data";
import { needsAction } from "@/lib/job-flow";
import type { Job } from "@/lib/types";

type Activity = {
  customerJobs: Job[] | null;
  workerJobs: Job[] | null;
  customerError: string;
  workerError: string;
  adminError: string;
  admin: { workers: number; disputes: number };
  adminDisputes: Job[];
  adminRevision: number;
};
const empty: Activity = {
  customerJobs: null, workerJobs: null, customerError: "", workerError: "", adminError: "",
  admin: { workers: 0, disputes: 0 }, adminDisputes: [], adminRevision: 0,
};
const ActivityContext = createContext<Activity>(empty);

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  // Keying the subscription owner prevents the previous account's data from
  // appearing for even one render when signing out or switching accounts.
  return <ActivitySession key={`${user?.uid ?? "guest"}:${role}:${loading}`} uid={!loading && role ? user?.uid : undefined} role={role}>
    {children}
  </ActivitySession>;
}

function ActivitySession({ children, uid, role }: { children: ReactNode; uid?: string; role: string | null }) {
  const [state, setState] = useState<Activity>(empty);
  useEffect(() => {
    if (!uid || !role) return;
    const db = getFirebaseDb();
    const unsubscribes: (() => void)[] = [];
    let active = true;
    const watchJobs = (field: "consumerId" | "workerUid", key: "customerJobs" | "workerJobs", errorKey: "customerError" | "workerError") => {
      unsubscribes.push(onSnapshot(query(collection(db, "jobs"), where(field, "==", uid)), (snapshot) => {
        if (!active) return;
        const jobs = snapshot.docs.map((d) => toJob(d.id, d.data())).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
        setState((s) => ({ ...s, [key]: jobs, [errorKey]: "" }));
      }, () => {
        if (active) setState((s) => ({ ...s, [errorKey]: "Live updates are unavailable. Refresh to reconnect before taking action." }));
      }));
    };
    if (role !== "admin") watchJobs("consumerId", "customerJobs", "customerError");
    if (role === "worker") watchJobs("workerUid", "workerJobs", "workerError");
    if (role === "admin") {
      const queues = [
        ["workers", "pending_verification", "workers"],
        ["jobs", "disputed", "disputes"],
      ] as const;
      queues.forEach(([name, status, key]) => {
        unsubscribes.push(onSnapshot(query(collection(db, name), where("status", "==", status)), (snapshot) => {
          if (active) setState((s) => ({
            ...s, admin: { ...s.admin, [key]: snapshot.size },
            adminDisputes: key === "disputes" ? snapshot.docs.map((d) => toJob(d.id, d.data())) : s.adminDisputes,
            adminRevision: s.adminRevision + 1,
          }));
        }, () => {
          if (active) setState((s) => ({ ...s, adminError: "Live review counts are unavailable. Refresh to reconnect." }));
        }));
      });
    }
    return () => { active = false; unsubscribes.forEach((unsubscribe) => unsubscribe()); };
  }, [uid, role]);
  return <ActivityContext.Provider value={state}>{children}</ActivityContext.Provider>;
}

export function useActivity() {
  const state = useContext(ActivityContext);
  return {
    ...state,
    customerCount: state.customerError ? 0 : (state.customerJobs ?? []).filter((j) => needsAction(j, "customer")).length,
    workerCount: state.workerError ? 0 : (state.workerJobs ?? []).filter((j) => needsAction(j, "worker")).length,
    adminCount: state.adminError ? 0 : Object.values(state.admin).reduce((total, count) => total + count, 0),
  };
}
