"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";
import { syncUserProfileStats } from "@/lib/data/profiles";

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

  const fetchProfile = useCallback(async (userId: string, currentUser?: User | null) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!error && data) {
        setProfile(data as Profile);
      } else {
        // If profile row doesn't exist yet, auto-create it from auth user metadata
        const u = currentUser;
        const initialUsername =
          u?.user_metadata?.username ||
          u?.user_metadata?.name ||
          u?.email?.split("@")[0] ||
          "Squad Member";
        const initialLeetcode =
          u?.user_metadata?.leetcode_username || null;

        const { data: newProfile, error: upsertErr } = await supabase
          .from("profiles")
          .upsert({
            id: userId,
            username: initialUsername,
            leetcode_username: initialLeetcode,
            contest_rating: 1500,
            streak: 0,
            total_easy: 0,
            total_medium: 0,
            total_hard: 0,
          })
          .select()
          .single();

        if (!upsertErr && newProfile) {
          setProfile(newProfile as Profile);
          if (initialLeetcode) {
            syncUserProfileStats(userId, initialLeetcode).then((synced) => {
              if (synced) setProfile(synced);
            });
          }
        }
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
    }
  }, [supabase]);

  useEffect(() => {
    async function initAuth() {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 2000)
        );
        const {
          data: { session: initialSession },
        } = await Promise.race([sessionPromise, timeoutPromise]);

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id, initialSession.user);
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
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await fetchProfile(newSession.user.id, newSession.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = async () => {
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
      {children}
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
