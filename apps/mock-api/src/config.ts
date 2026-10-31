// mock-api configuration (specs/mock-data.md §8). NIMBUS_MODE is required and sets the defaults;
// MOCK_* variables override them. Validated with Zod at start-up; NODE_ENV is never read.
import { z } from 'zod';

const MODES = {
  dev: { latencyMs: 150, failureRate: 0.1, testEndpoints: true },
  e2e: { latencyMs: 0, failureRate: 0, testEndpoints: true },
  demo: { latencyMs: 150, failureRate: 0.1, testEndpoints: false },
} as const;

const EnvSchema = z.object({
  NIMBUS_MODE: z.enum(['dev', 'e2e', 'demo'], { error: 'NIMBUS_MODE is required and must be dev, e2e or demo' }),
  PORT: z.coerce.number().int().positive().default(4000),
  MOCK_SEED: z.coerce.number().int().default(42),
  MOCK_LATENCY_MS: z.coerce.number().int().min(0).optional(),
  MOCK_FAILURE_RATE: z.coerce.number().min(0).max(1).optional(),
  MOCK_SESSION_TTL_S: z.coerce.number().int().positive().default(28800),
  APP_ORIGINS: z
    .string()
    .default('http://localhost:8080,http://localhost:4200,https://localhost:8443')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
});

export interface MockApiConfig {
  mode: 'dev' | 'e2e' | 'demo';
  port: number;
  seed: number;
  latencyMs: number;
  failureRate: number;
  sessionTtlS: number;
  appOrigins: string[];
  testEndpoints: boolean;
  /** Not from env: tests shrink task durations and timers with it (1 = real time). */
  timeScale: number;
  /** Not from env: WebSocket heartbeat interval (WS-5), 15 s. */
  heartbeatMs: number;
}

export function parseConfig(env: Record<string, string | undefined>): MockApiConfig {
  const e = EnvSchema.parse(env);
  const defaults = MODES[e.NIMBUS_MODE];
  return {
    mode: e.NIMBUS_MODE,
    port: e.PORT,
    seed: e.MOCK_SEED,
    latencyMs: e.MOCK_LATENCY_MS ?? defaults.latencyMs,
    failureRate: e.MOCK_FAILURE_RATE ?? defaults.failureRate,
    sessionTtlS: e.MOCK_SESSION_TTL_S,
    appOrigins: e.APP_ORIGINS,
    testEndpoints: defaults.testEndpoints,
    timeScale: 1,
    heartbeatMs: 15_000,
  };
}

export function describeConfig(c: MockApiConfig): string {
  return (
    `[mock-api] mode=${c.mode} port=${c.port} latency=${c.latencyMs} failureRate=${c.failureRate} ` +
    `seed=${c.seed} sessionTtl=${c.sessionTtlS} testEndpoints=${c.testEndpoints} origins=${c.appOrigins.join(',')}`
  );
}
