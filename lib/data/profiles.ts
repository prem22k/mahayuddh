import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";

export async function getSquadProfiles(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("contest_rating", { ascending: false });

  if (error || !data || data.length === 0) {
    // If no profiles in database yet, return empty array
    return [];
  }

  return data as Profile[];
}

export async function getProfileByLeetcodeUsername(leetcodeUsername: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("leetcode_username", leetcodeUsername)
    .single();

  if (error || !data) return null;
  return data as Profile;
}
