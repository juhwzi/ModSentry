import Link from "next/link";
import { Activity, ArrowRight, ShieldCheck } from "lucide-react";
import { PlatformCard } from "@/components/gatekeeper/platform-card";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { prisma } from "@/lib/db/prisma";
import { Platform } from "@prisma/client";

const errors: Record<string, string> = {
  AUTH_REQUIRED: "Conecte pelo menos uma plataforma para acessar o dashboard.",
  AUTH_NO_MOD_CHANNELS: "Sua conta Twitch não possui canais com privilégio de moderador.",
  KICK_MOD_PRIVILEGE_REQUIRED: "A conta Kick não possui o privilégio necessário para moderação.",
  OAUTH_STATE_INVALID: "A validação de segurança do OAuth falhou. Tente novamente.",
};

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const errorCode = typeof params.auth_error === "string" ? params.auth_error : undefined;
  const userId = await getCurrentUserId();

  let accounts: { platform: Platform; username: string }[] = [];
  if (userId) {
    try {
      accounts = await prisma.platformAccount.findMany({
        where: { userId },
        select: { platform: true, username: true },
      });
    } catch {
      accounts = [];
    }
  }

  const twitch = accounts.find((account) => account.platform === Platform.TWITCH);
  const kick = accounts.find((account) => account.platform === Platform.KICK);

  return (
    <main className="min-h-screen bg-modsentry-background px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-between gap-12">
        <header className="flex items-center justify-between border-b border-modsentry-border pb-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-modsentry-kick text-black">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="font-mono text-sm font-bold tracking-[0.25em]">MODSENTRY</div>
              <div className="text-xs text-zinc-500">TACTICAL MODERATION COMMAND CENTER</div>
            </div>
          </div>
          {userId ? (
            <Link href="/dashboard" className="font-mono text-xs text-modsentry-kick hover:underline">
              OPEN COMMAND CENTER →
            </Link>
          ) : (
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
              <Activity className="size-3 text-modsentry-kick" />
              GATEKEEPER ACTIVE
            </div>
          )}
        </header>

        {errorCode ? (
          <div className="rounded-xl border border-modsentry-critical/30 bg-modsentry-critical/5 px-4 py-3 font-mono text-xs text-red-300">
            <span className="font-bold">AUTH ERROR:</span> {errors[errorCode] ?? errorCode}
          </div>
        ) : null}

        <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-modsentry-border bg-modsentry-surface px-4 py-2 font-mono text-xs text-zinc-400">
              <Activity className="size-3 text-modsentry-info" />
              GATEKEEPER // INDEPENDENT PLATFORM AUTH
            </div>
            <h1 className="max-w-3xl text-5xl font-black tracking-tight sm:text-7xl">
              Moderação sem
              <span className="text-modsentry-kick"> ruído.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
              Conecte suas plataformas de forma independente. O ModSentry só desbloqueia o
              módulo correspondente depois de validar os privilégios de moderação.
            </p>
            {userId ? (
              <Link
                href="/dashboard"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-modsentry-kick px-6 py-3 font-bold text-black transition hover:bg-modsentry-kickBright"
              >
                Abrir Dashboard
                <ArrowRight className="size-4" />
              </Link>
            ) : null}
          </div>

          <div className="rounded-2xl border border-modsentry-border bg-modsentry-surface p-5 shadow-2xl shadow-black/20">
            <div className="mb-5 flex items-center justify-between">
              <span className="font-mono text-xs tracking-widest text-zinc-500">GATEKEEPER</span>
              <span className="font-mono text-[10px] text-zinc-700">OAUTH / PLATFORM GATEKEEPER</span>
            </div>
            <div className="space-y-3">
              <PlatformCard
                platform="twitch"
                authenticated={Boolean(twitch)}
                username={twitch?.username}
                description="OAuth Authorization Code + state + descoberta automática dos canais em que você é moderador."
              />
              <PlatformCard
                platform="kick"
                authenticated={Boolean(kick)}
                username={kick?.username}
                description="OAuth 2.1 + PKCE + permissões modernas de chat e moderação da API Kick."
              />
            </div>
            <p className="mt-5 border-t border-modsentry-border pt-4 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
              Uma plataforma pode falhar sem bloquear a outra.
            </p>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-modsentry-border pt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600 sm:flex-row sm:justify-between">
          <span>MODSENTRY / GATEKEEPER BUILD</span>
          <span>OAUTH / SERVER-SIDE SECRETS</span>
        </footer>
      </div>
    </main>
  );
}
