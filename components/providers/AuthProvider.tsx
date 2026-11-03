"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { OWN_PROFILE_COLUMNS } from "@/lib/data/profiles";
import { Profile } from "@/types/database";
import { DataCacheProvider } from "@/lib/cache/query";

/** Same user, same object: consumers keyed on `user` must not re-run on a token refresh. */
function sameUser(prev: User | null, next: User | null): User | null {
  return prev && next && prev.id === next.id && prev.updated_at === next.updated_at ? prev : next;
}

/** Keep the old profile object when nothing in it changed. */
function sameProfile(prev: Profile | null, next: Profile | null): Profile | null {
  return prev && next && JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);
  // Whose profile is loaded (or loading). Supabase re-emits SIGNED_IN when a
  // tab regains focus and TOKEN_REFRESHED every hour; neither is a new user,
  // and re-fetching the profile on them made every open page reload its data.
  const profileOwner = useRef<string | null>(null);

  const fetchProfile = useCallback(
    async (userId: string, currentUser?: User | null, currentSession?: Session | null) => {
      try {
        // 1. Try fast read from profiles table
        const { data, error } = await supabase
          .from("profiles")
          .select(OWN_PROFILE_COLUMNS)
          .eq("id", userId)
          .maybeSingle();

        if (!error && data) {
          setProfile((prev) => sameProfile(prev, data as Profile));
          return;
        }

        // 2. If profile is missing (or query had issues), resolve/create safely via server API
        const token =
          currentSession?.access_token ||
          (await supabase.auth.getSession()).data.session?.access_token;

        if (token) {
          const res = await fetch("/api/auth/profile", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const json = await res.json();
            if (json.profile) {
              setProfile((prev) => sameProfile(prev, json.profile as Profile));
              return;
            }
          }
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      }
    },
    [supabase]
  );

  useEffect(() => {
    async function initAuth() {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (initialSession?.user) {
          // Verify with Supabase Auth that the session is still valid on server
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError || !userData?.user) {
            console.warn("Local auth session expired or invalid. Clearing.");
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
          } else {
            setSession(initialSession);
            setUser((prev) => sameUser(prev, userData.user));
            profileOwner.current = userData.user.id;
            await fetchProfile(userData.user.id, userData.user, initialSession);
          }
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === "SIGNED_OUT" || !newSession?.user) {
        profileOwner.current = null;
        setSession(null);
        setUser(null);
        setProfile(null);
      } else {
        const nextUser = newSession.user;
        setSession(newSession);
        setUser((prev) => sameUser(prev, nextUser));
        if (profileOwner.current !== nextUser.id || event === "USER_UPDATED") {
          profileOwner.current = nextUser.id;
          await fetchProfile(nextUser.id, nextUser, newSession);
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = async () => {
    profileOwner.current = null;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    window.location.href = "/login";
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      <DataCacheProvider userId={loading ? undefined : (user?.id ?? null)}>{children}</DataCacheProvider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
