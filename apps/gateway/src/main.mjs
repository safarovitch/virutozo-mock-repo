// Starts the gateway. Config errors stop the process with a clear message (specs/mock-data.md §8).
import { buildGateway } from './app.mjs';
import { parseConfig } from './config.mjs';

let config;
try {
  config = parseConfig(process.env);
} catch (error) {
  console.error('[nimbus][gateway] invalid configuration:', error instanceof Error ? error.message : error);
  process.exit(1);
}

const app = await buildGateway(config);
await app.listen({ port: config.port, host: '127.0.0.1' });
console.log(
  `[nimbus][gateway] mode=${config.mode} port=${config.port} tls=${Boolean(config.tls)} ` +
    `testEndpoints=${config.testEndpoints} failRemotes=${[...config.failRemotes].join(',') || '-'} api=${config.mockApiUrl}`,
);
