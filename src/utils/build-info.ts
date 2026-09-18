import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const FALLBACK_VERSION = "2.1.0";

function packageVersion(): string {
  if (process.env.npm_package_version) {
    return process.env.npm_package_version;
  }
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { name?: string; version?: string };
    if (pkg.name === "medical-mcp" && pkg.version) {
      return pkg.version;
    }
  } catch {
    // cwd may not be the package root when launched as an MCP server
  }
  return FALLBACK_VERSION;
}

function gitSha(): string {
  const fromEnv = (
    process.env.GIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.SOURCE_VERSION ||
    process.env.COMMIT_SHA ||
    ""
  ).trim();
  if (fromEnv) return fromEnv.slice(0, 12);
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1000,
    })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

/** Stable string so a tester can tell a new deploy from cached behaviour. */
export function getBuildString(): string {
  return `medical-mcp@${packageVersion()}+${gitSha()}`;
}
