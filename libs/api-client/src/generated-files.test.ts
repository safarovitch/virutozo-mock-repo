// BUG-6: `src/generated/**` holds exactly what Orval writes (`.ts`). Stray compiler output (`.js`) next to
// the generated sources shadowed them (bundlers resolve `.js` first), so contract changes to constants
// such as `Permission` never reached the apps.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const GENERATED = fileURLToPath(new URL('./generated', import.meta.url));
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));

describe('generated client', () => {
  it('BUG-6: contains no JavaScript files that could shadow the generated TypeScript', () => {
    expect(files(GENERATED).filter((f) => /\.(m?js|cjs)$/.test(f)).map((f) => path.relative(GENERATED, f))).toEqual([]);
  });
});
