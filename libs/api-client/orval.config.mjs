// Orval 8.45.0, based on docs/reference/orval.config.mjs (TECH-2).
// The WebSocket operation `events` (tag Realtime) gets no fetch hook or MSW handler (D2-04): it's excluded
// from the React and Vue outputs, but its models stay (includeUnreferencedSchemas) and its Zod schema is
// generated, so the shell can validate ServerEvent messages (RT-2).
const input = '../../contracts/openapi.yaml';
const withoutRealtime = {
  target: input,
  filters: { mode: 'exclude', tags: ['Realtime'], includeUnreferencedSchemas: true },
};
const override = { mutator: { path: './src/http.ts', name: 'customFetch' } };

export default {
  react: {
    input: withoutRealtime,
    output: {
      mode: 'tags-split',
      target: 'src/generated/react/endpoints.ts',
      schemas: 'src/generated/model',
      client: 'react-query',
      mock: true, // MSW handlers + Faker data for component tests and Storybook
      override,
    },
  },
  vue: {
    input: withoutRealtime,
    output: {
      mode: 'tags-split',
      target: 'src/generated/vue/endpoints.ts',
      schemas: 'src/generated/model',
      client: 'vue-query',
      override,
    },
  },
  zod: {
    input,
    output: {
      mode: 'tags-split',
      target: 'src/generated/zod/endpoints.ts',
      client: 'zod',
      fileExtension: '.zod.ts',
    },
  },
};
