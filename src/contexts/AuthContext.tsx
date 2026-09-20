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
  profileLoaded: boolean;
  signUp: (args: {
    email: string;
    password: string;
    fullName: string;
    shopName: string;
    country: string;
    currency: string;
  }) => Promise<{ error: string | null; needsConfirm: boolean }>;
  signUpToExistingShop: (args: {
    email: string;
    password: string;
    fullName: string;
    shopId: string;
  }) => Promise<{ error: string | null }>;
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
  const [profileLoaded, setProfileLoaded] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, shops(*)")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      setProfile(null);
      setProfileLoaded(true);
      return;
    }
    const loaded = (data as ProfileWithShop) ?? null;
    if (loaded?.disabled) {
      // Owner disabled this account — end the session immediately.
      setProfile(null);
      setProfileLoaded(true);
      void supabase.auth.signOut();
      return;
    }
    setProfile(loaded);
    setProfileLoaded(true);
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
        setProfileLoaded(false);
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

  const signUpToExistingShop: AuthContextValue["signUpToExistingShop"] = async ({ email, password, fullName, shopId }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          invited_shop_id: shopId,
          invited_role: "cashier",
        },
      },
    });
    if (error) return { error: error.message };
    if (!data.session) {
      return {
        error:
          "Your account was created but this project requires email confirmation. In Supabase: Authentication → Providers → Email → turn OFF 'Confirm email', then sign in.",
      };
    }
    return { error: null };
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
        profileLoaded,
        signUp,
        signUpToExistingShop,
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
