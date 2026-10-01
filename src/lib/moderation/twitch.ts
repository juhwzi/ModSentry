import { assertOAuthConfig } from "@/lib/auth/config";
import { ModerationError } from "./errors";
import type { ModerationInput, ModerationResult } from "./types";

const API = "https://api.twitch.tv/helix";

async function request(accessToken: string, method: string, path: string, body?: unknown) {
  const config = assertOAuthConfig("twitch");
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": config.clientId,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = "";
    try { detail = await response.text(); } catch { /* ignore */ }
    const status = response.status === 429 ? 429 : response.status;
    throw new ModerationError(`TWITCH_${status}`, detail || `Twitch API returned ${status}`, status);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function resolveUser(accessToken: string, username: string) {
  const config = assertOAuthConfig("twitch");
  const response = await fetch(`${API}/users?login=${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": config.clientId }, cache: "no-store",
  });
  if (!response.ok) throw new ModerationError("TWITCH_TARGET_LOOKUP_FAILED", "Não foi possível localizar o usuário na Twitch.", response.status);
  const body = await response.json() as { data: Array<{ id: string; login: string; display_name: string }> };
  const user = body.data[0];
  if (!user) throw new ModerationError("TARGET_NOT_FOUND", `Usuário @${username} não encontrado.` , 404);
  return user;
}

export async function twitchModerate(input: ModerationInput, accessToken: string, moderatorId: string, broadcasterId: string): Promise<ModerationResult> {
  const action = input.action ?? "BAN";
  const target = input.targetUserId ? { id: input.targetUserId } : await resolveUser(accessToken, input.targetUsername);
  if (action === "UNBAN") {
    await request(accessToken, "DELETE", `/moderation/bans?broadcaster_id=${encodeURIComponent(broadcasterId)}&moderator_id=${encodeURIComponent(moderatorId)}&user_id=${encodeURIComponent(target.id)}`);
  } else {
    await request(accessToken, "POST", `/moderation/bans?broadcaster_id=${encodeURIComponent(broadcasterId)}&moderator_id=${encodeURIComponent(moderatorId)}`, {
      data: { user_id: target.id, ...(action === "TIMEOUT" ? { duration: input.durationSeconds ?? 300 } : {}), ...(input.reason ? { reason: input.reason.slice(0, 500) } : {}) },
    });
  }
  return { platform: "TWITCH", action, targetUsername: input.targetUsername, targetUserId: target.id, channelSlug: input.channelSlug, executedAt: new Date().toISOString() };
}
