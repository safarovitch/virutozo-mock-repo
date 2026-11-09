// @ts-check
// MCP spec server over stdio (SPEC.md §11.5, TECH-8). Registered for agents in the repo's `.mcp.json`
// (D9-02). Every tool reads the repo only; nothing is written and nothing goes over the network.
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { coverageFor, getOperation, getPermissions, getRequirement, loadKnowledge, searchSpecs } from './knowledge.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const json = (/** @type {unknown} */ value) => ({ content: [{ type: /** @type {const} */ ('text'), text: JSON.stringify(value, null, 2) }] });
// Re-read the repo on every call: specs change while an agent works.
const kb = () => loadKnowledge(REPO);

const server = new McpServer({ name: 'nimbus-spec', version: '1.0.0' });

server.registerTool(
  'get_requirement',
  { description: 'Text of a requirement, user story, spec, AC or rule ID (REQ-3, SPEC-TEN-2, AC-TEN-2.4, RT-1) with parent and child IDs and the AC status.', inputSchema: { id: z.string().describe('e.g. AC-TEN-2.4') } },
  async ({ id }) => json(getRequirement(kb(), id)),
);
server.registerTool(
  'search_specs',
  { description: 'Search SPEC.md and specs/ for sections containing all the words; returns file, heading, IDs and a snippet.', inputSchema: { query: z.string() } },
  async ({ query }) => json(searchSpecs(kb(), query)),
);
server.registerTool(
  'get_operation',
  { description: 'An API operation from contracts/openapi.yaml: method, path, required permission (x-permission), parameters, request and response schemas, error statuses.', inputSchema: { operationId: z.string().describe('e.g. createBucket') } },
  async ({ operationId }) => json(getOperation(kb(), operationId)),
);
server.registerTool(
  'get_permissions',
  { description: 'RBAC matrix rows (specs/shared/rbac.md): a role gives its permissions and scopes; a permission gives which roles have it.', inputSchema: { roleOrPermission: z.string().describe('e.g. reseller_admin or bucket:create') } },
  async ({ roleOrPermission }) => json(getPermissions(kb(), roleOrPermission)),
);
server.registerTool(
  'coverage_for',
  { description: 'Tests titled with an AC ID (file, line, title), the AC status and the last CI status ("unknown" locally).', inputSchema: { acId: z.string() } },
  async ({ acId }) => json(coverageFor(kb(), acId)),
);

await server.connect(new StdioServerTransport());
