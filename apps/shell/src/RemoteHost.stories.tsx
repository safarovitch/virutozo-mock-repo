// The MF-4 panel a remote gets when it fails to load or crashes (SPEC-SHL-4, D7-21).
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RemoteUnavailable } from './RemoteHost';

const meta: Meta<typeof RemoteUnavailable> = { title: 'Shell/RemoteUnavailable', component: RemoteUnavailable, args: { onRetry: () => undefined } };
export default meta;
type Story = StoryObj<typeof RemoteUnavailable>;

export const Storage: Story = { args: { title: 'Storage' } };
export const Compute: Story = { args: { title: 'Compute' } };
