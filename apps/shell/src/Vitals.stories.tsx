// `/_vitals` states (H6, D9-09): rows, loading, empty, error; no permission is the shell's 403 page.
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { VitalSummary } from '@nimbus/api-client/model';
import { NoAccessPage } from './pages';
import { VitalsView } from './VitalsPage';

const ROWS: VitalSummary[] = [
  { route: '/tenants', metric: 'LCP', p75: 1840, rating: 'good', samples: 412 },
  { route: '/tenants', metric: 'INP', p75: 260, rating: 'needs-improvement', samples: 380 },
  { route: '/tenants', metric: 'CLS', p75: 0.31, rating: 'poor', samples: 412 },
  { route: '/compute/:vmId', metric: 'LCP', p75: 2100, rating: 'good', samples: 57 },
];

const meta = { title: 'shell/Vitals' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const noop = () => undefined;

export const Rows: Story = { render: () => <VitalsView rows={ROWS} loading={false} onRetry={noop} /> };
export const Loading: Story = { render: () => <VitalsView rows={undefined} loading onRetry={noop} /> };
export const Empty: Story = { render: () => <VitalsView rows={[]} loading={false} onRetry={noop} /> };
export const LoadError: Story = { render: () => <VitalsView rows={undefined} loading={false} error="Something went wrong on our side. Try again." onRetry={noop} /> };
export const NoPermission: Story = { render: () => <NoAccessPage home="compute" /> }; // the preview provides the router
