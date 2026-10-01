import { createClient } from "@supabase/supabase-js";

export async function broadcastModeration(channelKey: string, event: Record<string, unknown>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return false;
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const channel = supabase.channel(`modsentry:${channelKey}`);
  const result = await channel.send({ type: "broadcast", event: "moderation", payload: event });
  await supabase.removeChannel(channel);
  return result === "ok";
}
