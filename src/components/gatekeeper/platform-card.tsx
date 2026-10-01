import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Radio, ShieldCheck } from "lucide-react";

type Props = {
  platform: "twitch" | "kick";
  authenticated: boolean;
  username?: string | null;
  description: string;
};

export function PlatformCard({ platform, authenticated, username, description }: Props) {
  const isTwitch = platform === "twitch";
  const accent = isTwitch ? "text-modsentry-twitch" : "text-modsentry-kick";
  const href = `/api/auth/${platform}`;

  return (
    <div className="rounded-xl border border-modsentry-border bg-black/20 p-4 transition hover:border-white/10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className={`grid size-10 place-items-center rounded-lg border border-white/5 bg-white/[0.03] ${accent}`}>
            {isTwitch ? <Radio className="size-4" /> : <ShieldCheck className="size-4" />}
          </div>
          <div>
            <div className={`font-bold ${accent}`}>{isTwitch ? "Twitch" : "Kick"}</div>
            <p className="mt-1 max-w-sm text-sm leading-6 text-zinc-500">{description}</p>
          </div>
        </div>
        <span
          className={`rounded-full border px-3 py-1 font-mono text-[10px] ${
            authenticated
              ? "border-modsentry-kick/30 text-modsentry-kick"
              : "border-modsentry-border text-zinc-600"
          }`}
        >
          {authenticated ? "CONNECTED" : "OFFLINE"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-modsentry-border pt-3">
        {authenticated ? (
          <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
            <CheckCircle2 className="size-3 text-modsentry-kick" />
            @{username}
          </div>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-700">Gatekeeper locked</span>
        )}

        <Link
          href={href}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[10px] font-bold uppercase transition ${
            authenticated
              ? "border border-modsentry-border text-zinc-400 hover:text-white"
              : isTwitch
                ? "bg-modsentry-twitch text-white hover:brightness-110"
                : "bg-modsentry-kick text-black hover:bg-modsentry-kickBright"
          }`}
        >
          {authenticated ? "Reconectar" : "Conectar"}
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
