"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  firebaseConfigured,
  getFirebaseAuth,
  getFirebaseDb,
} from "@/lib/firebase";
import type { Role } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  profile: Record<string, unknown> | null;
  loading: boolean;
  /** True when the deployment is missing its NEXT_PUBLIC_FIREBASE_* values. */
  unconfigured: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: Role,
    phone?: string,
  ) => Promise<User>;
  signIn: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [unconfigured, setUnconfigured] = useState(!firebaseConfigured);
  const router = useRouter();

  /** Mirror the Firestore user document into React state. */
  const attachProfile = useCallback((uid: string) => {
    const ref = doc(getFirebaseDb(), "users", uid);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>;
        setProfile(data);
        setRole((data.role as Role) ?? null);
      } else {
        setProfile(null);
        setRole(null);
      }
    });
  }, []);

  useEffect(() => {
    let detach: (() => void) | undefined;

    // An unconfigured deployment must not throw inside an effect: React treats
    // that as an unhandled render error and unmounts the whole tree, so a
    // missing env var would white-screen the marketing site rather than just
    // disabling sign-in.
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), (next) => {
        if (next) {
          detach?.();
          detach = attachProfile(next.uid);
        } else {
          setProfile(null);
          setRole(null);
        }
        setUser(next);
        setLoading(false);
      });
    } catch (err) {
      // Expected and handled: the UI switches to preview mode. Logged as a
      // warning so the console carries the diagnosis without implying a fault.
      console.warn("[auth] Firebase unavailable, continuing without auth:", err);
      setUnconfigured(true);
      setLoading(false);
      return;
    }

    return () => {
      unsubscribe?.();
      detach?.();
    };
  }, [attachProfile]);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      nextRole: Role,
      phone?: string,
    ) => {
      const auth = getFirebaseAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: fullName });
      await setDoc(doc(getFirebaseDb(), "users", cred.user.uid), {
        uid: cred.user.uid,
        fullName,
        email,
        phone: phone ?? "",
        role: nextRole,
        createdAt: new Date().toISOString(),
      });
      return cred.user;
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      email,
      password,
    );
    return cred.user;
  }, []);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
    router.push("/");
  }, [router]);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) attachProfile(user.uid);
  }, [user, attachProfile]);

  const value = useMemo(
    () => ({
      user,
      role,
      profile,
      loading,
      unconfigured,
      signUp,
      signIn,
      logout,
      resetPassword,
      refreshProfile,
    }),
    [
      user,
      role,
      profile,
      loading,
      unconfigured,
      signUp,
      signIn,
      logout,
      resetPassword,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}