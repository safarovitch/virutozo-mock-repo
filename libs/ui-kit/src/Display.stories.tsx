// StatusBadge, ProgressBar, UsageBar and the standard states (§8.2).
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from './Button';
import { ProgressBar, UsageBar } from './ProgressBar';
import { EmptyState, ErrorState, Skeleton } from './States';
import { StatusBadge } from './StatusBadge';

const meta = { title: 'ui-kit/Display' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const rtl = (S: () => React.ReactNode) => <div dir="rtl">{S()}</div>;

export const Badges: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <StatusBadge tone="success" label="Running" />
      <StatusBadge tone="warning" label="Provisioning" />
      <StatusBadge tone="danger" label="Error" />
      <StatusBadge tone="info" label="Queued" />
      <StatusBadge tone="neutral" label="Stopped" />
    </div>
  ),
};
export const BadgeLongText: Story = { render: () => <div style={{ inlineSize: 120 }}><StatusBadge tone="warning" label="Provisioning a very long status label" /></div> };
export const BadgeRightToLeft: Story = { render: () => <StatusBadge tone="success" label="Running" />, decorators: [rtl] };

export const ProgressDeterminate: Story = { render: () => <ProgressBar label="Rebooting web-01" value={0.4} /> };
export const ProgressIndeterminate: Story = { render: () => <ProgressBar label="Rebooting web-01" /> };
export const ProgressRightToLeft: Story = { render: () => <ProgressBar label="Rebooting web-01" value={0.4} />, decorators: [rtl] };

export const ProgressAria: Story = {
  name: 'TECH-6: progress bar exposes its value to assistive tech',
  tags: ['play'],
  render: () => (
    <>
      <ProgressBar label="Rebooting web-01" value={0.4} />
      <ProgressBar label="Rebooting web-02" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const determinate = canvas.getByRole('progressbar', { name: 'Rebooting web-01' });
    await expect(determinate).toHaveAttribute('aria-valuenow', '40');
    await expect(determinate).toHaveAttribute('aria-valuemax', '100');
    await expect(canvas.getByRole('progressbar', { name: 'Rebooting web-02' })).not.toHaveAttribute('aria-valuenow');
  },
};

const GiB = 1024 ** 3;
export const UsageOk: Story = { render: () => <UsageBar label="Storage" used={100 * GiB} total={250 * GiB} valueText="100 GiB of 250 GiB" /> };
export const UsageWarning: Story = { render: () => <UsageBar label="Storage" used={205 * GiB} total={250 * GiB} valueText="205 GiB of 250 GiB" /> };
export const UsageOver: Story = { render: () => <UsageBar label="Storage" used={260 * GiB} total={250 * GiB} valueText="260 GiB of 250 GiB" /> };
export const UsageRightToLeft: Story = { render: () => <UsageBar label="Storage" used={205 * GiB} total={250 * GiB} />, decorators: [rtl] };

export const UsageThresholds: Story = {
  name: 'TECH-6: usage bar renders warning text at 80 % and danger text at 95 %',
  tags: ['play'],
  render: () => (
    <>
      <UsageBar label="Below" used={0.799} total={1} />
      <UsageBar label="Warning" used={0.8} total={1} />
      <UsageBar label="Danger" used={0.95} total={1} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('meter', { name: 'Below' })).toHaveAttribute('aria-valuetext', '79%');
    await expect(canvas.getAllByText('Approaching quota')).toHaveLength(1);
    await expect(canvas.getAllByText('At or over quota')).toHaveLength(1);
  },
};

export const Empty: Story = { render: () => <EmptyState title="No tenants yet" /> };
export const EmptyWithAction: Story = { render: () => <EmptyState title="No tenants match your filters" description="Try another status or plan." action={<Button>Clear filters</Button>} /> };
export const Error: Story = { render: () => <ErrorState message="Something went wrong on our side. Try again." onRetry={() => undefined} /> };
export const ErrorLongText: Story = { render: () => <ErrorState message={'Storage quota is full. Free up space or ask an admin to raise the quota. '.repeat(4)} /> };
export const Loading: Story = { render: () => <Skeleton lines={4} /> };
export const StatesRightToLeft: Story = { render: () => <ErrorState message="Something went wrong on our side. Try again." onRetry={() => undefined} />, decorators: [rtl] };

export const RetryCallsHandler: StoryObj<{ onRetry: () => void }> = {
  name: 'TECH-6: Retry calls the handler',
  tags: ['play'],
  args: { onRetry: fn() },
  render: (args) => <ErrorState message="Something went wrong on our side. Try again." onRetry={args.onRetry} />,
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Retry' }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};
