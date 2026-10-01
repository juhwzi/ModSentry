import type { ModSentryMessage } from "@/types/message";
import { levenshtein, similarity } from "./levenshtein";
import { sanitizeText } from "./sanitize";
import { stableHash } from "./hash";
import type { DetectionResult, PipelineContext } from "./types";

const LINK_PATTERN = /(https?:\/\/|www\.)[^\s]+|([a-z0-9]+(-[a-z0-9]+)*\.)+(com|net|org|gg|tv|xyz|ru|io|top|link|site)(\/[^\s]*)?/gi;
const CALLOUT_PATTERNS = [
  /\b(mod|mods|modera|moderador|moderadores|moderacao|admin|staff)\b/i,
  /\bcade (o|os) mod(s)?\b/i,
  /\bchama a modera(cao)?\b/i,
  /\balo mod(s)?\b/i,
];
const IMPERSONATION_TERMS = ["oficial", "mod", "live"];


export function detectBlacklist(message: ModSentryMessage, context: PipelineContext): DetectionResult | null {
  const terms = (context.blacklistTerms ?? []).map((term) => sanitizeText(term).compact).filter(Boolean);
  if (!terms.length) return null;
  const content = sanitizeText(message.content).compact;
  const matched = terms.find((term) => content.includes(term));
  if (!matched) return null;
  return {
    id: `blacklist:${message.id}`,
    kind: "blacklist",
    severity: "critical",
    message,
    reason: "Termo presente na blacklist do canal",
    matched,
  };
}

export function detectLinks(message: ModSentryMessage): DetectionResult | null {
  const match = message.content.match(LINK_PATTERN)?.[0];
  if (!match) return null;
  return {
    id: `link:${message.id}`,
    kind: "link",
    severity: "moderate",
    message,
    reason: "Link suspeito detectado",
    matched: match,
  };
}

export function detectCallout(message: ModSentryMessage, context: PipelineContext): DetectionResult | null {
  const sanitized = sanitizeText(message.content).accentFree;
  const explicitMentions = context.moderatorUsernames.filter((username) =>
    new RegExp(`@${escapeRegex(sanitizeText(username).accentFree)}\\b`, "i").test(sanitized),
  );
  const custom = (context.customCallouts ?? []).filter((term) =>
    new RegExp(`\\b${escapeRegex(sanitizeText(term).accentFree)}\\b`, "i").test(sanitized),
  );
  const pattern = CALLOUT_PATTERNS.find((candidate) => candidate.test(sanitized));

  if (!explicitMentions.length && !custom.length && !pattern) return null;

  return {
    id: `callout:${message.id}`,
    kind: "callout",
    severity: "info",
    message,
    reason: explicitMentions.length ? `Menção ao moderador @${explicitMentions[0]}` : "Chamado da moderação detectado",
    matched: explicitMentions[0] ?? custom[0] ?? pattern?.source,
  };
}

export function detectImpersonation(message: ModSentryMessage, context: PipelineContext): DetectionResult | null {
  const candidates = [context.streamerUsername, ...context.moderatorUsernames].filter(Boolean) as string[];
  if (!candidates.length) return null;

  const username = sanitizeText(message.sender.username).compact;
  let best: { target: string; score: number } | null = null;

  for (const candidate of candidates) {
    const normalizedCandidate = sanitizeText(candidate).compact;
    if (!normalizedCandidate || normalizedCandidate === username) continue;
    const score = similarity(username, normalizedCandidate);
    if (!best || score > best.score) best = { target: candidate, score };
  }

  const hasIdentityTerm = IMPERSONATION_TERMS.some((term) => username.includes(sanitizeText(term).compact));
  if (!best || best.score < 0.8 || !hasIdentityTerm) return null;

  return {
    id: `impersonation:${message.id}`,
    kind: "impersonation",
    severity: "critical",
    message,
    reason: `Possível falsificação de identidade de ${best.target}`,
    matched: best.target,
    similarity: best.score,
  };
}

export function getSpamFingerprint(message: ModSentryMessage): string {
  return stableHash(sanitizeText(message.content).compact);
}

export function detectBasicSpam(message: ModSentryMessage): DetectionResult | null {
  const compact = sanitizeText(message.content).compact;
  if (compact.length < 6) return null;
  const repeated = /(.)\1{4,}/.test(compact);
  if (!repeated) return null;
  return {
    id: `spam:${message.id}`,
    kind: "spam",
    severity: "moderate",
    message,
    reason: "Flood / repetição detectada",
    groupKey: getSpamFingerprint(message),
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { levenshtein };
