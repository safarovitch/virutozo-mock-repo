// Combobox (§8.2, D8-05): a tenant picker over a local list, with its states.
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Combobox, type ComboboxOption } from './Combobox';
import { StatusBadge } from './StatusBadge';

const meta = { title: 'ui-kit/Combobox' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const ALL: ComboboxOption[] = [
  { id: 't_acme', label: 'Acme Corporation', description: 'acme' },
  { id: 't_beta', label: 'Beta Ltd', description: 'beta' },
  { id: 't_gamma', label: 'Gamma Group', description: 'gamma', badge: <StatusBadge tone="warning" label="Suspended" /> },
];

function Demo({ loading = false, error }: { loading?: boolean; error?: string }) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<ComboboxOption | null>(null);
  const options = ALL.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <Combobox
        label="Tenant"
        placeholder="Search tenants"
        value={chosen?.label}
        options={options}
        loading={loading}
        {...(error ? { error } : {})}
        emptyText="No tenants match."
        searchDelayMs={0}
        onSearch={setQuery}
        onSelect={setChosen}
      />
      <p>Chosen: {chosen?.id ?? 'none'}</p>
    </>
  );
}

export const Default: Story = { render: () => <Demo /> };
export const Loading: Story = { render: () => <Demo loading /> };
export const Error: Story = { render: () => <Demo error="Something went wrong on our side. Try again." /> };

export const KeyboardSelect: Story = {
  name: 'TECH-6: type, arrow down and Enter choose a tenant',
  tags: ['play'],
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('combobox', { name: 'Tenant' });
    await userEvent.type(input, 'be');
    await waitFor(() => expect(canvas.getAllByRole('option')).toHaveLength(1));
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(canvas.getByText('Chosen: t_beta')).toBeVisible();
    await expect(input).toHaveValue('Beta Ltd');
    await expect(input).toHaveFocus();
  },
};

export const NoResults: Story = {
  name: 'TECH-6: no match shows the empty text',
  tags: ['play'],
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox', { name: 'Tenant' }), 'zzz');
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('No tenants match.'));
  },
};
