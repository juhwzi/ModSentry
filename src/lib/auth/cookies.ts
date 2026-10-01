import { cookies } from "next/headers";
import { verifySession } from "./crypto";

export const SESSION_COOKIE = "modsentry_session";
export const OAUTH_STATE_COOKIE = "modsentry_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "modsentry_oauth_verifier";
export const OAUTH_PLATFORM_COOKIE = "modsentry_oauth_platform";

export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(SESSION_COOKIE)?.value);
}
