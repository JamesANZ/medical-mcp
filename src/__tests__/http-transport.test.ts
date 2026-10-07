import type { Server } from "node:http";
import { cacheManager } from "../cache/manager.js";
import { startHttpServer } from "../index.js";

interface JsonRpc {
  jsonrpc: string;
  id?: number | null;
  result?: {
    serverInfo?: { name?: string };
    content?: Array<{ type: string; text?: string }>;
  };
  error?: { code: number; message: string };
}

function endpoint(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("HTTP server did not bind a TCP port");
  }
  return `http://127.0.0.1:${address.port}/mcp`;
}

async function postMcp(url: string, message: unknown): Promise<JsonRpc> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(message),
  });
  const text = await response.text();
  expect(response.status).toBe(200);
  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) {
    throw new Error(`Expected an SSE data line, got: ${text}`);
  }
  return JSON.parse(dataLine.slice("data: ".length)) as JsonRpc;
}

function cacheStatsCall(id: number) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: "get-cache-stats", arguments: {} },
  };
}

describe("streamable HTTP transport", () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    server = await startHttpServer({ port: 0, host: "127.0.0.1" });
    url = endpoint(server);
  });

  afterAll(async () => {
    cacheManager.stopCleanup();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  test("initialize returns this server", async () => {
    const body = await postMcp(url, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "http-transport-test", version: "0" },
      },
    });

    expect(body.id).toBe(1);
    expect(body.result?.serverInfo?.name).toBe("medical-mcp");
  });

  test("calls get-cache-stats twice in sequence", async () => {
    const first = await postMcp(url, cacheStatsCall(2));
    const second = await postMcp(url, cacheStatsCall(3));

    expect(first.id).toBe(2);
    expect(second.id).toBe(3);
    expect(first.result?.content?.[0]?.text).toContain("Cache Statistics");
    expect(second.result?.content?.[0]?.text).toContain("Cache Statistics");
  });

  test("liveness and readiness do not depend on upstream APIs", async () => {
    const origin = url.replace(/\/mcp$/, "");
    const [live, ready] = await Promise.all([
      fetch(`${origin}/healthz`),
      fetch(`${origin}/readyz`),
    ]);
    expect(live.status).toBe(200);
    expect(await live.json()).toEqual({ status: "ok" });
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: "ready" });
  });

  test("answers two concurrent tool calls on their own connections", async () => {
    const [left, right] = await Promise.all([
      postMcp(url, cacheStatsCall(4)),
      postMcp(url, cacheStatsCall(5)),
    ]);

    expect(left.id).toBe(4);
    expect(right.id).toBe(5);
    expect(left.result?.content?.[0]?.text).toContain("Cache Statistics");
    expect(right.result?.content?.[0]?.text).toContain("Cache Statistics");
    expect(left.error).toBeUndefined();
    expect(right.error).toBeUndefined();
  });
});
