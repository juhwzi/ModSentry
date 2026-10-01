import { Platform, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/auth/crypto";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { twitchModerate } from "./twitch";
import { kickModerate } from "./kick";
import { ModerationError } from "./errors";
import { runSequentially } from "./rate-limiter";
import type { ModerationInput, ModerationResult } from "./types";

export async function requireUser() {
  const userId = await getCurrentUserId();
  if (!userId) throw new ModerationError("UNAUTHENTICATED", "Sessão expirada.", 401);
  return userId;
}

async function resolveContext(userId: string, input: ModerationInput) {
  const channel = await prisma.channel.findUnique({ where: { platform_slug: { platform: input.platform, slug: input.channelSlug } } });
  if (!channel) throw new ModerationError("CHANNEL_NOT_FOUND", "Canal não encontrado.", 404);
  const moderatorChannel = await prisma.moderatorChannel.findUnique({ where: { userId_channelId: { userId, channelId: channel.id } } });
  if (!moderatorChannel?.active || !moderatorChannel.verified) throw new ModerationError("MODERATOR_ACCESS_REQUIRED", "Você não possui acesso de moderação ativo neste canal.", 403);
  const account = await prisma.platformAccount.findFirst({ where: { userId, platform: input.platform } });
  if (!account?.accessToken) throw new ModerationError("PLATFORM_AUTH_REQUIRED", "Conecte a plataforma antes de moderar.", 401);
  return { channel, account, accessToken: decryptSecret(account.accessToken) };
}

async function resolveSession(userId: string, channelId: string) {
  const existing = await prisma.moderationSession.findFirst({ where: { userId, channelId, status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
  return existing ?? prisma.moderationSession.create({ data: { userId, channelId } });
}

export async function executeModeration(userId: string, input: ModerationInput): Promise<ModerationResult> {
  const { channel, account, accessToken } = await resolveContext(userId, input);
  const action = input.action ?? "BAN";
  const result = input.platform === Platform.TWITCH
    ? await twitchModerate({ ...input, action }, accessToken, account.platformUserId, channel.externalId)
    : await kickModerate({ ...input, action }, accessToken, channel.externalId);
  const session = await resolveSession(userId, channel.id);
  await prisma.moderationEvent.create({ data: { sessionId: session.id, userId, platform: input.platform, channelSlug: input.channelSlug, targetUsername: input.targetUsername, reason: input.reason ?? "", eventType: result.action === "TIMEOUT" ? "TIMEOUT" : result.action === "BAN" ? "BAN" : "UNBAN", metadata: { targetUserId: result.targetUserId } as Prisma.InputJsonValue } });
  return result;
}

export async function executeMassBan(userId: string, items: ModerationInput[]) {
  const results: { succeeded: ModerationResult[]; failed: Array<{ targetUsername: string; error: string }> } = { succeeded: [], failed: [] };
  await runSequentially(items, async (item) => {
    try { results.succeeded.push(await executeModeration(userId, { ...item, action: "BAN" })); }
    catch (error) { results.failed.push({ targetUsername: item.targetUsername, error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }); }
  }, 100);
  return { requested: items.length, ...results };
}
