// SPEC-TEN-2: the create tenant wizard (D7-05 … D7-11). A modal that isn't in the URL: Details → Plan &
// quotas → Review. Each step validates with the generated Zod schema plus the UI's plan rules.
import { useId, useRef, useState, type ReactNode } from 'react';
import { messageFor } from '@nimbus/api-client';
import type { Plan, Problem, TenantCreate } from '@nimbus/api-client/model';
import { CreateTenantBody } from '@nimbus/api-client/zod';
import { bytesToGib, formatBytes, formatCount, formatMoney, gibToBytes } from '@nimbus/format';
import { Button, ConfirmDialog, Dialog, EmptyState, ErrorState, Skeleton, Wizard } from '@nimbus/ui-kit';
import { useCtx } from './context';
import { errorMessage, problemOf, useCreateTenant, usePlans } from './data';
import { t } from './messages/en';

export interface WizardValues {
  name: string;
  displayName: string;
  adminEmail: string;
  planId: string;
  storageGib: string;
  vmQuota: string;
}

type Field = keyof WizardValues;
type Errors = Partial<Record<Field | 'form', string>>;

export const EMPTY: WizardValues = { name: '', displayName: '', adminEmail: '', planId: '', storageGib: '', vmQuota: '' };
const STEP_FIELDS: readonly (readonly Field[])[] = [['name', 'displayName', 'adminEmail'], ['planId', 'storageGib', 'vmQuota'], []];

// ── Validation (D7-06): the generated schema, extended with the plan's maximums ──

const details = CreateTenantBody.pick({ name: true, displayName: true, adminEmail: true });

export function validateDetails(v: WizardValues): Errors {
  const errors: Errors = {};
  const parsed = details.safeParse({ name: v.name, displayName: v.displayName || undefined, adminEmail: v.adminEmail });
  if (!v.name) errors.name = t('validation.required');
  if (!v.adminEmail) errors.adminEmail = t('validation.required');
  for (const issue of parsed.success ? [] : parsed.error.issues) {
    const field = issue.path[0] as Field;
    if (errors[field]) continue;
    if (field === 'name') errors.name = t('tenants.nameInvalid'); // AC-TEN-2.1
    else if (field === 'adminEmail') errors.adminEmail = t('validation.email');
    else errors[field] = t('errors.VALIDATION_FAILED');
  }
  return errors;
}

const toNumber = (text: string) => (text.trim() === '' ? Number.NaN : Number(text));

export function validatePlan(v: WizardValues, plan: Plan | undefined): Errors {
  if (!plan) return { planId: t('validation.required') };
  const schema = CreateTenantBody.pick({ storageQuotaBytes: true, vmQuota: true }).extend({
    storageQuotaBytes: CreateTenantBody.shape.storageQuotaBytes.max(plan.maxStorageQuotaBytes),
    vmQuota: CreateTenantBody.shape.vmQuota.max(Math.min(plan.maxVmQuota, 500)),
  });
  const storage = toNumber(v.storageGib);
  const vms = toNumber(v.vmQuota);
  const parsed = schema.safeParse({ storageQuotaBytes: Number.isInteger(storage) ? gibToBytes(storage) : storage, vmQuota: vms });
  const errors: Errors = {};
  for (const issue of parsed.success ? [] : parsed.error.issues) {
    const field: Field = issue.path[0] === 'storageQuotaBytes' ? 'storageGib' : 'vmQuota';
    if (errors[field]) continue;
    const text = field === 'storageGib' ? v.storageGib : v.vmQuota;
    if (text.trim() === '') errors[field] = t('validation.required');
    else if (issue.code === 'too_big') errors[field] = exceedsPlan(field === 'storageGib' ? 'storage' : 'vms', plan); // AC-TEN-2.2, 2.8
    else if (issue.code === 'too_small') errors[field] = t('validation.min', { min: 1 });
    else errors[field] = t('validation.wholeNumber');
  }
  return errors;
}

const exceedsPlan = (resource: 'storage' | 'vms', plan: Plan) =>
  messageFor({ code: 'QUOTA_EXCEEDS_PLAN', params: { resource, plan: plan.name, max: resource === 'storage' ? plan.maxStorageQuotaBytes : plan.maxVmQuota } });

/** D7-09: a server error → the fields it names and the earliest step that has one. */
export function serverErrors(problem: Problem | undefined, fallback: string): { errors: Errors; step: number } {
  const byServerField: Record<string, Field> = { name: 'name', displayName: 'displayName', adminEmail: 'adminEmail', planId: 'planId', storageQuotaBytes: 'storageGib', vmQuota: 'vmQuota' };
  const errors: Errors = {};
  if (problem?.code === 'TENANT_NAME_TAKEN') errors.name = messageFor(problem); // AC-TEN-2.4
  else if (problem?.code === 'QUOTA_EXCEEDS_PLAN') errors[problem.params?.resource === 'storage' ? 'storageGib' : 'vmQuota'] = messageFor(problem);
  else if (problem?.code === 'VALIDATION_FAILED' && problem.errors?.length) {
    for (const e of problem.errors) {
      const field = byServerField[e.field];
      if (field) errors[field] = t('errors.VALIDATION_FAILED');
      else errors.form = messageFor(problem);
    }
  } else errors.form = fallback;
  const step = STEP_FIELDS.findIndex((fields) => fields.some((f) => errors[f]));
  return { errors, step: step === -1 ? 2 : step };
}

export function toBody(v: WizardValues): TenantCreate {
  return {
    name: v.name,
    ...(v.displayName ? { displayName: v.displayName } : {}),
    adminEmail: v.adminEmail,
    planId: v.planId,
    storageQuotaBytes: gibToBytes(Number(v.storageGib)),
    vmQuota: Number(v.vmQuota),
  };
}

// ── The wizard ──

export interface CreateTenantWizardProps {
  open: boolean;
  onClose: () => void;
}

export function CreateTenantWizard({ open, onClose }: CreateTenantWizardProps) {
  const ctx = useCtx();
  const plans = usePlans();
  const mutation = useCreateTenant(ctx.events);
  return (
    <CreateTenantWizardView
      open={open}
      onClose={onClose}
      plans={plans.data}
      plansError={plans.error}
      onRetryPlans={() => void plans.refetch()}
      submitting={mutation.isPending}
      onSubmit={(body, handlers) => mutation.mutate(body, handlers)}
    />
  );
}

export interface CreateTenantWizardViewProps extends CreateTenantWizardProps {
  plans: readonly Plan[] | undefined;
  plansError?: unknown;
  onRetryPlans: () => void;
  submitting: boolean;
  onSubmit: (body: TenantCreate, handlers: { onSuccess: () => void; onError: (error: unknown) => void }) => void;
  /** Stories start on a later step or with errors. */
  initial?: { values?: WizardValues; step?: number; errors?: Errors; discarding?: boolean };
}

/** The wizard without data fetching, so every state has a story (H6). */
export function CreateTenantWizardView({ open, onClose, plans, plansError, onRetryPlans, submitting, onSubmit, initial }: CreateTenantWizardViewProps) {
  const [values, setValues] = useState<WizardValues>(initial?.values ?? EMPTY);
  const [edited, setEdited] = useState<ReadonlySet<Field>>(new Set());
  const [errors, setErrors] = useState<Errors>(initial?.errors ?? {});
  const [step, setStep] = useState(initial?.step ?? 0);
  const [discarding, setDiscarding] = useState(initial?.discarding ?? false);
  const sending = useRef(false); // AC-TEN-2.5: a second click in the same tick sends nothing
  const plan = plans?.find((p) => p.id === values.planId);
  const dirty = (Object.keys(EMPTY) as Field[]).some((f) => values[f] !== EMPTY[f]);

  const reset = () => {
    setValues(EMPTY);
    setEdited(new Set());
    setErrors({});
    setStep(0);
    setDiscarding(false);
  };
  const close = () => {
    reset();
    onClose();
  };
  const requestClose = () => (dirty ? setDiscarding(true) : close()); // AC-TEN-2.6

  const set = (field: Field, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setEdited((e) => new Set(e).add(field));
  };
  // D7-07: quotas the user hasn't edited follow the plan's defaults.
  const pickPlan = (next: Plan) =>
    setValues((v) => ({
      ...v,
      planId: next.id,
      storageGib: edited.has('storageGib') ? v.storageGib : String(bytesToGib(next.defaultStorageQuotaBytes)),
      vmQuota: edited.has('vmQuota') ? v.vmQuota : String(next.defaultVmQuota),
    }));
  const check = (index: number): Errors => (index === 0 ? validateDetails(values) : index === 1 ? validatePlan(values, plan) : {});
  /** On blur: show (or clear) this field's error only. */
  const blur = (field: Field) => {
    const index = STEP_FIELDS.findIndex((fields) => fields.includes(field));
    const found = check(index)[field];
    setErrors((e) => ({ ...e, [field]: found }));
  };
  const validateStep = (index: number) => () => {
    const found = check(index);
    setErrors((e) => {
      const next = { ...e, form: undefined };
      for (const f of STEP_FIELDS[index] ?? []) next[f] = found[f];
      return next;
    });
    return !Object.values(found).some(Boolean);
  };

  const submit = () => {
    if (sending.current || submitting) return;
    sending.current = true;
    setErrors({});
    onSubmit(toBody(values), {
      onSuccess: () => {
        sending.current = false;
        close(); // D7-11: a new open starts clean
      },
      onError: (error) => {
        sending.current = false;
        const mapped = serverErrors(problemOf(error), errorMessage(error));
        setErrors(mapped.errors);
        setStep(mapped.step);
      },
    });
  };

  const field = (name: Field) => ({ value: values[name], error: errors[name], onChange: (v: string) => set(name, v), onBlur: () => blur(name) });

  const steps = [
    {
      id: 'tenants-wizard-details',
      title: t('tenants.wizard.steps.details'),
      validate: validateStep(0),
      content: (
        <div className="tenants-wizard__fields">
          <TextField label={t('tenants.fields.name')} autoComplete="off" spellCheck={false} {...field('name')} />
          <TextField label={t('tenants.fields.displayName')} hint={t('tenants.wizard.displayNameHint')} maxLength={120} {...field('displayName')} />
          <TextField label={t('tenants.fields.adminEmail')} type="email" autoComplete="off" {...field('adminEmail')} />
        </div>
      ),
    },
    {
      id: 'tenants-wizard-plan',
      title: t('tenants.wizard.steps.plan'),
      validate: () => Boolean(plans?.length) && validateStep(1)(),
      content: (
        <PlanStep plans={plans} plansError={plansError} onRetry={onRetryPlans} selected={values.planId} onPick={pickPlan} error={errors.planId}>
          <TextField label={t('tenants.quotas.storage')} type="number" inputMode="numeric" min={1} step={1} disabled={!plan} {...field('storageGib')} />
          <TextField label={t('tenants.quotas.vms')} type="number" inputMode="numeric" min={1} step={1} disabled={!plan} {...field('vmQuota')} />
        </PlanStep>
      ),
    },
    {
      id: 'tenants-wizard-review',
      title: t('tenants.wizard.steps.review'),
      content: <Review values={values} plan={plan} error={errors.form} onEdit={setStep} />,
    },
  ] as const;

  return (
    <>
      <Dialog open={open} onClose={requestClose} title={t('tenants.wizard.title')} className="tenants-wizard">
        <Wizard steps={steps} step={step} onStepChange={setStep} submitLabel={t('tenants.create')} onSubmit={submit} submitting={submitting} />
      </Dialog>
      <ConfirmDialog
        open={open && discarding}
        title={t('tenants.discardChanges')}
        confirmLabel={t('tenants.discard')}
        danger
        onConfirm={close}
        onCancel={() => setDiscarding(false)}
      >
        {null}
      </ConfirmDialog>
    </>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  type?: 'text' | 'email' | 'number';
  inputMode?: 'numeric';
  min?: number;
  step?: number;
  maxLength?: number;
  disabled?: boolean;
  autoComplete?: string;
  spellCheck?: boolean;
}

function TextField({ label, value, error, hint, onChange, onBlur, type = 'text', ...rest }: TextFieldProps) {
  const id = useId();
  const described = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="nui-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="nui-input" type={type} value={value} aria-invalid={Boolean(error)} aria-describedby={described} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} {...rest} />
      {hint && (
        <p id={`${id}-hint`} className="tenants-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="tenants-error">
          {error}
        </p>
      )}
    </div>
  );
}

function PlanStep({ plans, plansError, onRetry, selected, onPick, error, children }: { plans: readonly Plan[] | undefined; plansError?: unknown; onRetry: () => void; selected: string; onPick: (plan: Plan) => void; error?: string; children: ReactNode }) {
  const name = useId();
  if (plansError && !plans) return <ErrorState message={errorMessage(plansError)} onRetry={onRetry} />; // D7-08
  if (!plans) return <Skeleton lines={4} label={t('common.loading')} />;
  if (!plans.length) return <EmptyState title={t('tenants.wizard.noPlans')} />;
  return (
    <>
      <fieldset className="tenants-plans" aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined}>
        <legend>{t('tenants.fields.plan')}</legend>
        {plans.map((p) => (
          <label key={p.id} className="tenants-plans__card">
            <input type="radio" name={name} value={p.id} checked={selected === p.id} onChange={() => onPick(p)} />
            <span className="tenants-plans__name">{p.name}</span>
            <span>{t('tenants.wizard.planLimits', { storage: formatBytes(p.maxStorageQuotaBytes), vms: formatCount(p.maxVmQuota) })}</span>
            <span>{t('tenants.wizard.planPrice', { perGiB: formatMoney(p.pricePerGiBMonth), perVcpu: formatMoney(p.pricePerVcpuMonth) })}</span>
          </label>
        ))}
      </fieldset>
      {error && (
        <p id={`${name}-error`} className="tenants-error">
          {error}
        </p>
      )}
      {children}
    </>
  );
}

function Review({ values, plan, error, onEdit }: { values: WizardValues; plan?: Plan; error?: string; onEdit: (step: number) => void }) {
  const edit = (step: number, title: string) => (
    <Button variant="ghost" onClick={() => onEdit(step)}>
      {t('tenants.wizard.edit', { step: title })}
    </Button>
  );
  return (
    <>
      {error && (
        <p role="alert" className="tenants-error">
          {error}
        </p>
      )}
      <section className="tenants-review" aria-label={t('tenants.wizard.steps.details')}>
        <dl className="tenants-fields">
          <dt>{t('tenants.fields.name')}</dt>
          <dd>{values.name}</dd>
          <dt>{t('tenants.fields.displayName')}</dt>
          <dd>{values.displayName || values.name}</dd>
          <dt>{t('tenants.fields.adminEmail')}</dt>
          <dd>{values.adminEmail}</dd>
        </dl>
        {edit(0, t('tenants.wizard.steps.details'))}
      </section>
      <section className="tenants-review" aria-label={t('tenants.wizard.steps.plan')}>
        <dl className="tenants-fields">
          <dt>{t('tenants.fields.plan')}</dt>
          <dd>{plan?.name ?? '—'}</dd>
          <dt>{t('tenants.quotas.storage')}</dt>
          <dd>{values.storageGib ? formatBytes(gibToBytes(Number(values.storageGib))) : '—'}</dd>
          <dt>{t('tenants.quotas.vms')}</dt>
          <dd>{values.vmQuota || '—'}</dd>
        </dl>
        {edit(1, t('tenants.wizard.steps.plan'))}
      </section>
    </>
  );
}
