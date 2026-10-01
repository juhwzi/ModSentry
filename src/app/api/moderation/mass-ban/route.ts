import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, executeMassBan } from "@/lib/moderation/service";
import { ModerationError } from "@/lib/moderation/errors";
const item = z.object({ platform: z.enum(["TWITCH", "KICK"]), channelSlug: z.string().min(1).max(100), targetUsername: z.string().min(1).max(100), targetUserId: z.string().optional(), reason: z.string().max(500).optional() });
const schema = z.object({ items: z.array(item).min(1).max(100) });
export async function POST(request: Request) { try { const userId = await requireUser(); const body = schema.parse(await request.json()); return NextResponse.json(await executeMassBan(userId, body.items)); } catch (error) { const e = error instanceof ModerationError ? error : new ModerationError("MASS_BAN_FAILED", error instanceof Error ? error.message : "Falha no mass ban.", 500); return NextResponse.json({ error: e.code, message: e.message }, { status: e.status }); } }
