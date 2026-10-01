# ModSentry

Tactical moderation command center for Twitch and Kick, built with Next.js App Router, TypeScript, Prisma and PostgreSQL.

## Module 2 — Gatekeeper & Auth

Implemented:

- Independent Twitch and Kick authentication.
- Secure OAuth `state` validation.
- Twitch Authorization Code flow with server-side client secret handling.
- Twitch automatic discovery of channels where the authenticated user has moderator privileges.
- Kick OAuth 2.1 Authorization Grant with PKCE.
- Kick token introspection after authorization.
- Encrypted OAuth access/refresh tokens at rest using AES-256-GCM and `AUTH_SECRET`.
- Signed HttpOnly application session cookie.
- Linking a second platform to the current ModSentry user session.
- Protection of `/dashboard` through the server-side session.
- `/api/auth/status` and per-platform channel endpoints.
- Logout endpoint.

### Twitch API note

The original product specification requested Twitch OAuth 2.0 Authorization Code + PKCE. The current official Twitch documentation describes the Authorization Code flow with `state`, `client_id`, `redirect_uri`, `response_type`, and `scope`, and its current token-exchange example does not include PKCE parameters. The implementation therefore follows the current Twitch authorization-code contract rather than sending unsupported PKCE fields.

### Kick API note

The current Kick developer documentation specifies OAuth 2.1 with PKCE and uses `https://id.kick.com/oauth/authorize` and `https://id.kick.com/oauth/token`. Current moderation scopes include `moderation:ban`, while chat/event access is provided through scopes such as `chat:write` and `events:subscribe`.

## Local setup

1. Copy `.env.example` to `.env`.
2. Fill in the PostgreSQL connection and OAuth credentials.
3. Register these callback URLs in the platform developer consoles:
   - `http://localhost:3000/auth/twitch/callback`
   - `http://localhost:3000/auth/kick/callback`
4. Install dependencies:

```bash
npm install
```

5. Generate Prisma client and apply the schema:

```bash
npm run db:generate
npm run db:push
```

6. Start development:

```bash
npm run dev
```

## Module 3 — Multi-Socket Ingestion

The realtime ingestion layer now provides:

- Per-channel connection isolation.
- Twitch IRC WebSocket ingestion with tags, `PRIVMSG` parsing and PING/PONG heartbeat.
- Kick Pusher chatroom adapter for `chatrooms.{chatroom_id}.v2` / `App\\Events\\ChatMessageEvent`, isolated behind its own connection class.
- Exponential reconnect with jitter and a 30s cap.
- Unified `ModSentryMessage` normalization.
- Central in-memory event bus for downstream defensive engines.
- Realtime dashboard console showing socket states and normalized messages.
- Authenticated server endpoint that exposes only the Twitch access token required by the browser-side IRC connection; refresh tokens remain server-side and encrypted.

### Important realtime note

Twitch's current IRC documentation requires a user access token with `chat:read` for reading chat over IRC. The Twitch OAuth request was therefore extended with that scope. citeturn0search0

The Kick Pusher connection follows the Pusher channel contract described by the product PRD, but this is intentionally kept as an adapter because Kick's current public developer documentation centers its supported chat event delivery on webhook events rather than documenting this Pusher client connection as a stable public API. citeturn1search10turn1search11


## Módulo 4 — Pipeline Defensivo

O pipeline recebe `ModSentryMessage` do Event Bus e executa, no cliente, as quatro camadas descritas no PRD: lower-case/de-leet, remoção de diacríticos, compactação de pontuação/espaços, chamados da moderação, detector de links/TLDs, similaridade Levenshtein para impersonation e agrupamento colaborativo em janela de 10 segundos. O alerta de chamados respeita cooldown padrão de 15 segundos e pode usar Notification/Web Audio após ativação do usuário.

Novos módulos: `src/lib/pipeline/*` e `src/components/dashboard/defensive-queue.tsx`.

## Module 5 — Tactical UI & Frictionless Actions

Implemented the Sprint 4 tactical command center:
- two-column moderation layout;
- channel filtering and reason presets;
- moderation callout queue and defensive violation queue;
- local claim lock state;
- timeout/ban contextual command generation and clipboard actions;
- mass-ban command generation with grouped attackers;
- 6-second undo action;
- global keybinds 1/2/3;
- session audit trail and CSV export;
- 15-minute MPS baseline / 300% spike indicator;
- Context PIP shell with Twitch embedded player and Kick channel context link;
- real-time socket status HUD.

Platform punishment execution is intentionally kept as the next integration step: the current actions generate/copy the exact moderation command rather than making live punitive API calls without the platform-specific moderation adapters and scopes.

## Módulo 6 — Moderation Actions & Multi-Mod Sync

- Execução server-side de `TIMEOUT`, `BAN` e `UNBAN` via adapters Twitch/Kick.
- Validação de sessão, vínculo de moderador e canal antes de qualquer ação.
- Mass Ban sequencial com intervalo mínimo de 100 ms entre chamadas.
- Auditoria persistente em `ModerationEvent` e exportação CSV via API.
- Claim Lock persistente por sessão/ticket.
- Sincronização de claims via Supabase Realtime quando as variáveis públicas e a service role estiverem configuradas.
- Tokens OAuth permanecem somente no servidor; o browser nunca recebe access/refresh token de moderação.

> A API pública atual da Twitch suporta ban/timeout/unban via Helix. A API pública atual da Kick expõe as operações de moderação de ban/unban e o escopo `moderation:ban`; o adapter trata timeout como ação temporária conforme o contrato público disponível.

## Módulo 7 — Blacklist, Context PIP e Heatmap

Implementado:
- blacklist local + remota configurável por URL HTTPS, carregada no bootstrap do dashboard;
- suporte a JSON em formato de array (`["termo"]`) ou objeto `{ "terms": ["termo"] }`;
- termos remotos e locais são mesclados antes do Defensive Pipeline;
- detecção de termos da blacklist como infração crítica;
- Context PIP com player oficial da Twitch e player oficial da Kick;
- Kick PIP usa `https://player.kick.com/{username}?muted=true&allowfullscreen=false`;
- sparkline/heatmap de 30 segundos no HUD;
- detector de pico baseado em MPS atual versus média móvel de 15 minutos;
- seletor PIP por chave composta `platform:channel`, evitando colisão de slugs entre plataformas.

O PRD especifica a blacklist remota como um recurso de configuração local, mesclando a lista remota com a blacklist local do moderador. O PIP e o detector de MPS seguem a especificação da seção 6.

## Produção / Vercel

O projeto está preparado para deploy em ambiente serverless, mas a infraestrutura externa precisa estar configurada antes do primeiro login:

1. Criar um PostgreSQL gerenciado e definir `DATABASE_URL`.
2. Definir `AUTH_SECRET` com pelo menos 32 caracteres aleatórios.
3. Cadastrar os Redirect URIs de Twitch e Kick apontando para o domínio final.
4. Configurar as variáveis `TWITCH_*` e `KICK_*` no ambiente da Vercel.
5. Se usar sincronização multi-mod, configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
6. Executar o deploy com o script `postinstall`, que gera automaticamente o Prisma Client.
7. Aplicar as migrações do banco antes de liberar a aplicação para usuários.

### Validação pós-deploy

- `GET /api/health` deve retornar `status: ok`.
- Testar login Twitch e Kick separadamente.
- Confirmar que tokens nunca aparecem no browser ou nas respostas das APIs.
- Testar uma ação de timeout/ban e conferir o registro de auditoria.
- Abrir duas sessões de moderadores e confirmar o Claim Lock/Realtime.
- Confirmar o iframe oficial do canal no PIP.

### Observação sobre Twitch

O fluxo implementado usa Authorization Code Grant com `state` e mantém o client secret somente no servidor. A documentação atual da Twitch descreve esse fluxo para aplicações com servidor e client secret; ela também exige validação periódica dos tokens de terceiros via `/validate`. Essa validação periódica é uma evolução recomendada para a próxima etapa de produção.
