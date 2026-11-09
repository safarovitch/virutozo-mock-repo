# Spec review, second pass (v1.2) — 2026-10-30

**Scope:** I re-read `SPEC.md`, `AGENTS.md`, `contracts/main.tsp` and `specs/mock-data.md`, and checked port settings in ADR-0001. No files were changed.

**Result:** v1.2 fixes the four structural blockers (R1–R4) and the realtime ownership gap. The new session and EventBus design adds about 30 new findings (N1–N30). Most findings from the first pass are still open; they're listed compactly in section C.

**A mistake of mine from the last turn:** I changed the `mount.ts` comment from "ADR-0001 R2" to "MF-2" and said R2 was one of my review findings. That was wrong. ADR-0001 has its own rule **R2**, which says Vue Query isn't shared with the shell, so your original reference was correct. MF-2 says the same thing, so the comment isn't wrong now, but my explanation was.

---

## A. Resolved since the last review
- **R1:** tenant roles no longer see the Tenants area. AC-SHL-1.1, AC-SHL-2.1, AC-SHL-3.1 and E2E-5 now agree.
- **R2:** reloads and deep links survive sign-in.
- **R3, R4:** AC status and TECH IDs mean incomplete work no longer fails CI.
- **R32:** only provider and reseller admins see the tenant list now, and both have `plan:read`, so plan names can be shown.
- **R61:** §2.5 defines who owns the WebSocket and how events reach remotes.
- **R91:** "test title starts with the ID" is now consistent everywhere.
- **Partly resolved:**
  - R13: the Vue cache and the socket are now cleared on sign-out, but the e2e check is still unclear.
  - R14: `returnTo` is added, but WebSocket 401s are still open (see N6).
  - R44: the bus exists, but `createTenant` still returns no task.
  - R71: the payload is defined, but ordering is still open (see N18).
  - R18: the four connection states are named, but "offline" isn't defined.

## B. New findings from the v1.2 changes

### Session cookie (SPEC-SHL-1, NFR-SEC-3, ADR-0005)
| # | IDs | Problem |
|---|---|---|
| **N1** | NFR-SEC-3 vs §12 | The main-branch preview deploy puts the shell on GitHub Pages and mock-api on another host. That's **cross-site**, so a `SameSite=Strict` cookie is never sent and the deployed preview can't sign in. Cross-site needs `SameSite=None; Secure` plus CSRF protection, or a single origin behind a proxy. The `Secure` attribute isn't mentioned anywhere. |
| **N2** | mock-data §1, §12 step 8 | CORS and the WebSocket `Origin` check only allow ports 4200–4203. ADR-0001 R4 fixes the **dev** ports only, and CI e2e runs against **preview** servers (Vite's default is 4173). The e2e run can be blocked by CORS. |
| **N3** | H2, TECH-2 | The generated client must send `credentials: 'include'` across origins (4200 → 4000), and the server must answer with `Access-Control-Allow-Credentials`. Neither the Orval config nor the spec says so. A Vite dev proxy that makes the API same-origin would be an alternative; that's a decision to make. |
| **N4** | AC-SHL-1.8 | The `returnTo` check (starts with `/`, not `//`) misses `/\evil.example`, which browsers treat like `//`, and encoded forms such as `/%2F…`. Define it as "parsed with `new URL(returnTo, location.origin)`, and the origin must match", and add those cases to the AC. |
| **N5** | SPEC-SHL-1 | Multiple tabs aren't handled. Signing out, or signing in as **another role**, in tab B swaps the shared cookie, while tab A keeps the old `getMe` permissions in memory and shows actions it no longer has until something returns a 401 or 403. The spec needs either a cross-tab sync rule (for example `BroadcastChannel`) or an explicit statement that this is accepted. |
| **N6** | WS-1, AC-SHL-1.4 | Browsers don't expose the handshake's HTTP status to the WebSocket API; every failure looks like close code 1006. So a 401 on `/events` (`events()` returns `AuthErrors`) can't be told apart from a network drop, and the client keeps retrying forever instead of redirecting. Specify a close code for an expired session, and say the server closes open sockets when the session expires. |
| **N7** | `logout` → `Unauthorized` | Signing out after the session already expired returns 401. Say that a 401 here still counts as a successful sign-out. |
| **N8** | AC-SHL-1.6 | "Given a signed-in user" on `/tenants/t_acme`: a tenant user would get a 403 there. Name the role, for example `provider_admin`. |
| **N9** | AC-SHL-1.4 | It's not defined how the "Your session expired" message reaches `/login` (query parameter or navigation state), or whether it survives a reload of `/login`. |
| **N10** | `Session.expiresAt` | Only `login` returns `expiresAt`; `getMe` doesn't. After a reload the client doesn't know when the session expires. Either say this is fine because expiry is only detected through a 401, or add the field to `Me`. |
| **N11** | mock-data §8 | `MOCK_TOKEN_TTL_S` still says "token" though it now controls the cookie. Cosmetic. |

### Tenant roles without `tenant:read` (§5.2)
| # | IDs | Problem |
|---|---|---|
| **N12** | §1.3, US-1.2 | The `tenant_viewer` persona's goal is "Read-only view of their tenant", but no screen shows their tenant's name, plan or status any more. `Me` has no tenant name and `getTenant` returns 403. |
| **N13** | SPEC-TSK-1, mock-data §7 | The 5 seeded `t_acme` tasks don't say which kinds they are. If any is `tenant.*`, its *View resource* link goes to `/tenants/t_acme`, which is a 403 for tenant roles. |

### Realtime and the EventBus (§2.5, SPEC-SHL-6)
| # | IDs | Problem |
|---|---|---|
| **N14** | RT-8, AC-SHL-6.3, AC-SHL-6.5 | `subscribe()` has no "which remote" argument, so the bus can't log the remote name or count subscriptions per remote. The shell needs to pass each remote its own scoped bus, for example `createScopedBus(bus, 'compute')`. Say so in §2.5. |
| **N15** | RT-4 vs MF-2 | React remotes share **one** query client, so ownership can only be by key prefix, and none are defined. Orval derives query keys from URL paths, so `getQuotas` produces `/tenants/{id}/quotas`, a tenants-owned key that the storage usage card reads. After creating or deleting a bucket, storage has to refresh it, which RT-4 forbids. |
| **N16** | RT-4 vs SPEC-TEN-3 | The tenant drawer's Activity tab (in the tenants remote) lists tasks, but tasks are owned by the shell. |
| **N17** | RT-4 vs compute | It's unclear whether ownership applies across separate caches. When compute mounts, a VM may already have `activeTaskId` set but no progress yet; is compute allowed to `getTask` into its own Vue cache? |
| **N18** | AC-TSK-1.1, `task:started` | `task:started` and the first `server:task.updated` can arrive in either order, because the 202 response can be slower than the WebSocket. A late `task:started` with progress 0 would overwrite newer progress. Merge rule needed: keep the newer status and the higher progress. "Before the first WS event" can't be guaranteed. |
| **N19** | R44 still open | `createTenant` returns `Tenant`, so nothing can publish `task:started` for the provisioning task. Nothing publishes it for suspend or resume (tenants remote) either. |
| **N20** | AC-SHL-6.4 | "The remote shows the reconnecting state", but no remote has any connection UI; WS-4 puts the indicator in the shell header. Name the element, or test it with a bus-level assertion. |
| **N21** | MF-4, §2.5 `mount.ts` | Vue has no error boundary. `errorHandler` publishes `remote:error`, but nothing says the shell then shows the MF-4 error panel for compute. AC-SHL-4.3 ("caught by that remote's error boundary") isn't defined for Vue. |
| **N22** | §2.5 `mount.ts` | `update: () => {}` throws away changes to the context, so session and permission changes never reach compute. The context also still has no current path (R95). |
| **N23** | `session:expired` | It's not defined who publishes it: the shared api-client 401 handler, or each remote's query error handler. React remotes use the shell's client, so the shell could just catch 401s directly. |
| **N24** | RT-2, AC-SHL-6.2 | "Logged" goes to an undefined logger (R24). "Logged once" is ambiguous: once per message, or once per type of error? |
| **N25** | Bus lifecycle | Not defined whether the bus and the sticky status are reset on sign-out, or whether subscriptions carry over to the next session. |
| **N26** | `realtime:reconnected` | Should say explicitly that it's not published on the **first** connection. Otherwise every area refetches right after loading. |

### Status and traceability (§3, §14.1)
| # | IDs | Problem |
|---|---|---|
| **N27** | T4 vs TEST-1 vs `nimbus/test-name-has-id` | T4 accepts any known ID in a test title. TEST-1 and the lint rule only allow `AC-` or `BUG-` prefixes. Tests for TECH, NFR or RT rules have no valid title (this was R92 and is now more pressing). |
| **N28** | §3.1, §15, AGENTS.md | Statuses live in §7 "until the split", but the demo script opens `specs/features/SPEC-TEN-2.md`. It's not defined which source `trace:check` parses, or what happens when both exist. |
| **N29** | §14 | TECH-7 is scheduled on Day 1 and again on Day 7 ("TECH-7…11"). Either split it (hooks vs skills/subagents/evals) or accept that it stays `in-progress` all week. |
| **N30** | §14.1 | TECH statuses have no rule for who changes them or when; T2 and T3 don't cover them. |

## C. Still open from the first review (unchanged)

- **Contradictions:**
  - R5: €0.035 and €0.025 can't be stored as whole cents.
  - R6: the ui-kit chunk budget, but ui-kit isn't a shared singleton.
  - R7–R9: punctuation and text differences between the ACs and mock-data §9.
  - R10: show the problem `title` or the mapped message?
  - R11: `Problem` has no message parameters.
  - R12: missing UI messages.
  - R31: size formatting, one decimal place vs "100 GiB".
- **Shell:**
  - R15: a user with no permitted areas.
  - R16: badge wording for 1 and 0 tasks; are `queued` tasks counted?
  - R17: no ACs for the indicator or the user menu.
  - R19: toolbar vs row-menu classification.
  - R20: tooltips on `disabled` buttons.
  - R21: "no state changes" vs optimistic updates.
  - R22, R23: how a remote failure is simulated and restored.
  - R24: the logger.
  - R25: "work" is vague.
  - R26–R30: RUM (once per lifecycle, soft navigations, missing `ts`, `/_vitals`, `sendBeacon` CORS).
- **Tenants:**
  - R33: perf test environment.
  - R34: debounce tolerance and `q` scope.
  - R35: third sort click and default directions.
  - R36: invalid URL values.
  - R37: how to assert reseller scoping.
  - R38: events vs active filters.
  - R39: grid keyboard model.
  - R40: no-permission state; what N is.
  - R41: row menu items.
  - R42: hard-coded plans fallback.
  - R43: "insert at top" vs sort.
  - R45–R49: wizard VM quota, plan switch, display name, 422 mapping, focus, reseller.
  - R50: `t_123` and drawer states.
  - R51: Overview, Activity and `tenant:update` unused.
  - R52, R53: VM quota editing and cache patching.
  - R54: 403 vs 404 for other resellers' tenants.
  - R55–R60: suspend status, revert rule, resume, typed-name matching, error-status tenants, drawer gating.
- **Compute:**
  - R62: provider and reseller admins have no tenant context.
  - R63: states, `error` status, pagination, display formats.
  - R64: fake `requestAnimationFrame` and render counts.
  - R65: announcement throttling.
  - R66: what "refetched once" covers.
  - R67: `VM_BUSY` used for reboot failures.
  - R68: progress area vs disabled buttons.
  - R69: Stop confirmation and `VM_INVALID_STATE`.
  - R70: where the "latest value" comes from.
- **Tasks:**
  - R72: the 100 ms timing (now also N18).
  - R73: no VM route; no bucket tasks.
  - R74: task visibility, pagination, empty state, panel.
- **Storage:**
  - R75: usage card for provider and reseller.
  - R76: percent rounding; over 100%.
  - R77: `bucket:delete` gating and states.
  - R78: custom name refinements.
  - R79: AC-STO-2.3 can't be set up in e2e.
  - R80: missing ACs for delete, versioning and list updates.
  - R81: bucket-name uniqueness.
- **Contract and mock data:**
  - R82: stretch specs and the `vm.create` task kind.
  - R83: no 429 or 5xx responses declared.
  - R84: event scoping per tenant (no token in the URL any more).
  - R85: no quota or bucket events.
  - R86: `t_acme` quotas not given.
  - R87: seeded task timestamps.
  - R88: generated VMs.
  - R89: missing 422s.
  - R90: generated `events` hook.
- **Harness and NFRs:**
  - R93: HOOK-5 vs H12.
  - R94: ADR-0002 to ADR-0007 missing, now including ADR-0005, which the cookie decision depends on; `specs/features/`, `requirements.md` and `stories/` don't exist.
  - R95: `RemoteContext` has no current path.
  - R96: H6 stories for every component.
  - R97: i18n vs `errors.ts`.
  - R98: NFR-PERF-2 and 3 and NFR-REL-2 aren't measurable.
  - R99: toast timing.
  - R100: CSP `font-src`.

## D. ACs that can't be tested reliably as written

| AC | Why |
|---|---|
| AC-TEN-1.1 | No defined environment for "smooth" or the 50 ms threshold, and CI runs with 0 retries |
| AC-TEN-3.1 | `t_123` doesn't exist |
| AC-TEN-4.3 | The mock never fails suspend tasks |
| AC-SHL-1.3 | The cache can't be inspected in e2e |
| AC-SHL-1.4 | Needs a mock-api restart with a short TTL; how the message is carried is undefined (N9) |
| AC-SHL-1.6 | Role not specified (N8) |
| AC-SHL-4.2 | "Work" is undefined |
| AC-SHL-4.4 | No way to bring the remote back mid-test |
| AC-SHL-5.1, AC-SHL-5.3 | Contradict themselves; no time window |
| AC-SHL-6.4 | No remote UI shows the connection state (N20) |
| AC-SHL-6.5 | The bus API can't attribute errors to a remote (N14) |
| AC-TSK-1.1 | Ordering against the WebSocket isn't guaranteed (N18) |
| AC-STO-2.3 | No way to fill the quota in e2e |
| AC-CMP-1.1, AC-CMP-1.2 | Need a fake `requestAnimationFrame` and render-count method |

## E. Decisions needed (most important first)

1. **Deployment topology:** same-origin proxy, or cross-site cookies with `Secure` and CSRF protection? This decides N1, N2 and N3.
2. **Multi-tab session behaviour:** N5.
3. **How the WebSocket signals an expired session:** N6.
4. **A scoped bus per remote:** N14.
5. **Query-key ownership:** key prefixes and who refreshes quotas and tenant tasks (N15, N16, N17).
6. **Merging `task:started` with WS updates, and a task-producing response for `createTenant`:** N18, N19.
7. **What tenant viewers see about their own tenant:** N12.
8. Older decisions still open: message source and formatting (R7–R12, R31), plan pricing unit (R5), remote-failure simulation (R22, R23), compute and storage for provider and reseller admins (R62, R75).
