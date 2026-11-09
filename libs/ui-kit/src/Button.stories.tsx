import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from './Button';

const meta = {
  title: 'ui-kit/Button',
  component: Button,
  args: { children: 'Suspend tenant', onClick: fn() },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Danger: Story = { args: { variant: 'danger' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Loading: Story = { args: { variant: 'primary', loading: true } };
export const Disabled: Story = { args: { disabled: true } };
export const DisabledWithReason: Story = { args: { disabledReason: "You don't have permission to suspend tenants." } };
export const LongText: Story = { args: { children: 'Start, stop or reboot every virtual machine of this tenant right now' } };
export const RightToLeft: Story = { args: { variant: 'primary', loading: true }, decorators: [(S) => <div dir="rtl"><S /></div>] };

export const ClickWhileLoading: Story = {
  name: 'TECH-6: click while loading does nothing',
  tags: ['play'],
  args: { variant: 'primary', loading: true },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Suspend tenant' });
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
  },
};

export const DisabledReasonIsReachable: Story = {
  name: 'TECH-6: a disabled action stays focusable and explains why (RBAC-4)',
  tags: ['play'],
  args: { disabledReason: "You don't have permission to suspend tenants." },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Suspend tenant' });
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await expect(button).toHaveAccessibleDescription("You don't have permission to suspend tenants.");
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
