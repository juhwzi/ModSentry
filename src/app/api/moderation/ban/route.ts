import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, executeModeration } from "@/lib/moderation/service";
import { ModerationError } from "@/lib/moderation/errors";
const schema = z.object({ platform: z.enum(["TWITCH", "KICK"]), channelSlug: z.string().min(1).max(100), targetUsername: z.string().min(1).max(100), targetUserId: z.string().optional(), reason: z.string().max(500).optional() });
export async function POST(request: Request) { try { const userId = await requireUser(); const body = schema.parse(await request.json()); return NextResponse.json(await executeModeration(userId, { ...body, action: "BAN" })); } catch (error) { const e = error instanceof ModerationError ? error : new ModerationError("MODERATION_FAILED", error instanceof Error ? error.message : "Falha na moderação.", 500); return NextResponse.json({ error: e.code, message: e.message }, { status: e.status }); } }
