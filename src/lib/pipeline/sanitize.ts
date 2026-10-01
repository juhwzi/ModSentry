const DELEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "!": "i",
  "|": "i",
  "@": "a",
  "4": "a",
  "^": "a",
  "3": "e",
  "5": "s",
  "$": "s",
  "7": "t",
  "8": "b",
};

function deLeet(value: string): string {
  return [...value].map((char) => DELEET_MAP[char] ?? char).join("");
}

function removeRepeatedCharacters(value: string): string {
  return value.replace(/(.)\1+/g, "$1");
}

export interface SanitizedText {
  original: string;
  lowerCase: string;
  deLeeted: string;
  accentFree: string;
  compact: string;
}

export function sanitizeText(value: string): SanitizedText {
  const lowerCase = value.toLocaleLowerCase("pt-BR");
  const deLeeted = deLeet(lowerCase);
  const accentFree = deLeeted.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const compact = removeRepeatedCharacters(accentFree).replace(/[\s\p{P}\p{S}]+/gu, "");

  return { original: value, lowerCase, deLeeted, accentFree, compact };
}

export function sanitizeForMatching(value: string): string {
  return sanitizeText(value).accentFree.replace(/\s+/g, " ").trim();
}
