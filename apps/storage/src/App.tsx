import type { RemoteContext } from '@nimbus/mf-contract';

// Day 1 placeholder (TECH-1). Buckets arrive with SPEC-STO-1 on Day 8.
export function App({ ctx }: { ctx: RemoteContext }) {
  return (
    <section>
      <h1>Storage</h1>
      <p>
        Mounted at <code>{ctx.basePath}</code>
      </p>
    </section>
  );
}
