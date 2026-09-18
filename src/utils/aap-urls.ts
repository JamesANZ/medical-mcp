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
    AAP_HOSTS.has(host) || host.endsWith(".aap.org") || host.endsWith(".aappublications.org");
  if (!allowed) return false;
  return hasNonHomePath(url);
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
  if (haystack.includes("policy statement") || haystack.includes("/policy/")) {
    return { source: "aap-policy", category: "Policy Statement" };
  }
  if (
    haystack.includes("clinical practice guideline") ||
    haystack.includes("clinical report")
  ) {
    return { source: "aap-policy", category: "Clinical Report" };
  }
  if (host === "publications.aap.org") {
    return { source: "aap-policy", category: "AAP Publication" };
  }
  return { source: "aap-policy", category: "AAP Web Page" };
}

export function normalizeAapUrl(url: string): string {
  return stripTrackingParams(url);
}
