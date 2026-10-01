import { PrismaClient, Platform } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { id: "demo-user" },
    update: {},
    create: {
      id: "demo-user",
      displayName: "mod_demo",
    },
  });

  const channel = await prisma.channel.upsert({
    where: {
      platform_slug: {
        platform: Platform.TWITCH,
        slug: "demo_channel",
      },
    },
    update: {},
    create: {
      platform: Platform.TWITCH,
      externalId: "demo-channel-id",
      slug: "demo_channel",
      displayName: "Demo Channel",
      isLive: true,
    },
  });

  await prisma.moderatorChannel.upsert({
    where: {
      userId_channelId: {
        userId: user.id,
        channelId: channel.id,
      },
    },
    update: { verified: true, active: true },
    create: {
      userId: user.id,
      channelId: channel.id,
      verified: true,
      active: true,
    },
  });

  await prisma.blacklistEntry.upsert({
    where: {
      userId_value: {
        userId: user.id,
        value: "link-malicioso.gg",
      },
    },
    update: {},
    create: {
      userId: user.id,
      value: "link-malicioso.gg",
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
