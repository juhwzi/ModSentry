import { NextResponse } from "next/server";
import { getSessionAudit } from "@/lib/moderation/audit";
import { requireUser } from "@/lib/moderation/service";
export async function GET(request: Request) {
  const userId = await requireUser();
  const channelSlug = new URL(request.url).searchParams.get("channel") ?? undefined;
  return NextResponse.json(await getSessionAudit(userId, channelSlug));
}
