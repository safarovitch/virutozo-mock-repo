// Gateway configuration (specs/mock-data.md §8). Validated with Zod at start-up; NODE_ENV is never read.
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
export const REMOTE_NAMES = /** @type {const} */ (['tenants', 'storage', 'compute']);

const remoteList = z
  .string()
  .default('')
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.enum(REMOTE_NAMES)));

const EnvSchema = z
  .object({
    NIMBUS_MODE: z.enum(['dev', 'e2e', 'demo'], {
      error: 'NIMBUS_MODE is required and must be dev, e2e or demo',
    }),
    GATEWAY_PORT: z.coerce.number().int().positive().max(65535).optional(),
    TLS: z.enum(['0', '1']).default('0'),
    TLS_CERT: z.string().optional(),
    TLS_KEY: z.string().optional(),
    MOCK_API_URL: z.url().default('http://localhost:4000'),
    FAIL_REMOTES: remoteList,
  })
  .refine((e) => e.TLS === '0' || (e.TLS_CERT && e.TLS_KEY), {
    message: 'TLS=1 needs TLS_CERT and TLS_KEY (paths to a certificate and key)',
  });

/**
 * @typedef {object} GatewayConfig
 * @property {'dev' | 'e2e' | 'demo'} mode
 * @property {number} port
 * @property {{ cert: string, key: string } | null} tls
 * @property {string} mockApiUrl
 * @property {Set<string>} failRemotes
 * @property {boolean} testEndpoints
 * @property {string} shellDist
 * @property {Record<string, string>} remoteDists
 * @property {string} manifestPath
 */

/**
 * @param {Record<string, string | undefined>} env
 * @returns {GatewayConfig}
 */
export function parseConfig(env) {
  const e = EnvSchema.parse(env);
  const tls = e.TLS === '1' ? { cert: /** @type {string} */ (e.TLS_CERT), key: /** @type {string} */ (e.TLS_KEY) } : null;
  // BUG-5: test hooks (`/__crash`) exist only in `build-e2e` output, which has its own folder so a
  // production build can never overwrite it. Only the public preview (demo) serves production builds.
  const out = e.NIMBUS_MODE === 'demo' ? 'dist' : 'dist-e2e';
  return {
    mode: e.NIMBUS_MODE,
    port: e.GATEWAY_PORT ?? (tls ? 8443 : 8080),
    tls,
    mockApiUrl: e.MOCK_API_URL,
    failRemotes: new Set(e.FAIL_REMOTES),
    testEndpoints: e.NIMBUS_MODE === 'dev' || e.NIMBUS_MODE === 'e2e',
    shellDist: `${REPO}apps/shell/${out}`,
    remoteDists: Object.fromEntries(REMOTE_NAMES.map((n) => [n, `${REPO}apps/${n}/${out}`])),
    manifestPath: `${REPO}config/remotes.gateway.json`,
  };
}
