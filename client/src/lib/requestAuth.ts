import { getAppSessionToken, getDevAuthHeaders } from "@/const";
import { getSupabaseAuthHeaders } from "@/lib/supabase";

export function getRequestAuthHeaders(): Record<string, string> {
  const supabaseHeaders = getSupabaseAuthHeaders();
  if (Object.keys(supabaseHeaders).length > 0) {
    return supabaseHeaders;
  }

  const appSessionToken = getAppSessionToken();
  if (appSessionToken) {
    return { Authorization: `Bearer ${appSessionToken}` };
  }

  const devHeaders = getDevAuthHeaders();
  if (Object.keys(devHeaders).length > 0) {
    return devHeaders;
  }
  return {};
}
