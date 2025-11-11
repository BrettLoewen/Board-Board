/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_API_URL;
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

// Create a supabase client using the environment variables (for production or local development) that will be used to talk to the backend
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
