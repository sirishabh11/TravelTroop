import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
// Only a publishable (or legacy anon) key belongs here. RLS and capability RPCs enforce access.
export const supabase = configured ? createClient(url, key) : null;
export function db() {
  if (!supabase)
    throw new Error(
      "Supabase is not configured. Follow the setup instructions to connect a real database.",
    );
  return supabase;
}
