// Reference Orval config, verified on 2026-10-30 against contracts/openapi.yaml with orval 8.45.0:
// all outputs generate and pass `tsc --strict --noUncheckedIndexedAccess`.
// Day 2: copy into libs/api-client/orval.config.mjs and add the custom mutator (src/http.ts).
const input = '../../contracts/openapi.yaml';
const override = { mutator: { path: './src/http.ts', name: 'customFetch' } };

export default {
  react: {
    input,
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
    input,
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
