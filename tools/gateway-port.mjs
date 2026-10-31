// The gateway's port for local stacks: GATEWAY_PORT from the environment, else from the repo's `.env`
// (see `.env.example`), else 8080. Playwright (baseURL, webServer) and tools/run-stack.mjs (gateway
// PORT, APP_ORIGINS) both call this, so they can't disagree. Variables already set win over `.env`.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url));

/** @returns {number} */
export function gatewayPort() {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  const raw = process.env.GATEWAY_PORT ?? '8080';
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`GATEWAY_PORT must be a port number (1–65535), got "${raw}"`);
  }
  return port;
}
