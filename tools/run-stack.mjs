// Starts mock-api (4000) and the gateway (PORT, default 8080) together for `pnpm e2e:stack` and
// `pnpm demo:local`. Builds are done before this runs. Stops both when either exits or on Ctrl+C.
//   node tools/run-stack.mjs e2e         NIMBUS_MODE=e2e (deterministic: no latency, no random failures)
//   node tools/run-stack.mjs demo-local  NIMBUS_MODE=e2e with MOCK_LATENCY_MS=150, MOCK_FAILURE_RATE=0.1
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const variant = process.argv[2] ?? 'e2e';
const port = process.env.PORT ?? '8080';

// D2-09: the gateway's own origin must be allowed, also when PORT isn't 8080.
const origins = new Set([`http://localhost:${port}`, 'http://localhost:4200', 'https://localhost:8443']);
const common = { ...process.env, NIMBUS_MODE: 'e2e', APP_ORIGINS: [...origins].join(',') };
const mockEnv = { ...common, PORT: '4000', ...(variant === 'demo-local' ? { MOCK_LATENCY_MS: '150', MOCK_FAILURE_RATE: '0.1' } : {}) };
const gatewayEnv = { ...common, PORT: port };

const children = [
  spawn('pnpm', ['--filter', '@nimbus/mock-api', 'start'], { cwd: REPO, env: mockEnv, stdio: 'inherit' }),
  spawn(process.execPath, ['apps/gateway/src/main.mjs'], { cwd: REPO, env: gatewayEnv, stdio: 'inherit' }),
];

let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 500).unref();
};
for (const child of children) child.on('exit', (code) => stop(code ?? 1));
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
