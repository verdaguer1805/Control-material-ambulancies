import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dfnywetqnccykzjyihzq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fjxFCzJNnWQLar26ObYgRw_oK9w3yDI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export async function ensureAnonymousSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}
