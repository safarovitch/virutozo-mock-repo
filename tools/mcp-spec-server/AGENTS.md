# tools/mcp-spec-server — local guide

**Purpose:** the `nimbus-spec` MCP server (SPEC.md §11.5, TECH-8): agents query requirements, ACs, operations, permissions and test coverage instead of guessing. Registered in the root `.mcp.json` (D9-02).

**Framework and key libraries:** `@modelcontextprotocol/sdk` (stdio transport, `registerTool` with Zod input shapes), `yaml` for `contracts/openapi.yaml`. Plain `.mjs` with `// @ts-check`.

**Owns:** `src/knowledge.mjs` (pure lookups: `getRequirement`, `searchSpecs`, `getOperation`, `getPermissions`, `coverageFor`) and `src/main.mjs` (the five tools). It reads the repo on every call and never writes or calls the network.

**Local commands:** `pnpm nx run mcp-spec-server:test` (lookups against the real repo, plus a stdio round trip) · `pnpm --filter @nimbus/mcp-spec-server start` (stdio; an MCP client normally starts it).

**Local pitfalls**
- Keep it `.mjs`: MCP clients start it with the shell's default Node (20 here), which can't load TypeScript.
- Nothing may write to stdout except the transport (it's the JSON-RPC channel). Log with `console.error` if you must.
- The parsers follow the spec formats: AC rows `| **AC-X-n.m** | … | \`status\` |`, feature front matter (`id`, `title`) with `**Implements:**`, the RBAC matrix header `| Permission | provider_admin | …`. Change a format there and the tests here fail first.
- `coverage_for` reports `lastCiStatus: "unknown"` locally (D9-10); it never calls GitHub.
