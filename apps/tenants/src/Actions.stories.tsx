// The create tenant wizard (SPEC-TEN-2) and suspend / resume (SPEC-TEN-4), one story per state (H6, D7-21).
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createRootBus, type RemoteContext } from '@nimbus/mf-contract';
import { SessionProvider } from '@nimbus/ui-kit';
import { LifecycleDialog } from './actions';
import { CtxContext } from './context';
import { CreateTenantWizardView, EMPTY, type CreateTenantWizardViewProps, type WizardValues } from './CreateTenantWizard';
import { LifecycleContext, createLifecycleStore } from './lifecycle';
import { TenantListView } from './TenantList';
import { ACME, PLANS, makeTenants, task } from './testing/fake-api';
import { PROVIDER } from './testing/render';
import { parsePath } from './url';

const meta: Meta = { title: 'Tenants/Actions' };
export default meta;
type Story = StoryObj;

const FILLED: WizardValues = { name: 'new-co', displayName: 'New Co', adminEmail: 'admin@new-co.test', planId: 'p_starter', storageGib: '50', vmQuota: '5' };

function WizardStory(props: Partial<CreateTenantWizardViewProps>) {
  return <CreateTenantWizardView open onClose={() => undefined} plans={PLANS} onRetryPlans={() => undefined} submitting={false} onSubmit={() => undefined} {...props} />;
}

export const WizardDetails: Story = { render: () => <WizardStory /> };
export const WizardDetailsErrors: Story = {
  render: () => <WizardStory initial={{ values: { ...EMPTY, name: 'Acme Corp' }, errors: { name: 'Use lowercase letters, numbers and hyphens.', adminEmail: 'Enter a value.' } }} />,
};
export const WizardPlansLoading: Story = { render: () => <WizardStory plans={undefined} initial={{ values: FILLED, step: 1 }} /> };
export const WizardPlansError: Story = { render: () => <WizardStory plans={undefined} plansError={new Error('offline')} initial={{ values: FILLED, step: 1 }} /> };
export const WizardNoPlans: Story = { render: () => <WizardStory plans={[]} initial={{ values: FILLED, step: 1 }} /> };
export const WizardPlanOverLimit: Story = {
  render: () => <WizardStory initial={{ values: { ...FILLED, storageGib: '200', vmQuota: '20' }, step: 1, errors: { storageGib: 'Starter allows up to 100 GiB.', vmQuota: 'Starter allows up to 10 VMs.' } }} />,
};
export const WizardReview: Story = { render: () => <WizardStory initial={{ values: FILLED, step: 2 }} /> };
export const WizardReviewServerError: Story = { render: () => <WizardStory initial={{ values: FILLED, step: 2, errors: { form: 'Something went wrong on our side. Try again.' } }} /> };
export const WizardSubmitting: Story = { render: () => <WizardStory submitting initial={{ values: FILLED, step: 2 }} /> };
export const WizardDiscardPrompt: Story = { render: () => <WizardStory initial={{ values: FILLED, discarding: true }} /> };

export const SuspendDialog: Story = { render: () => <LifecycleDialog target={{ tenant: ACME, verb: 'suspend' }} busy={false} onConfirm={() => undefined} onCancel={() => undefined} /> };
export const SuspendDialogBusy: Story = { render: () => <LifecycleDialog target={{ tenant: ACME, verb: 'suspend' }} busy onConfirm={() => undefined} onCancel={() => undefined} /> };
export const ResumeDialog: Story = {
  render: () => <LifecycleDialog target={{ tenant: { ...ACME, status: 'suspended' }, verb: 'resume' }} busy={false} onConfirm={() => undefined} onCancel={() => undefined} />,
};

/** The list with acme being suspended (D7-01): the status cell shows "Suspending…". */
function SuspendingRow() {
  const [store] = useState(() => {
    const s = createLifecycleStore();
    s.started(task('task_s', { kind: 'tenant.suspend', status: 'running' }));
    return s;
  });
  const [events] = useState(() => createRootBus().scope('tenants'));
  const ctx: RemoteContext = { basePath: '/tenants', path: '/', session: { user: { id: 'u', name: 'Alex Provider', email: 'alex@nimbus.test' }, role: 'provider_admin', tenant: null, permissions: PROVIDER }, navigate: () => undefined, events };
  const rows = makeTenants(20);
  return (
    <CtxContext.Provider value={ctx}>
      <SessionProvider session={ctx.session}>
        <LifecycleContext.Provider value={store}>
          <TenantListView url={parsePath('/')} rows={rows} total={rows.length} plans={new Map(PLANS.map((p) => [p.id, p]))} plansReady loading={false} fetchingMore={false} refreshing={false} onRetry={() => undefined} height={400} />
        </LifecycleContext.Provider>
      </SessionProvider>
    </CtxContext.Provider>
  );
}
export const RowSuspending: Story = { render: () => <SuspendingRow /> };
