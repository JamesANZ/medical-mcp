#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = dirname(__dirname);
const buildPath = join(packageDir, "build", "index.js");

// Spawn the actual server with all arguments
const serverProcess = spawn("node", [buildPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: false,
});

serverProcess.on("close", (code) => {
  process.exit(code || 0);
});
