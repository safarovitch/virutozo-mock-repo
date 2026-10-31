# Day 4 — Decisions

- **Status:** Accepted · **Date:** 2026-10-31 · **Owner:** Rasul Idiev
- **Input:** `docs/reviews/2026-10-31-day-4-spec-check.md`

## Part 1 — owner decisions

| ID | Decision | Applied in |
|---|---|---|
| D4-01 | **(a)** The badge counts `queued` + `running` tasks. At 0 there's no badge and the button is named `tasks.title` "Tasks"; at ≥ 1 the badge shows the number and the name is "Tasks, {count} running task(s)" (`shell.runningTasks_one/_other`). Queued tasks are listed under *Running* with a 0 % bar. | SPEC-TSK-1 behaviour |
| D4-02 | **(a)** A disclosure panel under the header button (same pattern as the user menu: Escape and outside click close it, focus returns to the button). Two lists, *Running* and *Recent*; at most the 50 newest tasks of the last 24 h, no "load more". Empty: `tasks.empty`. | SPEC-TSK-1 behaviour |
| D4-03 | **(a)** The connection indicator is always visible: a dot plus the state text in a `role="status"` element named `connections.label`. | `specs/shared/realtime.md` WS-4 |
| D4-04 … D4-15 | Accepted as proposed in the spec check (the agent decides missing details). | see the review file |

## Part 2 — decisions the agent made while building Day 4

(Recorded under the "What blocks building" rule, for review at the end of the day.)

| ID | Decision (agent) | Why |
|---|---|---|
| A4-01 | **The 1006 session check goes through `getMe` and `customFetch`.** A 401 also reaches `onUnauthorized` → `store.expire()`, and `checkSession` resolves `false` so the client stops. Network errors count as "still signed in" and the client reconnects. | One expiry path for HTTP and the socket (D4-07); a flaky network never signs anyone out. |
| A4-02 | **Attempt numbering.** `attempt` counts consecutive attempts that closed without opening, plus one. The first try after an open connection is lost is attempt 1 (1 s); a failed very first connection makes the next try attempt 2. `realtime:reconnected` comes only after an **open** connection was lost (RT-11). | WS-7 counts "failed attempts"; a first connection that never opened isn't a reconnection. |
| A4-03 | **Bus errors to the logger** (`apps/shell/src/bus.ts`): `bus.subscriber_error { event, scope, message }` and `bus.publish_rejected { event, scope }`. `libs/mf-contract` exports `BusPublishError` so the shell can tell the two apart; the `onError` signature is unchanged. | AC-SHL-6.5 and 6.11 ask for logger entries; extending `onError`'s info object would have changed existing `toHaveBeenCalledWith` assertions (H4). |
| A4-04 | **The task center's `queryFn` merges** the fresh `listTasks` page into the cached one with `mergeTask` and keeps the newest 50 (D4-09). `realtime:reconnected` invalidates it. The badge counts queued + running (D4-01). | A refetch must never undo newer progress from events. |
| A4-05 | **The resource name is always plain text.** When `canOpen` allows, a separate link "View resource" (accessible name "View resource: <name>") follows it. Clicking it closes the panel. | AC-TSK-1.3 names a *View resource* link; AC-TSK-1.6's plain-text case then needs no second rendering mode. |
| A4-06 | **The task button's name comes from its content:** "Tasks" + a decorative badge + visually hidden ", 2 running tasks". | An `aria-label` failed axe `label-content-name-mismatch` (WCAG 2.5.3), because the visible "2" wasn't in the name. |
| A4-07 | **Disclosure panels honour `hidden`:** `.user-menu__panel[hidden], .task-center__panel[hidden] { display: none; }`. **This fixes a Day 3 bug:** the user menu's `display: grid` overrode the `hidden` attribute, so its panel was always shown. | Found when the always-open task panel covered the 403 page's link (e2e AC-SHL-3.1). |
| A4-08 | **The shell gets its own Storybook** (`apps/shell/.storybook`, port 6008, plain React Vite config without Module Federation) for the task center's H6 states. It adds `storybook` and `@storybook/react-vite` 10.6.5 as shell devDependencies, the versions ADR-0001 already pins for ui-kit. A jsdom smoke test renders every story. There are no `play` stories, so there's no `storybook-test` target yet. | H6 needs a story per state; the shell had no Storybook. 6006/6007 belong to ui-kit and ui-kit-vue. |
| A4-09 | **Compute subscribes to `realtime:reconnected`** through the spec's `useBusEvent`. The handler does nothing until SPEC-CMP-1 (D4-11). `BUS_KEY` is provided in `mount.ts`. | It makes AC-SHL-6.3 a real test of unmount cleanup. |
| A4-10 | **`drop-sockets { holdMs }`** refuses upgrades with 503 for the caller's session (or every session with `all`) for 0–60 000 ms. Invalid values get a 422 (D4-05). | A 3 s window makes the AC-SHL-6.4 e2e deterministic with 0 retries. |
| A4-11 | **The AC-SHL-1.12 e2e's setup changed, its assertions didn't.** It now holds back the server's 4401 close with `page.routeWebSocket`, so the page doesn't hear about the expiry before *Sign out*. The window is real: the server notices TTL expiry only on its 15 s heartbeat tick. | With realtime, `expire-session` closes the socket at once and the client redirects (AC-SHL-6.6), so the old setup could no longer reach the AC's situation. Flagged for review under H4. |
| A4-12 | **e2e ran with `GATEWAY_PORT=8090`.** A process the agent can't see (another user, or a system service) listens on `*:8080` on this machine. CI is unaffected. | The supported override (D2-09); nothing in the repo changed. |
| A4-13 | `pnpm trace` doesn't exist yet: `tools/check-trace.ts` is part of TECH-5 (Day 5). On macOS `pnpm trace` falls through to `/usr/bin/trace`. T1–T6 weren't checked mechanically today. | Reported, not worked around. |
| A4-14 | **Statuses:** AC-SHL-6.1–6.13, AC-TSK-1.1–1.6, AC-SHL-2.2, AC-SHL-1.4 and TECH-4 → `done`. AC-TSK-1.7 stays `in-progress` until the VM drawer's e2e (SPEC-CMP-5, Day 6; D4-10). AC-SHL-1.3, 1.13 (Day 5) and 3.2 (first mutating action) stay `in-progress`. TECH-4 is done as scoped by D4-04; each area's own cache patching (RT-4…6) arrives with its feature spec. | Every `done` AC has a passing test titled with its ID. |
| A4-15 | **Local e2e evidence.** With the lid closed on battery, macOS kept going into maintenance sleep (~14 min) during runs, which `caffeinate -i` can't stop. Every failing test in the last three runs lasted as long as a sleep (10–15 min), and on the final code every test passed in at least one run. There's no single fully green local run. CI (Linux, no sleep) is the gate. | Reported as is; nothing was retried into green. |
