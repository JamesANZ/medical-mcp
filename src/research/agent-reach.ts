import { execFile } from "node:child_process";
import { constants as fsConstants, accessSync } from "node:fs";
import { delimiter, join } from "node:path";
import {
  anecdotalPlatform,
  classifyUrl,
  claimRoleForClass,
  framingFor,
  lexicalOverlap,
  parseLooseDate,
} from "./classify.js";
import { sanitizeUntrusted } from "./sanitize.js";
import type {
  ProviderOutcome,
  ResearchHit,
  ResearchProvider,
  ResearchSection,
  ResearchWarning,
  SourceClass,
} from "./types.js";

export type ExternalSource = "web" | "reddit" | "youtube" | "x";

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface ExecOptions {
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
}

export type ExecFn = (
  command: string,
  args: string[],
  opts: ExecOptions,
) => Promise<ExecResult>;

export interface DoctorChannel {
  status?: string;
  message?: string;
  active_backend?: string | null;
}

export type DoctorReport = Record<string, DoctorChannel>;

export interface AgentReachDeps {
  exec: ExecFn;
  doctor: () => Promise<DoctorReport | null>;
  env: NodeJS.ProcessEnv;
  which: (command: string) => boolean;
}

const EXTERNAL_SOURCES = new Set<ExternalSource>(["web", "reddit", "youtube", "x"]);
const WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 2;
const callStamps = new Map<string, number[]>();

export function resetAgentReachRateLimit(): void {
  callStamps.clear();
}

function takeCallToken(source: string, now = Date.now()): boolean {
  const stamps = (callStamps.get(source) || []).filter((stamp) => now - stamp < WINDOW_MS);
  if (stamps.length >= MAX_CALLS_PER_WINDOW) {
    callStamps.set(source, stamps);
    return false;
  }
  stamps.push(now);
  callStamps.set(source, stamps);
  return true;
}

export function isAgentReachEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.AGENT_REACH_ENABLED || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function allowedExternalChannels(
  env: NodeJS.ProcessEnv = process.env,
): Set<ExternalSource> {
  const allowed = new Set<ExternalSource>();
  for (const part of (env.AGENT_REACH_CHANNELS || "").split(",")) {
    const name = part.trim().toLowerCase();
    if (name === "twitter") allowed.add("x");
    else if (EXTERNAL_SOURCES.has(name as ExternalSource)) {
      allowed.add(name as ExternalSource);
    }
  }
  return allowed;
}

export function commandExists(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const pathValue = env.PATH || "";
  for (const dir of pathValue.split(delimiter)) {
    if (!dir) continue;
    try {
      accessSync(join(dir, command), fsConstants.X_OK);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

function definedEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const copy: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") copy[key] = value;
  }
  return copy;
}

export function childEnv(
  env: NodeJS.ProcessEnv,
  source?: ExternalSource,
): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "HOME", "LANG", "HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]) {
    if (typeof env[key] === "string") next[key] = env[key];
  }
  if (!next.LANG) next.LANG = "C.UTF-8";
  if (source === "x") {
    if (typeof env.TWITTER_AUTH_TOKEN === "string") {
      next.TWITTER_AUTH_TOKEN = env.TWITTER_AUTH_TOKEN;
    }
    if (typeof env.TWITTER_CT0 === "string") next.TWITTER_CT0 = env.TWITTER_CT0;
  }
  return next;
}

export const defaultExec: ExecFn = (command, args, opts) =>
  new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        timeout: opts.timeoutMs,
        maxBuffer: 256 * 1024,
        env: definedEnv(opts.env),
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const exitCode =
          error && typeof (error as { code?: unknown }).code === "number"
            ? (error as { code: number }).code
            : error
              ? 1
              : 0;
        resolve({
          stdout: stdout?.toString() ?? "",
          stderr: stderr?.toString() ?? "",
          code: exitCode,
        });
      },
    );
  });

let doctorCache: { at: number; report: DoctorReport } | null = null;

export function resetDoctorCache(): void {
  doctorCache = null;
}

export async function defaultDoctor(
  exec: ExecFn = defaultExec,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DoctorReport | null> {
  if (!commandExists("agent-reach", env)) return null;
  if (doctorCache && Date.now() - doctorCache.at < 5 * 60 * 1000) {
    return doctorCache.report;
  }
  const result = await exec("agent-reach", ["doctor", "--json"], {
    timeoutMs: 8_000,
    env: childEnv(env),
  });
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "agent-reach doctor failed");
  }
  const parsed = JSON.parse(result.stdout) as DoctorReport;
  doctorCache = { at: Date.now(), report: parsed };
  return parsed;
}

export function defaultAgentReachDeps(
  env: NodeJS.ProcessEnv = process.env,
): AgentReachDeps {
  return {
    exec: defaultExec,
    doctor: () => defaultDoctor(defaultExec, env),
    env,
    which: (command) => commandExists(command, env),
  };
}

const DOCTOR_KEY: Record<ExternalSource, string> = {
  web: "exa_search",
  youtube: "youtube",
  reddit: "reddit",
  x: "twitter",
};

function failureWarning(source: string, result: ExecResult): ResearchWarning {
  const blob = `${result.stderr}\n${result.stdout}`;
  if (/429|rate limit|too many requests/i.test(blob)) {
    return {
      code: "channel_rate_limited",
      source,
      message: `${source} was rate limited. No retry was attempted.`,
    };
  }
  if (result.code === 401 || result.code === 403 || /\b(401|403)\b|unauthorized|forbidden/i.test(blob)) {
    return {
      code: "channel_auth_failed",
      source,
      message: `${source} rejected the session or credentials.`,
    };
  }
  return {
    code: "channel_failed",
    source,
    message: result.stderr.trim() || result.stdout.trim() || `${source} command failed`,
  };
}

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as RawRecord;
}

function collectRecords(value: unknown): RawRecord[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return collectRecords(JSON.parse(trimmed));
      } catch {
        return [];
      }
    }
    return [];
  }
  if (Array.isArray(value)) return value.flatMap((item) => collectRecords(item));
  const record = asRecord(value);
  if (!record) return [];
  if (
    typeof record.title === "string" ||
    typeof record.url === "string" ||
    typeof record.webpage_url === "string" ||
    typeof record.text === "string" ||
    typeof record.selftext === "string"
  ) {
    return [record];
  }
  for (const key of ["results", "posts", "data", "items", "tweets", "videos", "content"]) {
    if (key in record) {
      const nested = collectRecords(record[key]);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function parseYamlList(stdout: string): RawRecord[] {
  const trimmed = stdout.trim();
  if (!trimmed.startsWith("- ") && !trimmed.includes("\n- ")) return [];
  const chunks = trimmed.split(/\n(?=- )/).map((chunk) => chunk.replace(/^- /, ""));
  const records: RawRecord[] = [];
  for (const chunk of chunks) {
    const record: RawRecord = {};
    for (const line of chunk.split("\n")) {
      const match = line.match(/^\s*([A-Za-z0-9_]+):\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      record[match[1]] = value;
    }
    if (Object.keys(record).length > 0) records.push(record);
  }
  return records;
}

export function parseExternalRecords(stdout: string): { records: RawRecord[]; malformed: boolean } {
  const trimmed = stdout.trim();
  if (!trimmed) return { records: [], malformed: false };
  const lines = trimmed.split("\n").filter((line) => line.trim());
  if (lines.every((line) => line.trim().startsWith("{") || line.trim().startsWith("["))) {
    const records: RawRecord[] = [];
    for (const line of lines) {
      try {
        records.push(...collectRecords(JSON.parse(line)));
      } catch {
        return { records: [], malformed: true };
      }
    }
    return { records, malformed: records.length === 0 };
  }
  try {
    const records = collectRecords(JSON.parse(trimmed));
    if (records.length > 0) return { records, malformed: false };
  } catch {
    // Fall through to YAML.
  }
  const yaml = parseYamlList(trimmed);
  if (yaml.length > 0) return { records: yaml, malformed: false };
  return { records: [], malformed: true };
}

function stringField(record: RawRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function mapRecord(query: string, source: ExternalSource, record: RawRecord): ResearchHit | null {
  const url = stringField(record, ["url", "webpage_url", "link", "permalink"]);
  const platform = source === "web" ? anecdotalPlatform(url) : undefined;
  const resolved = platform || source;
  const title =
    stringField(record, ["title", "name"]) ||
    stringField(record, ["text", "selftext", "description", "body"]).slice(0, 80);
  const body = stringField(record, [
    "selftext",
    "text",
    "description",
    "body",
    "excerpt",
    "summary",
    "content",
  ]);
  if (!title && !body) return null;
  const sanitized = sanitizeUntrusted(body || title);
  const sourceClass: SourceClass = resolved === "web" ? classifyUrl(url) : "anecdotal";
  const claimRole =
    resolved === "web" ? claimRoleForClass(sourceClass) : "anecdotal_report";
  const sourceName =
    resolved === "web" ? "web" : resolved === "x" ? "x" : resolved;
  const publishedAt = parseLooseDate(
    stringField(record, [
      "publishedDate",
      "published_at",
      "upload_date",
      "created_at",
      "created",
      "date",
    ]),
  );
  const section: ResearchSection = resolved === "web" ? "web" : "discussion";
  return {
    title: title || sanitized.text.slice(0, 80),
    source: sourceName,
    sourceClass,
    claimRole,
    section,
    url: url || undefined,
    publishedAt,
    dateUnknown: !publishedAt,
    excerpt: sanitized.text,
    excerptTruncated: sanitized.truncated,
    framing: framingFor({ source: sourceName, claimRole, sourceClass }),
    lexicalOverlap: lexicalOverlap(query, `${title}\n${sanitized.text}`),
  };
}

function commandFor(
  source: ExternalSource,
  query: string,
  limit: number,
  deps: AgentReachDeps,
): { command: string; args: string[] } | ResearchWarning {
  if (source === "youtube") {
    if (!deps.which("yt-dlp")) {
      return {
        code: "channel_not_configured",
        source,
        message: "yt-dlp is not on PATH.",
      };
    }
    return {
      command: "yt-dlp",
      args: ["--dump-json", "--no-warnings", "--skip-download", `ytsearch${limit}:${query}`],
    };
  }
  if (source === "web") {
    if (!deps.which("mcporter")) {
      return {
        code: "channel_not_configured",
        source,
        message: "mcporter is not on PATH, so Exa web search is unavailable.",
      };
    }
    return {
      command: "mcporter",
      args: ["call", "exa.web_search_exa", `query=${query}`, `numResults=${limit}`],
    };
  }
  if (source === "reddit") {
    if (deps.which("rdt")) {
      return { command: "rdt", args: ["search", query, "--limit", String(limit)] };
    }
    if (deps.which("opencli")) {
      return { command: "opencli", args: ["reddit", "search", query, "-f", "yaml"] };
    }
    return {
      code: "channel_not_configured",
      source,
      message: "Neither rdt nor opencli is on PATH. Reddit has no anonymous access path.",
    };
  }
  if (!deps.which("twitter")) {
    return {
      code: "channel_not_configured",
      source,
      message: "twitter is not on PATH.",
    };
  }
  if (!deps.env.TWITTER_AUTH_TOKEN || !deps.env.TWITTER_CT0) {
    return {
      code: "channel_not_configured",
      source,
      message: "X search needs TWITTER_AUTH_TOKEN and TWITTER_CT0 on the MCP server. Browser cookies are not read.",
    };
  }
  return { command: "twitter", args: ["search", query, "-n", String(limit)] };
}

async function gateChannel(
  source: ExternalSource,
  deps: AgentReachDeps,
): Promise<ResearchWarning | undefined> {
  let report: DoctorReport | null;
  try {
    report = await deps.doctor();
  } catch (error) {
    return {
      code: "channel_failed",
      source,
      message: error instanceof Error ? error.message : "agent-reach doctor failed",
    };
  }
  if (!report) {
    return {
      code: "agent_reach_unavailable",
      source,
      message: "agent-reach is not installed.",
    };
  }
  const channel = report[DOCTOR_KEY[source]];
  if (!channel || channel.status === "off") {
    return {
      code: "channel_not_configured",
      source,
      message: channel?.message || `${source} is not available in agent-reach doctor.`,
    };
  }
  if (channel.status === "error") {
    return {
      code: "channel_failed",
      source,
      message: channel.message || `${source} doctor status is error.`,
    };
  }
  return undefined;
}

export function createExternalProvider(
  source: ExternalSource,
  deps: AgentReachDeps,
): ResearchProvider {
  return {
    id: source,
    async search(query, opts): Promise<ProviderOutcome> {
      const command = commandFor(source, query, opts.limit, deps);
      if ("code" in command) return { hits: [], warnings: [command] };
      const gated = await gateChannel(source, deps);
      if (gated) return { hits: [], warnings: [gated] };
      if (!takeCallToken(source)) {
        return {
          hits: [],
          warnings: [
            {
              code: "channel_rate_limited",
              source,
              message: "Local limit of 2 external calls per minute was reached. No command was run.",
            },
          ],
        };
      }
      let result: ExecResult;
      try {
        result = await deps.exec(command.command, command.args, {
          timeoutMs: 20_000,
          env: childEnv(deps.env, source),
        });
      } catch (error) {
        return {
          hits: [],
          warnings: [
            {
              code: "channel_failed",
              source,
              message: error instanceof Error ? error.message : `${source} command failed`,
            },
          ],
        };
      }
      if (result.code !== 0) return { hits: [], warnings: [failureWarning(source, result)] };
      const parsed = parseExternalRecords(result.stdout);
      if (parsed.malformed) {
        return {
          hits: [],
          warnings: [
            {
              code: "malformed_results",
              source,
              message: `${source} returned a response that could not be parsed. The raw text was discarded.`,
            },
          ],
        };
      }
      const hits = parsed.records
        .map((record) => mapRecord(query, source, record))
        .filter((hit): hit is ResearchHit => Boolean(hit))
        .slice(0, opts.limit);
      const warnings: ResearchWarning[] = [];
      if (hits.length === 0) {
        warnings.push({
          code: "no_results",
          source,
          message: `No ${source} records were returned.`,
        });
      }
      if (hits.some((hit) => hit.excerptTruncated)) {
        warnings.push({
          code: "excerpt_truncated",
          source,
          message: `${source} text was cut to ${500} characters.`,
        });
      }
      return { hits, warnings };
    },
  };
}

export function externalProviders(
  requested: string[],
  deps: AgentReachDeps,
): { providers: ResearchProvider[]; warnings: ResearchWarning[] } {
  const wanted = requested.filter((source): source is ExternalSource =>
    EXTERNAL_SOURCES.has(source as ExternalSource),
  );
  if (wanted.length === 0) return { providers: [], warnings: [] };
  if (!isAgentReachEnabled(deps.env)) {
    return {
      providers: [],
      warnings: [
        {
          code: "agent_reach_unavailable",
          message:
            "Broader web and social sources were requested, but AGENT_REACH_ENABLED is off. Official medical sections are unchanged.",
        },
      ],
    };
  }
  const allowed = allowedExternalChannels(deps.env);
  const providers: ResearchProvider[] = [];
  const warnings: ResearchWarning[] = [];
  for (const source of wanted) {
    if (!allowed.has(source)) {
      warnings.push({
        code: "channel_not_configured",
        source,
        message: `${source} is not listed in AGENT_REACH_CHANNELS.`,
      });
      continue;
    }
    providers.push(createExternalProvider(source, deps));
  }
  return { providers, warnings };
}

export async function agentReachHealthLine(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  if (!commandExists("agent-reach", env)) {
    return "Agent Reach: not installed. research-medical-topic still returns FDA, FAERS, PubMed, and trial sections. Web, Reddit, YouTube, and X stay unavailable.\n";
  }
  try {
    const report = await defaultDoctor(defaultExec, env);
    if (!report) {
      return "Agent Reach: not installed.\n";
    }
    const counts = { ok: 0, warn: 0, off: 0, error: 0 };
    for (const channel of Object.values(report)) {
      const status = channel.status || "off";
      if (status === "ok" || status === "warn" || status === "off" || status === "error") {
        counts[status] += 1;
      }
    }
    return `Agent Reach: installed (ok ${counts.ok}, warn ${counts.warn}, off ${counts.off}, error ${counts.error}). Doctor does not log in or read browser cookies. Broader sources run only when AGENT_REACH_ENABLED is set and the caller asks for them.\n`;
  } catch {
    return "Agent Reach: installed, but doctor could not be read. Official medical sections are unaffected.\n";
  }
}
