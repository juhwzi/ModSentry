-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Platform" AS ENUM ('TWITCH', 'KICK');

-- CreateEnum
CREATE TYPE "public"."SessionStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "public"."EventType" AS ENUM ('TIMEOUT', 'BAN', 'UNBAN', 'DISMISS', 'CLAIM', 'RELEASE');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayName" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlatformAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "public"."Platform" NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Channel" (
    "id" TEXT NOT NULL,
    "platform" "public"."Platform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT,
    "chatroomId" TEXT,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ModeratorChannel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeratorChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ModerationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "public"."SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ModerationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ModerationEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "public"."Platform" NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "targetUsername" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "eventType" "public"."EventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ModerationClaim" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorName" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "ModerationClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BlacklistEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'local',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlacklistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAccount_userId_platform_idx" ON "public"."PlatformAccount"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAccount_platform_platformUserId_key" ON "public"."PlatformAccount"("platform", "platformUserId");

-- CreateIndex
CREATE INDEX "Channel_platform_chatroomId_idx" ON "public"."Channel"("platform", "chatroomId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_platform_externalId_key" ON "public"."Channel"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_platform_slug_key" ON "public"."Channel"("platform", "slug");

-- CreateIndex
CREATE INDEX "ModeratorChannel_userId_active_idx" ON "public"."ModeratorChannel"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ModeratorChannel_userId_channelId_key" ON "public"."ModeratorChannel"("userId", "channelId");

-- CreateIndex
CREATE INDEX "ModerationSession_userId_status_idx" ON "public"."ModerationSession"("userId", "status");

-- CreateIndex
CREATE INDEX "ModerationSession_channelId_status_idx" ON "public"."ModerationSession"("channelId", "status");

-- CreateIndex
CREATE INDEX "ModerationEvent_sessionId_createdAt_idx" ON "public"."ModerationEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationEvent_targetUsername_createdAt_idx" ON "public"."ModerationEvent"("targetUsername", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationClaim_sessionId_releasedAt_idx" ON "public"."ModerationClaim"("sessionId", "releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationClaim_sessionId_ticketId_key" ON "public"."ModerationClaim"("sessionId", "ticketId");

-- CreateIndex
CREATE INDEX "BlacklistEntry_userId_source_idx" ON "public"."BlacklistEntry"("userId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistEntry_userId_value_key" ON "public"."BlacklistEntry"("userId", "value");

-- AddForeignKey
ALTER TABLE "public"."PlatformAccount" ADD CONSTRAINT "PlatformAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModeratorChannel" ADD CONSTRAINT "ModeratorChannel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModeratorChannel" ADD CONSTRAINT "ModeratorChannel_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModerationSession" ADD CONSTRAINT "ModerationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModerationSession" ADD CONSTRAINT "ModerationSession_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModerationEvent" ADD CONSTRAINT "ModerationEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ModerationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModerationEvent" ADD CONSTRAINT "ModerationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModerationClaim" ADD CONSTRAINT "ModerationClaim_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ModerationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModerationClaim" ADD CONSTRAINT "ModerationClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BlacklistEntry" ADD CONSTRAINT "BlacklistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
