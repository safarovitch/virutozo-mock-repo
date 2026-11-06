// SPEC-SHL-4 for the Vue remote: its root boundary (MF-6) and context changes through update(ctx).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/vue';
import { renderArea, tenantSession, TENANT_VIEWER, type Rendered } from './testing/render';

let current: Rendered | undefined;
const render = (...args: Parameters<typeof renderArea>) => (current = renderArea(...args));
afterEach(() => {
  current?.remote.unmount();
  current = undefined;
  vi.restoreAllMocks();
});

const rowOf = async (name: string) => (await within(await screen.findByRole('table', { name: 'Virtual machines' })).findByRole('rowheader', { name })).closest('tr') as HTMLElement;

describe('compute isolation', () => {
  it('AC-SHL-4.3: a render error in the Vue remote publishes exactly one fatal remote:error naming compute', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const r = render('/__crash');
    const reported = r.remote.fake.published.filter((p) => p.type === 'remote:error');
    expect(reported).toEqual([{ type: 'remote:error', source: 'compute', payload: expect.objectContaining({ remote: 'compute', fatal: true, message: 'compute: render crash for tests' }) }]);
    expect(r.remote.el.textContent).toBe(''); // nothing further renders
    expect(errors).not.toHaveBeenCalled(); // the shell logs it; Vue doesn't log it again
    warnings.mockRestore();
  });

  it('AC-SHL-4.5: after update() with a session without vm:operate, the action buttons disappear without a remount', async () => {
    const r = render();
    const row = await rowOf('web-01');
    expect(within(row).getByRole('button', { name: 'Reboot' })).toBeTruthy();
    const root = r.remote.el.firstElementChild;

    r.remote.update({ session: tenantSession(TENANT_VIEWER, { role: 'tenant_viewer' }) });

    await vi.waitFor(() => expect(screen.queryByRole('button', { name: /^(Start|Stop|Reboot)$/ })).toBeNull());
    expect(r.remote.el.firstElementChild).toBe(root); // same DOM: updated, not remounted
    expect(await rowOf('web-01')).toBe(row);
  });
});
