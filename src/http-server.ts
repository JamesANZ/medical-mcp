import { IncomingMessage, ServerResponse } from "http";
import { ServerConfig, getServerInfo } from "./config.js";

export interface HttpServerOptions {
  config: ServerConfig;
  onShutdown?: () => void;
}

export async function createHttpServer(options: HttpServerOptions) {
  const { config, onShutdown } = options;
  const http = await import("http");

  const server = http.createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      handleRequest(req, res, config);
    },
  );

  return new Promise<typeof server>((resolve) => {
    server.listen(config.port, config.bindIP, () => {
      displayServerStartupInfo(config);
      resolve(server);
    });

    // Setup graceful shutdown
    setupGracefulShutdown(server, onShutdown);
  });
}

function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: ServerConfig,
): void {
  // Security check
  if (!isRequestAllowed(req, res, config)) {
    return;
  }

  // Set CORS headers
  setCorsHeaders(res, config);

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Route requests
  if (req.url === "/info") {
    handleInfoRequest(res, config);
  } else {
    handleDefaultRequest(res, config);
  }
}

function isRequestAllowed(
  req: IncomingMessage,
  res: ServerResponse,
  config: ServerConfig,
): boolean {
  // Allow all requests if external access is enabled
  if (config.allowExternal) {
    return true;
  }

  // Check for localhost connections
  const clientIP = req.connection.remoteAddress || req.socket.remoteAddress;
  const isLocalhost =
    clientIP === "127.0.0.1" ||
    clientIP === "::1" ||
    clientIP === "::ffff:127.0.0.1" ||
    req.headers.host?.startsWith("localhost:") ||
    req.headers.host?.startsWith("127.0.0.1:");

  if (!isLocalhost) {
    console.error(
      `🚨 BLOCKED: Non-localhost connection attempt from ${clientIP}`,
    );
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Access denied: This server is restricted to localhost only");
    return false;
  }

  return true;
}

function setCorsHeaders(res: ServerResponse, config: ServerConfig): void {
  res.setHeader(
    "Access-Control-Allow-Origin",
    config.allowExternal ? "*" : "http://localhost:*",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function handleInfoRequest(res: ServerResponse, config: ServerConfig): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(getServerInfo(config)));
}

function handleDefaultRequest(res: ServerResponse, config: ServerConfig): void {
  res.writeHead(200, { "Content-Type": "text/plain" });
  const mode = config.allowExternal ? "External Access" : "Localhost Only";
  res.end(
    `Medical MCP Server - ${mode} Mode\nUse stdio transport for full MCP functionality.`,
  );
}

function displayServerStartupInfo(config: ServerConfig): void {
  console.error(
    `✅ Medical MCP Server running on http://${config.bindIP}:${config.port}`,
  );

  if (config.allowExternal) {
    console.error("⚠️  WARNING: External access enabled - use with caution!");
  } else {
    console.error("🔒 Security: Bound to localhost only (127.0.0.1)");
  }

  console.error(
    `📝 Info endpoint: http://${config.bindIP}:${config.port}/info`,
  );
  console.error("⚠️  Note: Use stdio transport for full MCP functionality");
}

function setupGracefulShutdown(server: any, onShutdown?: () => void): void {
  process.on("SIGINT", () => {
    console.error("\n🛑 Shutting down Medical MCP Server...");
    server.close(() => {
      console.error("✅ Server stopped");
      onShutdown?.();
      process.exit(0);
    });
  });
}
