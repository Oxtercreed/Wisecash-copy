import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AppRole, ProfileWithShop } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: ProfileWithShop | null;
  shop: ProfileWithShop["shops"];
  role: AppRole | null;
  loading: boolean;
  signUp: (args: {
    email: string;
    password: string;
    fullName: string;
    shopName: string;
    country: string;
    currency: string;
  }) => Promise<{ error: string | null; needsConfirm: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileWithShop | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, shops(*)")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      setProfile(null);
      return;
    }
    setProfile((data as ProfileWithShop) ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) void fetchProfile(data.session.user.id);
        setLoading(false);
      })
      .catch(() => mounted && setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) void fetchProfile(nextSession.user.id);
      else {
        setProfile(null);
        queryClient.clear();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile, queryClient]);

  const signUp: AuthContextValue["signUp"] = async ({ email, password, fullName, shopName, country, currency }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          shop_name: shopName,
          country,
          currency,
        },
      },
    });
    if (error) return { error: error.message, needsConfirm: false };
    // If email confirmation is required there is no session yet.
    return { error: null, needsConfirm: !data.session };
  };

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const signInWithGoogle: AuthContextValue["signInWithGoogle"] = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return { error: error ? error.message : null };
  };

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        shop: profile?.shops ?? null,
        role: profile?.role ?? null,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
