export const MODSENTRY = {
  alertCooldownSeconds: 15,
  raidWindowSeconds: 10,
  impersonationThreshold: 0.8,
  massActionMinimumTargets: 5,
  moderationBatchDelayMs: 100,
  undoWindowSeconds: 6,
  defaultTimeoutSeconds: 300,
  mpsSpikeMultiplier: 3,
} as const;

export const MODERATION_REASONS = [
  "Spam / Flood",
  "Auto-promoção",
  "Discurso de Ódio",
  "Link Suspeito",
  "Spoiler",
] as const;
