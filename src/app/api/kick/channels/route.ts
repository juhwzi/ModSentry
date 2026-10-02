import { NextResponse } from "next/server";
import { Platform } from "@prisma/client";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { prisma } from "@/lib/db/prisma";
import { getKickChannelBySlug } from "@/lib/platforms/kick/client";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const slug = new URL(request.url).searchParams.get("slug")?.trim().toLowerCase();
  if (slug) {
    if (!/^[a-z0-9_-]{2,50}$/.test(slug)) {
      return NextResponse.json({ error: "INVALID_SLUG", message: "Informe um slug de canal válido." }, { status: 400 });
    }

    const account = await prisma.platformAccount.findFirst({ where: { userId, platform: Platform.KICK }, select: { accessToken: true } });
    if (!account?.accessToken) return NextResponse.json({ error: "KICK_NOT_CONNECTED", message: "Conecte sua conta Kick antes de buscar canais." }, { status: 403 });

    try {
      const channel = await getKickChannelBySlug(account.accessToken, slug);
      if (!channel) return NextResponse.json({ error: "CHANNEL_NOT_FOUND", message: "Canal não encontrado na Kick." }, { status: 404 });
      return NextResponse.json({ data: channel });
    } catch (error) {
      return NextResponse.json({ error: "KICK_LOOKUP_FAILED", message: error instanceof Error ? error.message : "Não foi possível consultar a Kick." }, { status: 502 });
    }
  }

  const channels = await prisma.moderatorChannel.findMany({
    where: { userId, active: true, channel: { platform: Platform.KICK } },
    select: { verified: true, channel: true },
    orderBy: { channel: { slug: "asc" } },
  });

  return NextResponse.json({ data: channels });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await request.json().catch(() => null) as { slug?: string } | null;
  const slug = body?.slug?.trim().toLowerCase();
  if (!slug || !/^[a-z0-9_-]{2,50}$/.test(slug)) {
    return NextResponse.json({ error: "INVALID_SLUG", message: "Informe um slug de canal válido." }, { status: 400 });
  }

  const account = await prisma.platformAccount.findFirst({
    where: { userId, platform: Platform.KICK },
    select: { accessToken: true, scopes: true },
  });
  if (!account?.accessToken) return NextResponse.json({ error: "KICK_NOT_CONNECTED", message: "Conecte sua conta Kick antes de adicionar um canal." }, { status: 403 });
  if (!account.scopes.includes("moderation:ban")) {
    return NextResponse.json({ error: "KICK_MOD_SCOPE_REQUIRED", message: "Reconecte a Kick e conceda a permissão de moderação." }, { status: 403 });
  }

  try {
    const found = await getKickChannelBySlug(account.accessToken, slug);
    if (!found) return NextResponse.json({ error: "CHANNEL_NOT_FOUND", message: "Canal não encontrado na Kick." }, { status: 404 });
    if (!found.chatroom_id) return NextResponse.json({ error: "KICK_CHATROOM_NOT_FOUND", message: "A Kick não retornou o chatroom desse canal. Tente novamente em instantes." }, { status: 502 });

    const channel = await prisma.channel.upsert({
      where: { platform_externalId: { platform: Platform.KICK, externalId: String(found.broadcaster_user_id) } },
      create: {
        platform: Platform.KICK,
        externalId: String(found.broadcaster_user_id),
        slug: found.slug,
        displayName: found.slug,
        chatroomId: found.chatroom_id ? String(found.chatroom_id) : null,
        isLive: Boolean(found.stream?.is_live),
      },
      update: {
        slug: found.slug,
        displayName: found.slug,
        chatroomId: found.chatroom_id ? String(found.chatroom_id) : null,
        isLive: Boolean(found.stream?.is_live),
      },
    });

    const membership = await prisma.moderatorChannel.upsert({
      where: { userId_channelId: { userId, channelId: channel.id } },
      create: { userId, channelId: channel.id, verified: true, active: true },
      update: { verified: true, active: true },
      select: { verified: true },
    });

    return NextResponse.json({ data: { channel, verified: membership.verified } }, { status: 201 });
  } catch (error) {
    console.error("Kick channel registration failed", error);
    return NextResponse.json({ error: "KICK_CHANNEL_ADD_FAILED", message: "Não foi possível adicionar esse canal." }, { status: 502 });
  }
}
