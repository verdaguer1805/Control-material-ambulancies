import { createClient } from "@supabase/supabase-js";
import { priorAuthorizedDevice, readAuthorizedIdentity, recordAuthDiagnostic } from "./auth-session-diagnostic.mjs";

const SUPABASE_URL = "https://dfnywetqnccykzjyihzq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fjxFCzJNnWQLar26ObYgRw_oK9w3yDI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export async function hasSupabaseConnection() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
export async function ensureAnonymousSession({ allowNewIdentity = false } = {}) {
  const { data, error: sessionError } = await supabase.auth.getSession();
  const session = data?.session;
  if (session) {
    const authorizedIdentity = readAuthorizedIdentity(localStorage);
    if (priorAuthorizedDevice(localStorage) && authorizedIdentity?.unit === localStorage.getItem("cma_unit") &&
        authorizedIdentity.userId !== session.user?.id)
      recordAuthDiagnostic(localStorage, "identity_changed");
    return session;
  }
  if (priorAuthorizedDevice(localStorage)) {
    recordAuthDiagnostic(localStorage, sessionError ? "session_error" : "session_missing");
    if (!allowNewIdentity) {
      const error = new Error("LOCAL_AUTH_SESSION_MISSING");
      error.code = "LOCAL_AUTH_SESSION_MISSING";
      throw error;
    }
  }
  if (sessionError && !allowNewIdentity) throw sessionError;
  const { data: signInData, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signInData.session;
}
