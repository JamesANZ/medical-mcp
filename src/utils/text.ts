const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isNaN(code) ? _ : String.fromCodePoint(code);
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = parseInt(dec, 10);
      return Number.isNaN(code) ? _ : String.fromCodePoint(code);
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      return NAMED_ENTITIES[name.toLowerCase()] ?? match;
    });
}

export function stripTrackingParams(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (
        /^(utm_|mc_|ga_|fbclid|gclid|gclsrc|msclkid|dclid|yclid)/i.test(key)
      ) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function formatCompactDate(value?: string): string | undefined {
  if (!value) return undefined;
  const yyyymmdd = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
  }
  return value;
}

export function formatNumericDisplay(value: number, unit?: string): string {
  const display = Number.isInteger(value)
    ? String(value)
    : (Math.round(value * 100) / 100).toString();
  if (unit && unit !== "Unknown") {
    return `${display} ${unit}`;
  }
  return display;
}

export function truncateWithNotice(
  text: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return {
    text: text.slice(0, maxChars).trimEnd(),
    truncated: true,
  };
}

export function redactEmails(text: string): string {
  return text.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "[email removed]",
  );
}

export function isValidPmid(pmid: string): boolean {
  return /^\d{1,10}$/.test(pmid.trim());
}

export function quoteMultiWordQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('"')) return trimmed;
  return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
}

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function hasNonHomePath(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "");
    return path.length > 0;
  } catch {
    return false;
  }
}
