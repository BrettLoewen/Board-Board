import { defineStore } from "pinia";
import { type User, type Session } from "@supabase/supabase-js";
import { useColorMode } from "@vueuse/core";
import { supabase } from "@/lib/supabaseClient";
import { ref } from "vue";
import router from "@/router";
import { ROUTES } from "@/constants";

const colorMode = useColorMode();

// Create the auth store that will be used to handle authentication with supabase throughout the application
export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const session = ref<Session | null>(null);
  const profile = ref();

  // Called at the bottom of the store definition to initialize it
  const init = async () => {
    // Start or create a session with supabase
    const authSession = supabase.auth.getSession
      ? (await supabase.auth.getSession()).data.session
      : null;
    session.value = authSession ?? null;
    user.value = authSession?.user ?? null;

    // If an active session was found, get and store the user's profile data
    if (user.value) {
      await fetchProfile();
    }

    // Handle changes to the current auth state (sign in, sign out, etc)
    supabase.auth.onAuthStateChange((event, newSession) => {
      session.value = newSession ?? null;
      user.value = newSession?.user ?? null;

      // If the user was signed out, then redirect to root
      if (!user.value) {
        profile.value = null;
        if (router.currentRoute.value.path !== ROUTES.ROOT) {
          router.push({ path: ROUTES.ROOT });
        }
      }
      // If a user was signed in, get their profile data
      else {
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

    // Verify the data was fetched successfully
    if (error) {
      console.error("fetchProfile error", error);
      profile.value = null;
      return;
    }

    // Store the profile data
    profile.value = data;

    // Get and set the user's preference settings
    const { data: preferences } = await supabase
      .from("user_preferences")
      .select()
      .eq("user_id", data.id);
    if (preferences) {
      if (preferences && preferences[0]?.color_mode) {
        colorMode.value = preferences[0].color_mode;
      }
    }
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

    // Return the data result so it can be used after sign up
    return data;
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Fetch the user's profile after sign in
    await fetchProfile();

    // Return the data result so it can be used after log in
    return data;
  };

  const clearUserData = async () => {
    // Clear all user data referencing the previous user
    user.value = null;
    session.value = null;
    profile.value = null;

    // Clear user preferences that could carry over to the logged out state
    colorMode.value = "auto";

    // Return the user to the welcome page so they
    // A) Can log in with the same or a different account if they wish
    // B) Do not accesss content that was only available to the previously logged in user
    router.push({ path: ROUTES.ROOT });
  };

  const logout = async () => {
    await supabase.auth.signOut();

    // Now that the user is logged out, clear their data and return to the welcome page
    clearUserData();
  };

  const deleteAccount = async () => {
    // Call an edge function to delete the user's auth profile and everything connected to it
    const { error } = await supabase.functions.invoke("delete-user", {
      headers: {
        Authorization: `Bearer ${session.value?.access_token}`,
      },
    });

    if (error) {
      console.error("Failed to delete account:", error);
    } else {
      console.log("Account deleted successfully. Logging user out.");

      // Delete the user's token from their storage to fully log out the user
      for (const key in localStorage) {
        if (key.match(/^sb-.*-auth-token$/)) {
          localStorage.removeItem(key);
        }
      }

      // Now that the account is deleted, clear their data and return to the welcome page
      clearUserData();
    }
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
    deleteAccount,
  };
});
