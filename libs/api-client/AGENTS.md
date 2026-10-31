# libs/api-client — local guide

**Purpose:** the generated API client (TECH-2): React and Vue Query hooks, models, Zod schemas, MSW handlers (all in `src/generated/`, committed), plus `customFetch`, `configureApiClient`, `ApiError` and `messageFor`.

**Framework and key libraries:** Orval 8.45.0, TanStack Query 5.105.0 (React and Vue), Zod 4, MSW 3 with Faker.

**Owns:** every HTTP call from app code (H2); CSRF header, 401 handling, response validation (API-5); the route → response-schema map (`scripts/response-schemas.mjs`, D2-03).

**Local commands:** `pnpm contract:build && pnpm api:generate` · `pnpm nx run api-client:test`.

**Local pitfalls**
- Never edit `src/generated/**` (H1, blocked by `guard-paths`); change `contracts/main.tsp` and regenerate. CI's `ci/contract-check` fails on any drift.
- `customFetch` throws `ApiError` on non-2xx, so React/Vue Query see errors as errors.
- The WebSocket `events` operation has no hook on purpose (D2-04); use `libs/realtime`.
- `Problem` has a hand-written Zod schema in `src/problem.ts`, tied to the generated type with `satisfies`.
