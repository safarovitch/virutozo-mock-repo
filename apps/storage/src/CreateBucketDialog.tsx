// Create bucket (SPEC-STO-2, D8-13): Name and Versioning. The name is checked on blur or on *Create*,
// whichever comes first, and nothing is sent while it's invalid (AC-STO-2.1/2.2). Server errors on the
// name show at the field; everything else shows inline in the dialog, and the values are kept (AC-STO-2.3).
import { useId, useRef, useState, type FormEvent } from 'react';
import type { Bucket } from '@nimbus/api-client/model';
import { Button, Dialog } from '@nimbus/ui-kit';
import { errorMessage, problemOf, useCreateBucket } from './data';
import { t } from './messages/en';
import { bucketNameError } from './validate';

export interface CreateBucketDialogProps {
  open: boolean;
  ownTenantId: string | undefined;
  onClose: () => void;
  onCreated: (bucket: Bucket) => void;
}

const FIELD_CODES = new Set(['BUCKET_NAME_TAKEN', 'VALIDATION_FAILED']);

export function CreateBucketDialog({ open, ownTenantId, onClose, onCreated }: CreateBucketDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={t('storage.create.title')}>
      {/* The form mounts per opening, so a new dialog starts empty. */}
      {open && <CreateBucketForm ownTenantId={ownTenantId} onClose={onClose} onCreated={onCreated} />}
    </Dialog>
  );
}

function CreateBucketForm({ ownTenantId, onClose, onCreated }: Omit<CreateBucketDialogProps, 'open'>) {
  const nameId = useId();
  const errorId = useId();
  const versioningId = useId();
  const [name, setName] = useState('');
  const [versioning, setVersioning] = useState(false);
  const [checked, setChecked] = useState(false); // blurred or submitted once
  const [serverField, setServerField] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateBucket(ownTenantId);
  const pending = useRef(false); // D7-11: a second click before the state updates sends nothing

  const localKey = checked ? bucketNameError(name) : undefined;
  const fieldError = localKey ? t(localKey) : serverField;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (bucketNameError(name) || pending.current) return;
    pending.current = true;
    setServerError(null);
    setServerField(null);
    create.mutate(
      { name, versioning },
      {
        onSuccess: (bucket) => onCreated(bucket),
        onError: (error) => {
          const problem = problemOf(error);
          if (problem && FIELD_CODES.has(problem.code) && (problem.code !== 'VALIDATION_FAILED' || problem.errors?.some((e) => e.field === 'name'))) setServerField(errorMessage(error));
          else if (problem?.status !== 403) setServerError(errorMessage(error)); // 403: the shell's toast (D3-14)
        },
        onSettled: () => {
          pending.current = false;
        },
      },
    );
  };

  return (
    <form className="storage-form" onSubmit={submit} noValidate>
      {serverError && <p role="alert" className="storage-form__error">{serverError}</p>}
      <div className="nui-field">
        <label htmlFor={nameId}>{t('storage.fields.name')}</label>
        <input
          id={nameId}
          className="nui-input"
          value={name}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? errorId : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setServerField(null);
          }}
          onBlur={() => setChecked(true)}
        />
        {fieldError && (
          <p id={errorId} className="storage-form__field-error">
            {fieldError}
          </p>
        )}
      </div>
      <label className="storage-form__switch" htmlFor={versioningId}>
        <input id={versioningId} type="checkbox" role="switch" checked={versioning} onChange={(event) => setVersioning(event.target.checked)} />
        {t('storage.fields.versioning')}
      </label>
      <div className="nui-dialog__footer storage-form__footer">
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={create.isPending}>
          {t('storage.create.confirm')}
        </Button>
      </div>
    </form>
  );
}
