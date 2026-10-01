import type { ResearchHit } from "./types.js";

/** Same order of magnitude as the literature ranker's abstract cap. */
export const EXCERPT_LIMIT = 500;

export interface SanitizedText {
  text: string;
  truncated: boolean;
}

/**
 * Retrieved text is data. This only normalizes it.
 * It does not interpret instructions that may be inside the text.
 */
export function sanitizeUntrusted(value: unknown): SanitizedText {
  const raw = typeof value === "string" ? value : "";
  const withoutControls = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n");
  const collapsed = withoutControls.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
  const trimmed = collapsed.trim();
  if (trimmed.length <= EXCERPT_LIMIT) {
    return { text: trimmed, truncated: false };
  }
  return { text: trimmed.slice(0, EXCERPT_LIMIT), truncated: true };
}

/** Later redaction can replace this without changing providers. */
export type ContentFilter = (hit: ResearchHit) => ResearchHit | null;

export const passThroughFilter: ContentFilter = (hit) => hit;
