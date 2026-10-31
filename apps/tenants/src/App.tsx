import type { RemoteContext } from '@nimbus/mf-contract';

// Day 1 placeholder (TECH-1). The tenant list arrives with SPEC-TEN-1 on Day 5.
export function App({ ctx }: { ctx: RemoteContext }) {
  return (
    <section>
      <h1>Tenants</h1>
      <p>
        Mounted at <code>{ctx.basePath}</code>
      </p>
    </section>
  );
}
