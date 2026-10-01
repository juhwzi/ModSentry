import { ModerationError } from "./errors";
import type { ModerationInput, ModerationResult } from "./types";

const API = "https://api.kick.com/public/v1";

async function request(accessToken: string, method: "POST" | "DELETE", body: Record<string, unknown>) {
  const response = await fetch(`${API}/moderation/bans`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = "";
    try { detail = await response.text(); } catch { /* ignore */ }
    throw new ModerationError(`KICK_${response.status}`, detail || `Kick API returned ${response.status}`, response.status);
  }
}

async function resolveUser(accessToken: string, username: string) {
  const response = await fetch(`${API}/users?username=${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  if (!response.ok) throw new ModerationError("KICK_TARGET_LOOKUP_FAILED", "Não foi possível localizar o usuário na Kick.", response.status);
  const body = await response.json() as { data?: Array<{ user_id: number; name: string }> };
  const user = body.data?.[0];
  if (!user) throw new ModerationError("TARGET_NOT_FOUND", `Usuário @${username} não encontrado.`, 404);
  return user;
}

export async function kickModerate(input: ModerationInput, accessToken: string, broadcasterId: string): Promise<ModerationResult> {
  const action = input.action ?? "BAN";
  const target = input.targetUserId ? { user_id: Number(input.targetUserId) } : await resolveUser(accessToken, input.targetUsername);
  if (!Number.isFinite(target.user_id)) throw new ModerationError("INVALID_TARGET", "ID de usuário Kick inválido.");
  if (action === "UNBAN") {
    await request(accessToken, "DELETE", { broadcaster_user_id: Number(broadcasterId), user_id: target.user_id });
  } else {
    // Kick's public moderation API models a timeout as a temporary ban.
    // The public API accepts duration for the temporary action.
    await request(accessToken, "POST", {
      broadcaster_user_id: Number(broadcasterId),
      user_id: target.user_id,
      ...(action === "TIMEOUT" ? { duration: Math.max(1, Math.ceil((input.durationSeconds ?? 300) / 60)) } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    });
  }
  return { platform: "KICK", action, targetUsername: input.targetUsername, targetUserId: String(target.user_id), channelSlug: input.channelSlug, executedAt: new Date().toISOString() };
}
