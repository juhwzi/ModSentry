export type OAuthPlatform = "twitch" | "kick";

export function getOAuthConfig(platform: OAuthPlatform) {
  if (platform === "twitch") {
    return {
      clientId: process.env.TWITCH_CLIENT_ID ?? "",
      clientSecret: process.env.TWITCH_CLIENT_SECRET ?? "",
      redirectUri: process.env.TWITCH_REDIRECT_URI ?? "",
      authorizeUrl: "https://id.twitch.tv/oauth2/authorize",
      tokenUrl: "https://id.twitch.tv/oauth2/token",
    };
  }

  return {
    clientId: process.env.KICK_CLIENT_ID ?? "",
    clientSecret: process.env.KICK_CLIENT_SECRET ?? "",
    redirectUri: process.env.KICK_REDIRECT_URI ?? "",
    authorizeUrl: "https://id.kick.com/oauth/authorize",
    tokenUrl: "https://id.kick.com/oauth/token",
  };
}

export function assertOAuthConfig(platform: OAuthPlatform) {
  const config = getOAuthConfig(platform);
  const missing = Object.entries(config)
    .filter(([key, value]) => ["clientId", "clientSecret", "redirectUri"].includes(key) && !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`${platform.toUpperCase()} OAuth is not configured: ${missing.join(", ")}`);
  }

  return config;
}
