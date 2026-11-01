// Shared singletons, declared once (ADR-0001 R2, MF-2). Imported by every vite.config.ts.
// Changing this list needs an ADR (AGENTS.md H11).

type SharedConfig = Record<string, { singleton: boolean; requiredVersion?: string }>;

/** React apps: shell, tenants, storage. */
export function reactShared(): SharedConfig {
  return {
    react: { singleton: true, requiredVersion: '^19.0.0' },
    'react/jsx-runtime': { singleton: true, requiredVersion: '^19.0.0' },
    'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
    'react-dom/client': { singleton: true, requiredVersion: '^19.0.0' },
    '@nimbus/design-tokens': { singleton: true },
    '@tanstack/react-query': { singleton: true, requiredVersion: '^5.105.0' }, // library shared, caches not (MF-2, D5-19)
    '@nimbus/ui-kit': { singleton: true }, // D1-11
  };
}

/** The Vue remote (compute). Vue and Vue Query are bundled, not shared with the shell. */
export function vueShared(): SharedConfig {
  return {
    '@nimbus/design-tokens': { singleton: true },
  };
}
