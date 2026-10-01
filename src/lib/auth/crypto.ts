import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

function getAuthSecret(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters.");
  }

  return createHash("sha256").update(secret).digest();
}

export function createPkceVerifier(): string {
  return randomBytes(48).toString("base64url");
}

export function createPkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function createOauthState(): string {
  return randomBytes(32).toString("base64url");
}

export function encryptSecret(value: string): string {
  const key = getAuthSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(payload: string): string {
  const [ivEncoded, tagEncoded, ciphertextEncoded] = payload.split(".");
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error("Invalid encrypted secret.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getAuthSecret(),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function signSession(userId: string): string {
  const payload = `${userId}:${Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS}`;
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = createHmac("sha256", getAuthSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySession(value: string | undefined): string | null {
  if (!value) return null;

  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;

  const expected = createHmac("sha256", getAuthSecret()).update(encoded).digest("base64url");
  if (signature.length !== expected.length) return null;

  const valid = Buffer.from(signature).equals(Buffer.from(expected));
  if (!valid) return null;

  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const separator = payload.lastIndexOf(":");
  if (separator <= 0) return null;

  const userId = payload.slice(0, separator);
  const expiresAt = Number(payload.slice(separator + 1));
  if (!userId || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return userId;
}
