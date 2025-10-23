/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_API_URL;
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // important for PKCE flows
  },
});
