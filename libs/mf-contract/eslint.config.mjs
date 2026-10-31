// F11: libs/mf-contract may import the generated models as types only, never values,
// so it has no runtime dependency on @nimbus/api-client.
import root from '../../eslint.config.mjs';

export default [
  ...root,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nimbus/api-client', '@nimbus/api-client/*'],
              allowTypeImports: true,
              message: 'libs/mf-contract may only import types from @nimbus/api-client (F11).',
            },
          ],
        },
      ],
    },
  },
];
