// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Permission, Task } from '@nimbus/api-client/model';
import { createRootBus, type RootBus, type SessionSnapshot } from '@nimbus/mf-contract';
import { ConnectionIndicator } from './ConnectionIndicator';
import { TaskCenter, TaskCenterView } from './TaskCenter';

const NOW = Date.parse('2026-10-31T12:00:00Z');
const user = { id: 'u_1', name: 'Pat', email: 'pat@example.test' };
const acme = { id: 't_acme', displayName: 'Acme Corporation', planName: 'Business', status: 'active' } as const;
const tenantAdmin: SessionSnapshot = { user, role: 'tenant_admin', tenant: acme, permissions: ['vm:read', 'vm:operate', 'bucket:read', 'quota:read', 'task:read'] as Permission[] };

const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id,
  kind: 'vm.reboot',
  status: 'running',
  progress: 40,
  seq: 1,
  resource: { type: 'vm', id: 'vm_01', name: 'web-01' },
  tenantId: 't_acme',
  error: null,
  createdAt: '2026-10-31T11:50:00Z',
  finishedAt: null,
  ...patch,
});

let listed: Task[] = [];
beforeEach(() => {
  listed = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () => new Response(JSON.stringify({ items: listed, nextCursor: null, total: listed.length }), { status: 200, headers: { 'content-type': 'application/json' } }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function renderCenter(bus: RootBus, session = tenantAdmin) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <TaskCenter bus={bus} session={session} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return queryClient;
}
const openPanel = () => fireEvent.click(screen.getByRole('button', { name: /^Tasks/ }));

describe('task center', () => {
  it('AC-TSK-1.1: a task appears within 100 ms of task:started, whether or not a WebSocket update arrived first', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    const bus = createRootBus();
    renderCenter(bus);
    await act(async () => vi.advanceTimersByTimeAsync(0)); // first listTasks settles (empty)
    openPanel();
    const start = Date.now();
    act(() => bus.scope('compute').publish('task:started', { task: task('task_a', { seq: 0, status: 'queued', progress: 0 }) }));
    act(() => bus.publish('server:task.updated', { task: task('task_b', { seq: 3 }) }));
    act(() => bus.scope('compute').publish('task:started', { task: task('task_b', { seq: 0, status: 'queued', progress: 0 }) }));
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(Date.now() - start).toBeLessThanOrEqual(100);
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('AC-TSK-1.2: progress bars use role="progressbar" with aria-valuenow', () => {
    render(
      <MemoryRouter>
        <TaskCenterView session={tenantAdmin} tasks={[task('task_a', { progress: 40 })]} defaultOpen now={NOW} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('progressbar', { name: 'Reboot VM: web-01' }).getAttribute('aria-valuenow')).toBe('40');
  });

  it('AC-TSK-1.3: a failed task shows the mapped message for its error code and a View resource link', () => {
    const failed = task('task_f', {
      status: 'failed',
      seq: 9,
      finishedAt: '2026-10-31T11:55:00Z',
      error: { type: 'about:blank', title: 'server text', status: 409, code: 'VM_BUSY', params: { name: 'db-02' } },
    });
    render(
      <MemoryRouter>
        <TaskCenterView session={tenantAdmin} tasks={[failed]} defaultOpen now={NOW} />
      </MemoryRouter>,
    );
    expect(screen.getByText('db-02 is busy with another operation.')).toBeTruthy();
    expect(screen.queryByText('server text')).toBeNull();
    expect(screen.getByRole('link', { name: 'View resource: web-01' }).getAttribute('href')).toBe('/compute/vm_01');
  });

  it('AC-TSK-1.6: for tenant roles the tenant.provision task shows "acme" as plain text, not a link', () => {
    const provision = task('task_p', {
      kind: 'tenant.provision',
      status: 'succeeded',
      resource: { type: 'tenant', id: 't_acme', name: 'acme' },
      finishedAt: '2026-10-31T08:00:00Z',
      createdAt: '2026-10-31T07:59:00Z',
    });
    render(
      <MemoryRouter>
        <TaskCenterView session={tenantAdmin} tasks={[provision]} defaultOpen now={NOW} />
      </MemoryRouter>,
    );
    expect(screen.getByText('acme')).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('AC-SHL-2.2: with 2 running tasks the badge shows "2" and the button is labelled "2 running tasks"', () => {
    render(
      <MemoryRouter>
        <TaskCenterView session={tenantAdmin} tasks={[task('a'), task('b'), task('c', { status: 'succeeded', finishedAt: '2026-10-31T11:58:00Z' })]} now={NOW} />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: 'Tasks, 2 running tasks' });
    expect(within(button).getByText('2')).toBeTruthy();
  });

  it('AC-SHL-2.2: queued tasks count as running; with none there is no badge (D4-01)', () => {
    const { rerender } = render(
      <MemoryRouter>
        <TaskCenterView session={tenantAdmin} tasks={[task('a', { status: 'queued', progress: 0 })]} now={NOW} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Tasks, 1 running task' })).toBeTruthy();
    rerender(
      <MemoryRouter>
        <TaskCenterView session={tenantAdmin} tasks={[]} now={NOW} />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: 'Tasks' });
    expect(button.textContent).toBe('Tasks');
  });

  it('TECH-4: the panel is a disclosure; Escape closes it and returns focus to the button (D4-02)', () => {
    render(
      <MemoryRouter>
        <TaskCenterView session={tenantAdmin} tasks={[]} now={NOW} />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: 'Tasks' });
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('No tasks in the last 24 hours.')).toBeTruthy();
    fireEvent.keyDown(screen.getByText('No tasks in the last 24 hours.'), { key: 'Escape' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('TECH-4: a refetch after realtime:reconnected merges with mergeTask and never reverts newer events (RT-6, D4-09)', async () => {
    const bus = createRootBus();
    listed = [task('task_a', { seq: 1, progress: 10 })];
    renderCenter(bus);
    openPanel();
    expect(await screen.findByRole('progressbar', { name: 'Reboot VM: web-01' })).toBeTruthy();
    act(() => bus.publish('server:task.updated', { task: task('task_a', { seq: 5, progress: 80 }) }));
    listed = [task('task_a', { seq: 2, progress: 20 }), task('task_new', { createdAt: '2026-10-31T11:59:00Z', resource: { type: 'vm', id: 'vm_02', name: 'web-02' } })];
    const calls = vi.mocked(fetch).mock.calls.length;
    act(() => bus.publish('realtime:reconnected', { downtimeMs: 1200 }));
    expect(await screen.findByRole('progressbar', { name: 'Reboot VM: web-02' })).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls + 1);
    expect(screen.getByRole('progressbar', { name: 'Reboot VM: web-01' }).getAttribute('aria-valuenow')).toBe('80');
  });
});

describe('connection indicator', () => {
  it('AC-SHL-6.4: the header status named "Connection" shows "Reconnecting…" from the sticky status', () => {
    const bus = createRootBus();
    bus.publish('realtime:status', { state: 'reconnecting', attempt: 1 });
    render(<ConnectionIndicator bus={bus} />);
    expect(screen.getByRole('status', { name: 'Connection' }).textContent).toBe('Reconnecting…');
    act(() => bus.publish('realtime:status', { state: 'connected', attempt: 0 }));
    expect(screen.getByRole('status', { name: 'Connection' }).textContent).toBe('Connected');
  });

  it('AC-SHL-6.9: shows "Offline" and then "Connected" again after a successful retry', () => {
    const bus = createRootBus();
    render(<ConnectionIndicator bus={bus} />);
    act(() => bus.publish('realtime:status', { state: 'offline', attempt: 6 }));
    expect(screen.getByRole('status', { name: 'Connection' }).textContent).toBe('Offline');
    act(() => bus.publish('realtime:status', { state: 'connected', attempt: 0 }));
    expect(screen.getByRole('status', { name: 'Connection' }).textContent).toBe('Connected');
  });
});
