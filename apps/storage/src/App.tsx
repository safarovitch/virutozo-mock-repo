import type { RemoteContext } from '@nimbus/mf-contract';

// Day 1 placeholder (TECH-1). Buckets arrive with SPEC-STO-1 on Day 8.
export function App({ ctx }: { ctx: RemoteContext }) {
  // SPEC-SHL-4: a render-time crash for tests, removed from production builds (ci/no-test-hooks).
  if (import.meta.env.MODE !== 'production' && ctx.path.split(/[?#]/)[0] === '/__crash') return <Crash />;
  return (
    <section>
      <h1>Storage</h1>
      <p>
        Mounted at <code>{ctx.basePath}</code>
      </p>
    </section>
  );
}

function Crash(): never {
  throw new Error('storage: render crash for tests');
}
