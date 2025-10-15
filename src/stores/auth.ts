import { defineStore } from "pinia";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { ref } from "vue";
import router from "@/router";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const session = ref<Session | null>(null);
  const profile = ref();

  const init = async () => {
    const authSession = supabase.auth.getSession
      ? (await supabase.auth.getSession()).data.session
      : null;
    session.value = authSession ?? null;
    user.value = authSession?.user ?? null;

    if (user.value) {
      await fetchProfile();
    }

    supabase.auth.onAuthStateChange((event, newSession) => {
      session.value = newSession ?? null;
      user.value = newSession?.user ?? null;

      // If the user was signed out or deleted, then redirect to root
      if (!user.value) {
        profile.value = null;
        if (router.currentRoute.value.path !== "/") {
          router.push({ path: "/" });
        }
      } else {
        fetchProfile().catch(console.error);
      }
    });
  };

  const fetchProfile = async () => {
    // Ensure there is a user to fetch
    if (!user.value) {
      profile.value = null;
      return;
    }

    // Fetch the user's profile data
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.value.id)
      .single();

    // Verify the data was fetch successfully
    if (error) {
      console.error("fetchProfile error", error);
      profile.value = null;
      return;
    }

    // Store the profile data
    profile.value = data;
  };

  const signup = async (username: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });
    if (error) throw error;
    return data;
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    // fetch profile after sign-in
    await fetchProfile();
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    user.value = null;
    session.value = null;
    profile.value = null;
    router.push({ path: "/" });
  };

  init().catch(console.error);

  return {
    user,
    session,
    profile,
    fetchProfile,
    signup,
    login,
    logout,
  };
});
