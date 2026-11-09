// Starts mock-api. Config errors stop the process with a clear message (specs/mock-data.md §8).
import { buildMockApi } from './app';
import { describeConfig, parseConfig, type MockApiConfig } from './config';

let config: MockApiConfig;
try {
  config = parseConfig(process.env);
} catch (error) {
  console.error('[mock-api] invalid configuration:', error instanceof Error ? error.message : error);
  process.exit(1);
}

const app = await buildMockApi(config);
await app.listen({ port: config.port, host: '127.0.0.1' });
console.log(describeConfig(config)); // logged once
