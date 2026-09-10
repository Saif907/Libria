import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";

/* ---------- Types ---------- */

interface AuthState {
  user: User | null;
  session: Session | null;
  /** True while the initial session is being resolved. */
  loading: boolean;
}

export interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
}

/* ---------- Context ---------- */

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => {
    throw new Error("AuthProvider not mounted");
  },
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

/* ---------- Provider ---------- */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  const signIn = async (email: string, password: string): Promise<User> => {
    const trimmedEmail = email.trim();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error("No user returned from authentication.");

    // Update state immediately so downstream components & AuthGate
    // instantly recognize the authenticated user without race conditions
    setState({
      user: data.user,
      session: data.session,
      loading: false,
    });

    return data.user;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      loading: false,
    });
  };

  useEffect(() => {
    // If Supabase credentials are not configured, skip network calls and complete loading immediately
    if (!isSupabaseConfigured) {
      setState({
        user: null,
        session: null,
        loading: false,
      });
      return;
    }

    let isMounted = true;

    // 1. Resolve the existing session (from localStorage / cookies).
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;

        if (error) {
          console.warn("[Auth] Stale or invalid session detected:", error.message);
          // Purge corrupted/expired tokens from local storage so subsequent loads don't fail with 400
          supabase.auth.signOut({ scope: "local" }).catch(() => {});
          setState({
            user: null,
            session: null,
            loading: false,
          });
          return;
        }

        setState({
          user: data?.session?.user ?? null,
          session: data?.session ?? null,
          loading: false,
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("[Auth] Failed to resolve Supabase session:", err);
        supabase.auth.signOut({ scope: "local" }).catch(() => {});
        setState({
          user: null,
          session: null,
          loading: false,
        });
      });

    // 2. Keep state in sync with every auth event (sign-in, sign-out, token refresh, etc.).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    ...state,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
