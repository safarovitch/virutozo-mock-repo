---
name: long-running-task
description: Implement an action the server runs as a task - 202 + Task, progress over the WebSocket, optimistic state, rollback on failure, toasts and the task center. Use for VM actions, suspend/resume and any new async operation.
---

# Long-running task

Reference: VM actions in `apps/compute/src/data.ts` (`useVmAction`, `subscribeComputeEvents`) and suspend/resume in `apps/tenants/src/lifecycle.ts`.

1. **Contract:** the operation returns `202` with a `Task` (`id`, `kind`, `status`, `progress`, `seq`, `resource`, `error`). Progress arrives as `task.updated` events; the resource itself as `vm.updated` / `tenant.updated` (specs/shared/realtime.md).
2. **Start:** the mutation calls the generated function. On 202: seed the task into the area's cache (`getGetTaskQueryKey(id)`), publish `task:started` on the bus (the shell's task center listens) and remember that this mount started it.
3. **Optimistic state:** only when the spec says so. VMs show the transitional status at once (`DURING[action]`) and roll back on an error response. Tenant status is **never** optimistic (D7-01): show "Suspending…" from the running task, change status only on success or the event.
4. **Events:** subscribe on the area's bus scope to `server:task.updated` and the resource event; merge tasks with `mergeTask` (ordered by `seq`, never go backwards); batch cache writes per animation frame (RT-5); cancel the frame on unmount. Never open a socket (H13).
5. **Finish:** on `succeeded` / `failed` show one toast (only for tasks this mount started; the task center covers the rest). A failed task shows `messageFor(task.error)` and the resource returns to the server's state from the following event.
6. **Errors on start:** 409 `VM_BUSY`, `TENANT_SUSPENDED`, … → roll back, toast the mapped message, refetch the resource (and the tenant for `TENANT_SUSPENDED`).
7. **Tests:** fake bus events (`remote.fake.emit('server:task.updated', …)`), one per AC: optimistic status, progress, failure rollback, duplicate-event idempotence, reconnect refetch (RT-6). e2e uses `fail-next-task` for failures and owns one resource per test.
