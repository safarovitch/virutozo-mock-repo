// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createApp, defineComponent, h, withDirectives } from 'vue';
import { Permission } from '@nimbus/api-client/model';
import type { SessionSnapshot } from '@nimbus/mf-contract';
import { Can, SessionProvider } from './react';
import { createCanDirective } from './vue';

const viewer: SessionSnapshot = {
  user: { id: 'u_1', name: 'Vera Viewer', email: 'vera@acme.example' },
  role: 'tenant_viewer',
  tenant: null,
  permissions: [Permission['vm:read']],
};

describe('<Can>', () => {
  it('AC-SHL-3.3: renders its children only with the permission', () => {
    render(
      <SessionProvider session={viewer}>
        <Can permission={Permission['vm:read']}>
          <button type="button">View</button>
        </Can>
        <Can permission={Permission['vm:operate']}>
          <button type="button">Reboot</button>
        </Can>
      </SessionProvider>,
    );
    expect(screen.getByRole('button', { name: 'View' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reboot' })).toBeNull();
  });

  it('AC-SHL-3.3: renders nothing before the session exists', () => {
    const { container } = render(
      <SessionProvider session={null}>
        <Can permission={Permission['vm:read']}>
          <button type="button">View</button>
        </Can>
      </SessionProvider>,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('v-can', () => {
  function mountWith(session: SessionSnapshot | null) {
    const vCan = createCanDirective(() => session);
    const App = defineComponent({
      name: 'CanFixture',
      render: () =>
        h('div', [
          withDirectives(h('button', { type: 'button' }, 'View'), [[vCan, Permission['vm:read']]]),
          withDirectives(h('button', { type: 'button' }, 'Reboot'), [[vCan, Permission['vm:operate']]]),
        ]),
    });
    const el = document.createElement('div');
    const app = createApp(App);
    app.mount(el);
    return { el, app };
  }

  it('AC-SHL-3.3: removes elements the session may not use', () => {
    const { el, app } = mountWith(viewer);
    expect([...el.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['View']);
    app.unmount(); // unmounting a removed element must not throw
  });

  it('AC-SHL-3.3: renders nothing before the session exists', () => {
    const { el } = mountWith(null);
    expect(el.querySelectorAll('button')).toHaveLength(0);
  });
});
