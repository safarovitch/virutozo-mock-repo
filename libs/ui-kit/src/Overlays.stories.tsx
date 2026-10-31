// Dialog, ConfirmDialog, Drawer, Toast and Wizard (§8.2).
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from './Button';
import { ConfirmDialog, Dialog, Drawer } from './Dialog';
import { ToastProvider, useToast } from './Toast';
import { Wizard } from './Wizard';

const meta = { title: 'ui-kit/Overlays' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function DialogDemo({ initiallyOpen = false, longText = false }: { initiallyOpen?: boolean; longText?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open details</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={longText ? 'Tenant brave-otter-17 with a very long display name that wraps' : 'Tenant details'}>
        <p>{longText ? 'Quota and usage details. '.repeat(20) : 'Quota and usage details.'}</p>
        <Button>Inside the dialog</Button>
      </Dialog>
    </>
  );
}

export const DialogOpen: Story = { render: () => <DialogDemo initiallyOpen /> };
export const DialogLongText: Story = { render: () => <DialogDemo initiallyOpen longText /> };

export const DialogEscape: Story = {
  name: 'TECH-6: Escape closes the dialog and focus returns to the opener',
  tags: ['play'],
  render: () => <DialogDemo />,
  play: async ({ canvasElement }) => {
    const opener = within(canvasElement).getByRole('button', { name: 'Open details' });
    await userEvent.click(opener);
    const dialog = await within(document.body).findByRole('dialog', { name: 'Tenant details' });
    await expect(dialog).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull());
    await expect(opener).toHaveFocus();
  },
};

function ConfirmDemo({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [done, setDone] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>Suspend…</Button>
      {done && <p>Suspended</p>}
      <ConfirmDialog
        open={open}
        title="Suspend acme?"
        confirmLabel="Suspend tenant"
        confirmText="acme"
        danger
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setDone(true);
          setOpen(false);
        }}
      >
        <p>Its users can't change resources until you resume it.</p>
      </ConfirmDialog>
    </>
  );
}

export const ConfirmOpen: Story = { render: () => <ConfirmDemo initiallyOpen /> };

export const ConfirmTypeToConfirm: Story = {
  name: 'TECH-6: confirm is disabled until the typed text matches',
  tags: ['play'],
  render: () => <ConfirmDemo />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Suspend…' }));
    const dialog = within(await within(document.body).findByRole('dialog', { name: 'Suspend acme?' }));
    const confirm = dialog.getByRole('button', { name: 'Suspend tenant' });
    await expect(confirm).toBeDisabled();
    await userEvent.type(dialog.getByLabelText('Type acme to confirm.'), 'acm');
    await expect(confirm).toBeDisabled();
    await userEvent.type(dialog.getByLabelText('Type acme to confirm.'), 'e');
    await expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await expect(within(canvasElement).getByText('Suspended')).toBeVisible();
  },
};

function DrawerDemo({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open acme</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Acme Corporation">
        <p>Overview of the tenant.</p>
      </Drawer>
    </>
  );
}

export const DrawerOpen: Story = { render: () => <DrawerDemo initiallyOpen /> };
export const DrawerRightToLeft: Story = { render: () => <DrawerDemo initiallyOpen />, decorators: [(S) => <div dir="rtl"><S /></div>] };

export const DrawerFocus: Story = {
  name: 'TECH-6: focus moves into the drawer and returns on close',
  tags: ['play'],
  render: () => <DrawerDemo />,
  play: async ({ canvasElement }) => {
    const opener = within(canvasElement).getByRole('button', { name: 'Open acme' });
    await userEvent.click(opener);
    const drawer = await within(document.body).findByRole('dialog', { name: 'Acme Corporation' });
    await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(opener).toHaveFocus());
  },
};

function ToastDemo() {
  const show = useToast();
  return (
    <>
      <Button onClick={() => show({ tone: 'success', message: 'Tenant acme created.' })}>Success</Button>
      <Button onClick={() => show({ tone: 'error', message: "You don't have permission to do this." })}>Error</Button>
      <Button onClick={() => show({ tone: 'info', message: 'Bucket logs-2026 created. '.repeat(6) })}>Long</Button>
    </>
  );
}
const withToasts = (S: () => React.ReactNode) => <ToastProvider>{S()}</ToastProvider>;

export const Toasts: Story = { render: () => <ToastDemo />, decorators: [withToasts] };

export const ToastDismiss: Story = {
  name: 'TECH-6: an error toast is announced as an alert and Dismiss removes it',
  tags: ['play'],
  render: () => <ToastDemo />,
  decorators: [withToasts],
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Error' }));
    const alert = within(canvasElement).getByRole('alert');
    await expect(within(alert).getByText("You don't have permission to do this.")).toBeVisible();
    await userEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    await expect(within(alert).queryByText("You don't have permission to do this.")).toBeNull();
  },
};

function WizardDemo() {
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [created, setCreated] = useState(false);
  const valid = /^[a-z0-9-]{3,}$/.test(name);
  if (created) return <p>Created {name}</p>;
  return (
    <Wizard
      submitLabel="Create tenant"
      onSubmit={() => setCreated(true)}
      steps={[
        {
          id: 'details',
          title: 'Details',
          validate: () => {
            setTouched(true);
            return valid;
          },
          content: (
            <div className="nui-field">
              <label htmlFor="tenant-name">Name</label>
              <input id="tenant-name" className="nui-input" value={name} aria-invalid={touched && !valid} aria-describedby="tenant-name-error" onChange={(e) => setName(e.target.value)} />
              {touched && !valid && <span id="tenant-name-error">Use lowercase letters, numbers and hyphens.</span>}
            </div>
          ),
        },
        { id: 'review', title: 'Review', content: <p>Name: {name}</p> },
      ]}
    />
  );
}

export const WizardDefault: Story = { render: () => <WizardDemo /> };

export const WizardBlocksInvalid: Story = {
  name: 'TECH-6: Next is blocked on an invalid step',
  tags: ['play'],
  render: () => <WizardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(canvas.getByRole('heading', { name: 'Details' })).toBeVisible();
    await expect(canvas.getByText('Use lowercase letters, numbers and hyphens.')).toBeVisible();
    await userEvent.type(canvas.getByLabelText('Name'), 'brave-otter');
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(canvas.getByRole('heading', { name: 'Review' })).toHaveFocus();
    await userEvent.click(canvas.getByRole('button', { name: 'Create tenant' }));
    await expect(canvas.getByText('Created brave-otter')).toBeVisible();
  },
};
