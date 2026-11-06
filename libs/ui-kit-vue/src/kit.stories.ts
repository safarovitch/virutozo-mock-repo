// Vue subset of the design system (§8.2). Render functions, not template strings, so the stories run
// with Vue's runtime-only build in jsdom as well as in Storybook.
/* eslint-disable vue/one-component-per-file -- each story wraps its demo in a small component */
import { defineComponent, h, ref, withDirectives } from 'vue';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Permission } from '@nimbus/api-client/model';
import type { SessionSnapshot } from '@nimbus/mf-contract';
import { Button, Combobox, type ComboboxOption, ConfirmDialog, createCanDirective, Drawer, EmptyState, ErrorState, ProgressBar, Skeleton, StatusBadge } from './index';

const meta = { title: 'ui-kit-vue/Components' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const story = (name: string, render: () => ReturnType<typeof h>) => defineComponent({ name, setup: () => render });
const rtl = (inner: () => ReturnType<typeof h>) => () => h('div', { dir: 'rtl' }, [inner()]);

export const Buttons: Story = {
  render: () =>
    story('ButtonsStory', () =>
      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [
        h(Button, { variant: 'primary' }, () => 'Start'),
        h(Button, { variant: 'secondary' }, () => 'Stop'),
        h(Button, { variant: 'danger' }, () => 'Delete'),
        h(Button, { variant: 'ghost' }, () => 'Details'),
        h(Button, { loading: true }, () => 'Rebooting'),
        h(Button, { disabled: true }, () => 'Disabled'),
        h(Button, { disabledReason: "You don't have permission to start, stop or reboot VMs." }, () => 'Reboot'),
        h(Button, {}, () => 'Start, stop or reboot every virtual machine of this tenant right now'),
      ]),
    ),
};
export const ButtonsRightToLeft: Story = { render: () => story('ButtonsRtl', rtl(() => h(Button, { loading: true }, () => 'Rebooting'))) };

export const ButtonLoading: StoryObj<{ onClick: () => void }> = {
  name: 'TECH-6: Vue button ignores clicks while loading',
  tags: ['play'],
  args: { onClick: fn() },
  render: (args) => story('ButtonLoading', () => h(Button, { loading: true, onClick: args.onClick }, () => 'Reboot')),
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Reboot' }));
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const Badges: Story = {
  render: () =>
    story('BadgesStory', () =>
      h('div', { style: 'display:flex;gap:8px' }, [
        h(StatusBadge, { tone: 'success', label: 'Running' }),
        h(StatusBadge, { tone: 'neutral', label: 'Stopped' }),
        h(StatusBadge, { tone: 'danger', label: 'Error' }),
        h(StatusBadge, { tone: 'warning', label: 'Rebooting with a long status label' }),
      ]),
    ),
};
export const Progress: Story = {
  render: () => story('ProgressStory', () => h('div', [h(ProgressBar, { label: 'Rebooting web-01', value: 0.4 }), h(ProgressBar, { label: 'Rebooting web-02' })])),
};
export const States: Story = {
  render: () =>
    story('StatesStory', () =>
      h('div', { style: 'display:grid;gap:16px' }, [
        h(EmptyState, { title: 'No virtual machines yet' }),
        h(ErrorState, { message: 'Something went wrong on our side. Try again.' }),
        h(Skeleton, { lines: 3 }),
      ]),
    ),
};
export const StatesRightToLeft: Story = { render: () => story('StatesRtl', rtl(() => h(ErrorState, { message: 'Something went wrong on our side. Try again.' }))) };

export const RetryEmits: StoryObj<{ onRetry: () => void }> = {
  name: 'TECH-6: Vue ErrorState Retry calls the handler',
  tags: ['play'],
  args: { onRetry: fn() },
  render: (args) => story('RetryStory', () => h(ErrorState, { message: 'Something went wrong on our side. Try again.', onRetry: args.onRetry })),
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Retry' }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

const ConfirmDemo = defineComponent({
  name: 'ConfirmDemo',
  props: { initiallyOpen: { type: Boolean, default: false } },
  setup(props) {
    const open = ref(props.initiallyOpen);
    const stopped = ref(false);
    return () =>
      h('div', [
        h(Button, { variant: 'danger', onClick: () => (open.value = true) }, () => 'Stop…'),
        stopped.value ? h('p', 'Stopped') : null,
        h(
          ConfirmDialog,
          {
            open: open.value,
            title: 'Stop web-01?',
            confirmLabel: 'Stop VM',
            confirmText: 'web-01',
            danger: true,
            onCancel: () => (open.value = false),
            onConfirm: () => {
              stopped.value = true;
              open.value = false;
            },
          },
          () => h('p', 'Running processes on web-01 will end.'),
        ),
      ]);
  },
});

export const ConfirmOpen: Story = { render: () => story('ConfirmOpen', () => h(ConfirmDemo, { initiallyOpen: true })) };

export const ConfirmTypeToConfirm: Story = {
  name: 'TECH-6: Vue ConfirmDialog stays disabled until the typed text matches',
  tags: ['play'],
  render: () => story('ConfirmPlay', () => h(ConfirmDemo)),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Stop…' }));
    const dialog = within(await within(document.body).findByRole('dialog', { name: 'Stop web-01?' }));
    const confirm = dialog.getByRole('button', { name: 'Stop VM' });
    await expect(confirm).toBeDisabled();
    await userEvent.type(dialog.getByLabelText('Type web-01 to confirm.'), 'web-01');
    await expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await expect(within(canvasElement).getByText('Stopped')).toBeVisible();
  },
};

const DrawerDemo = defineComponent({
  name: 'DrawerDemo',
  props: { initiallyOpen: { type: Boolean, default: false } },
  setup(props) {
    const open = ref(props.initiallyOpen);
    return () =>
      h('div', [
        h(Button, { onClick: () => (open.value = true) }, () => 'Open web-01'),
        h(Drawer, { open: open.value, title: 'web-01', onClose: () => (open.value = false) }, () => h('p', 'Running · 4 vCPU · 8 GiB')),
      ]);
  },
});

export const DrawerOpen: Story = { render: () => story('DrawerOpen', () => h(DrawerDemo, { initiallyOpen: true })) };

export const DrawerFocus: Story = {
  name: 'TECH-6: Vue Drawer closes on Escape and returns focus',
  tags: ['play'],
  render: () => story('DrawerPlay', () => h(DrawerDemo)),
  play: async ({ canvasElement }) => {
    const opener = within(canvasElement).getByRole('button', { name: 'Open web-01' });
    await userEvent.click(opener);
    await within(document.body).findByRole('dialog', { name: 'web-01' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(opener).toHaveFocus());
  },
};

const viewer: SessionSnapshot = { user: { id: 'u_1', name: 'Vera', email: 'v@acme.example' }, role: 'tenant_viewer', tenant: null, permissions: [Permission['vm:read']] };
const vCan = createCanDirective(() => viewer);

export const VCan: Story = {
  name: 'TECH-6: v-can renders nothing without the permission',
  tags: ['play'],
  render: () =>
    story('VCanStory', () =>
      h('div', [
        withDirectives(h('button', { type: 'button', class: 'nui-button nui-button--secondary' }, 'View VMs'), [[vCan, Permission['vm:read']]]),
        withDirectives(h('button', { type: 'button', class: 'nui-button nui-button--secondary' }, 'Reboot'), [[vCan, Permission['vm:operate']]]),
      ]),
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'View VMs' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Reboot' })).toBeNull();
  },
};

const TENANTS: ComboboxOption[] = [
  { id: 't_acme', label: 'Acme Corporation', description: 'acme' },
  { id: 't_beta', label: 'Beta Ltd', description: 'beta' },
  { id: 't_gamma', label: 'Gamma Group', description: 'gamma', badge: { tone: 'warning', label: 'Suspended' } },
];
const comboboxStory = (name: string, extra: { loading?: boolean; error?: string } = {}) =>
  defineComponent({
    name,
    setup() {
      const query = ref('');
      const chosen = ref<ComboboxOption | null>(null);
      return () =>
        h('div', [
          h(Combobox, {
            label: 'Tenant',
            placeholder: 'Search tenants',
            value: chosen.value?.label,
            options: TENANTS.filter((o) => o.label.toLowerCase().includes(query.value.toLowerCase())),
            emptyText: 'No tenants match.',
            searchDelayMs: 0,
            ...extra,
            onSearch: (q: string) => (query.value = q),
            onSelect: (o: ComboboxOption) => (chosen.value = o),
          }),
          h('p', `Chosen: ${chosen.value?.id ?? 'none'}`),
        ]);
    },
  });

export const ComboboxDefault: Story = { render: () => comboboxStory('ComboboxDefault') };
export const ComboboxLoading: Story = { render: () => comboboxStory('ComboboxLoading', { loading: true }) };
export const ComboboxError: Story = { render: () => comboboxStory('ComboboxError', { error: 'Something went wrong on our side. Try again.' }) };
export const ComboboxKeyboard: Story = {
  name: 'TECH-6: Vue combobox, type, arrow down and Enter choose a tenant',
  tags: ['play'],
  render: () => comboboxStory('ComboboxKeyboard'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('combobox', { name: 'Tenant' });
    await userEvent.type(input, 'be');
    await waitFor(() => expect(canvas.getAllByRole('option')).toHaveLength(1));
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(canvas.getByText('Chosen: t_beta')).toBeVisible();
    await expect(input).toHaveValue('Beta Ltd');
  },
};
