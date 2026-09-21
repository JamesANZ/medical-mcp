import { hasNonHomePath, hostnameOf, stripTrackingParams } from "./text.js";

const AAP_HOSTS = new Set([
  "aap.org",
  "publications.aap.org",
  "brightfutures.aap.org",
  "shop.aap.org",
]);

export function isAllowedAapUrl(url?: string): boolean {
  if (!url) return false;
  const host = hostnameOf(url);
  if (!host) return false;
  const allowed =
    AAP_HOSTS.has(host) ||
    host.endsWith(".aap.org") ||
    host.endsWith(".aappublications.org");
  if (!allowed) return false;
  return hasNonHomePath(url);
}

export function isAapGuidelineTitle(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.includes("policy statement") ||
    t.includes("clinical report") ||
    t.includes("clinical practice guideline") ||
    t.includes("technical report")
  );
}

export function classifyAapDocumentTitle(title: string): {
  source: "aap-policy";
  category: string;
} | null {
  const t = title.toLowerCase();
  if (t.includes("policy statement")) {
    return { source: "aap-policy", category: "Policy Statement" };
  }
  if (t.includes("clinical practice guideline")) {
    return { source: "aap-policy", category: "Clinical Practice Guideline" };
  }
  if (t.includes("clinical report")) {
    return { source: "aap-policy", category: "Clinical Report" };
  }
  if (t.includes("technical report")) {
    return { source: "aap-policy", category: "Technical Report" };
  }
  return null;
}

export function classifyAapResult(
  url: string,
  title: string,
): {
  source: "bright-futures" | "aap-policy";
  category: string;
} {
  const host = hostnameOf(url) || "";
  const haystack = `${url} ${title}`.toLowerCase();
  if (host.includes("brightfutures") || haystack.includes("bright futures")) {
    return { source: "bright-futures", category: "Preventive Care" };
  }
  const fromTitle = classifyAapDocumentTitle(title);
  if (fromTitle) return fromTitle;
  if (haystack.includes("/policy/")) {
    return { source: "aap-policy", category: "Policy Statement" };
  }
  if (host === "publications.aap.org") {
    return { source: "aap-policy", category: "AAP Publication" };
  }
  return { source: "aap-policy", category: "AAP Web Page" };
}

export function normalizeAapUrl(url: string): string {
  return stripTrackingParams(url);
}
