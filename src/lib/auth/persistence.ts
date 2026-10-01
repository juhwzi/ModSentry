import { Platform } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret } from "./crypto";

export async function upsertPlatformIdentity(input: {
  platform: Platform;
  platformUserId: string;
  username: string;
  displayName?: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scopes: string[];
  currentUserId?: string | null;
}) {
  const existingAccount = await prisma.platformAccount.findUnique({
    where: {
      platform_platformUserId: {
        platform: input.platform,
        platformUserId: input.platformUserId,
      },
    },
    select: { userId: true },
  });

  const linkedUserId = input.currentUserId ?? existingAccount?.userId;

  const user = linkedUserId
    ? await prisma.user.update({
        where: { id: linkedUserId },
        data: { displayName: input.displayName ?? input.username },
      })
    : await prisma.user.create({
        data: { displayName: input.displayName ?? input.username },
      });

  /*
   * If this platform account already belongs to another ModSentry user,
   * do not silently reassign it. This keeps independently authenticated
   * identities isolated unless the same local session is linking them.
   */
  if (existingAccount && input.currentUserId && existingAccount.userId !== input.currentUserId) {
    throw new Error("PLATFORM_ACCOUNT_ALREADY_LINKED");
  }

  /*
   * The branch above intentionally resolves the local user before the upsert.
   */
  await prisma.platformAccount.upsert({
    where: {
      platform_platformUserId: {
        platform: input.platform,
        platformUserId: input.platformUserId,
      },
    },
    create: {
      userId: user.id,
      platform: input.platform,
      platformUserId: input.platformUserId,
      username: input.username,
      accessToken: encryptSecret(input.accessToken),
      refreshToken: input.refreshToken ? encryptSecret(input.refreshToken) : null,
      tokenExpiresAt: new Date(Date.now() + input.expiresIn * 1000),
      scopes: input.scopes,
    },
    update: {
      userId: user.id,
      username: input.username,
      accessToken: encryptSecret(input.accessToken),
      refreshToken: input.refreshToken ? encryptSecret(input.refreshToken) : undefined,
      tokenExpiresAt: new Date(Date.now() + input.expiresIn * 1000),
      scopes: input.scopes,
    },
  });

  return user;
}

export async function getPlatformAccount(userId: string, platform: Platform) {
  return prisma.platformAccount.findFirst({
    where: { userId, platform },
  });
}
