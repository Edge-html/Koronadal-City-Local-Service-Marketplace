"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
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
  /** Set when the session is valid but its profile record could not be read. */
  profileError: string | null;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: Role,
    phone?: string,
  ) => Promise<User>;
  signIn: (email: string, password: string) => Promise<User>;
  /** Upgrade the signed-in household account to a worker account. */
  becomeWorker: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [unconfigured, setUnconfigured] = useState(!firebaseConfigured);
  const [profileError, setProfileError] = useState<string | null>(null);
  const router = useRouter();

  /**
   * Mirror the Firestore user document into React state.
   *
   * The error callback is not optional. Firestore reports listener failures
   * through this third argument; with only a success handler the rejection
   * escapes as an uncaught error, React unmounts the tree, and a denied read
   * takes down the entire app instead of merely leaving the session without a
   * role.
   */
  const attachProfile = useCallback((uid: string, onResolved?: () => void) => {
    const authDisplayName = getFirebaseAuth().currentUser?.displayName;
    const authEmail = getFirebaseAuth().currentUser?.email;
    let ref;
    try {
      ref = doc(getFirebaseDb(), "users", uid);
    } catch (err) {
      // Unconfigured deployment; preview mode already covers the UI.
      console.warn("[auth] Firestore unavailable:", err);
      setUnconfigured(true);
      onResolved?.();
      return undefined;
    }

    return onSnapshot(
      ref,
      (snap) => {
        onResolved?.();
        setProfileError(null);
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          setProfile(data);
          setRole((data.role as Role) ?? null);
        } else {
          /**
           * Signed in, but no user document.
           *
           * The rules resolve the caller's role from this document, so a
           * missing one makes every role-gated operation fail closed with
           * permission-denied and the account looks broken: job requests
           * rejected, "my requests" unreadable. Accounts reach this state by
           * being created outside the signup form, or by a signup whose
           * document write failed after the auth account already existed.
           *
           * Recreate at the least-privileged role. Anything more specific
           * would be a guess, and guessing upward is how an account gains
           * powers it was never granted.
           */
          console.warn(
            "[auth] no user document; recreating as customer",
          );
          setDoc(doc(getFirebaseDb(), "users", uid), {
            uid,
            fullName: authDisplayName ?? "",
            email: authEmail ?? "",
            phone: "",
            role: "customer",
            createdAt: new Date().toISOString(),
            repairedAt: new Date().toISOString(),
          }).catch((repairError) => {
            console.error("[auth] could not recreate user document:", repairError);
            setProfileError(
              "This account has no profile record and it could not be recreated. The Firestore rules may be blocking it.",
            );
          });
          setProfile(null);
          setRole(null);
        }
      },
      (err) => {
        onResolved?.();
        console.warn("[auth] profile read failed:", err);
        setProfile(null);
        setRole(null);

        const code = (err as { code?: string })?.code ?? "";
        if (code === "permission-denied") {
          setProfileError(
            "Signed in, but this account's profile record could not be read. The Firestore rules deployed for this project may not match this app.",
          );
        } else if (code === "unavailable") {
          setProfileError(
            "Could not reach the database. Check your connection.",
          );
        }
      },
    );
  }, []);

  useEffect(() => {
    let detach: (() => void) | undefined;
    let profileTimeout: ReturnType<typeof setTimeout> | undefined;

    // An unconfigured deployment must not throw inside an effect: React treats
    // that as an unhandled render error and unmounts the whole tree, so a
    // missing env var would white-screen the marketing site rather than just
    // disabling sign-in.
    let unsubscribe: (() => void) | undefined;

    /**
     * onAuthStateChanged only fires once Firebase has initialised, which means
     * a network round trip to restore a persisted session. If that request is
     * blocked, throttled, or simply never settles, every page that waits on
     * `loading` — the signup and login shells included — sits on "Checking your
     * account" forever, with no way forward and no error to act on.
     *
     * So give up after a few seconds and carry on as signed out. If the real
     * callback lands later it still wins: it sets user and loading again and
     * the session appears. Failing open with a correctable guess beats an
     * unrecoverable spinner.
     */
    const giveUp = setTimeout(() => {
      console.warn(
        "[auth] session check did not settle in time, continuing as signed out",
      );
      setLoading(false);
    }, 8000);

    try {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), (next) => {
        clearTimeout(giveUp);
        clearTimeout(profileTimeout);
        detach?.();
        if (next) {
          // Wait for the role document before choosing a home page. Otherwise
          // a worker briefly sees the customer finder on every sign-in.
          setProfile(null);
          setRole(null);
          setProfileError(null);
          setLoading(true);
          profileTimeout = setTimeout(() => {
            console.warn("[auth] profile check did not settle in time");
            setLoading(false);
          }, 8000);
          detach = attachProfile(next.uid, () => {
            clearTimeout(profileTimeout);
            setLoading(false);
          });
        } else {
          setProfile(null);
          setRole(null);
          setProfileError(null);
          setLoading(false);
        }
        setUser(next);
      });
    } catch (err) {
      clearTimeout(giveUp);
      clearTimeout(profileTimeout);
      // Expected and handled: the UI switches to preview mode. Logged as a
      // warning so the console carries the diagnosis without implying a fault.
      console.warn("[auth] Firebase unavailable, continuing without auth:", err);
      setUnconfigured(true);
      setLoading(false);
      return;
    }

    return () => {
      clearTimeout(giveUp);
      clearTimeout(profileTimeout);
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
      try {
        await sendEmailVerification(cred.user, {
          url: `${window.location.origin}/login?verified=1`,
          handleCodeInApp: false,
        });
      } catch (error) {
        // The account exists; keep the user in the verification flow so they
        // can request another link instead of treating registration as failed.
        console.warn("[auth] verification email could not be sent:", error);
      }
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

  /**
   * Convert the signed-in household account into a worker account.
   *
   * People start here to hire services and some later decide to offer them.
   * Forcing a second account would split their history in two, so the role on
   * the existing user document is upgraded in place. Firestore rules permit
   * exactly this transition and nothing else.
   */
  const becomeWorker = useCallback(async () => {
    const uid = getFirebaseAuth().currentUser?.uid;
    if (!uid) throw new Error("Not signed in.");
    await updateDoc(doc(getFirebaseDb(), "users", uid), {
      role: "worker",
      upgradedAt: new Date().toISOString(),
    });
    // The profile snapshot listener picks the new role up on its own.
  }, []);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
    setProfileError(null);
    router.push("/");
  }, [router]);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  }, []);

  const sendVerificationEmail = useCallback(async () => {
    const current = getFirebaseAuth().currentUser;
    if (!current) throw new Error("Sign in to request an email verification link.");
    await sendEmailVerification(current, {
      url: `${window.location.origin}/login?verified=1`,
      handleCodeInApp: false,
    });
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
      profileError,
      signUp,
      signIn,
      becomeWorker,
      logout,
      resetPassword,
      sendVerificationEmail,
      refreshProfile,
    }),
    [
      user,
      role,
      profile,
      loading,
      unconfigured,
      profileError,
      signUp,
      signIn,
      becomeWorker,
      logout,
      resetPassword,
      sendVerificationEmail,
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
