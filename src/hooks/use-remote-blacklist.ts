"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "modsentry_config";
const DEFAULT_TERMS: string[] = [];

type StoredConfig = { remote_blacklist_url?: string; custom_blacklist?: string[] };

function readConfig(): StoredConfig {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as StoredConfig;
  } catch {
    return {};
  }
}

export function useRemoteBlacklist() {
  const [url, setUrl] = useState("");
  const [localTerms, setLocalTerms] = useState<string[]>(DEFAULT_TERMS);
  const [remoteTerms, setRemoteTerms] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const reload = async (nextUrl = url) => {
    const normalizedUrl = nextUrl.trim();
    setStatus(normalizedUrl ? "loading" : "idle");
    if (!normalizedUrl) {
      setRemoteTerms([]);
      return;
    }
    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== "https:") throw new Error("A blacklist remota precisa usar HTTPS.");
      const response = await fetch(parsed.toString(), { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as unknown;
      const terms = Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object" && Array.isArray((payload as { terms?: unknown }).terms)
          ? (payload as { terms: unknown[] }).terms
          : [];
      setRemoteTerms(terms.filter((term): term is string => typeof term === "string" && term.trim().length > 0).map((term) => term.trim()));
      setStatus("ready");
    } catch {
      setRemoteTerms([]);
      setStatus("error");
    }
  };

  useEffect(() => {
    const config = readConfig();
    setUrl(config.remote_blacklist_url ?? "");
    setLocalTerms(config.custom_blacklist?.filter(Boolean) ?? DEFAULT_TERMS);
    if (config.remote_blacklist_url) void reload(config.remote_blacklist_url);
  }, []);

  const save = (nextUrl: string, nextLocalTerms: string[]) => {
    const config = { ...readConfig(), remote_blacklist_url: nextUrl.trim(), custom_blacklist: nextLocalTerms };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setUrl(nextUrl.trim());
    setLocalTerms(nextLocalTerms);
    void reload(nextUrl);
  };

  const terms = useMemo(() => [...new Set([...localTerms, ...remoteTerms].map((term) => term.toLowerCase()))], [localTerms, remoteTerms]);
  return { url, localTerms, remoteTerms, terms, status, save, reload };
}
