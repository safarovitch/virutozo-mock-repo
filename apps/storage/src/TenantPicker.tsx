// The admin tenant picker (SPEC-STO-3, D8-05/06): ui-kit's Combobox over this area's own `listTenants`
// query (MF-2). The owner keeps the choice in the URL.
import { useState } from 'react';
import type { Tenant } from '@nimbus/api-client/model';
import { Combobox, StatusBadge, type ComboboxOption, type StatusTone } from '@nimbus/ui-kit';
import { errorMessage, useTenantSearch } from './data';
import { t } from './messages/en';

const TONE: Record<Tenant['status'], StatusTone> = { active: 'success', suspended: 'warning', provisioning: 'info', error: 'danger' };

const toOption = (tenant: Tenant): ComboboxOption => ({
  id: tenant.id,
  label: tenant.displayName,
  description: tenant.name,
  ...(tenant.status !== 'active' ? { badge: <StatusBadge tone={TONE[tenant.status]} label={t(`status.tenant.${tenant.status}`)} /> } : {}),
});

export function TenantPicker({ value, onSelect }: { value: string | undefined; onSelect: (tenantId: string) => void }) {
  const [query, setQuery] = useState<string | undefined>(undefined); // undefined until the popup first opens
  const search = useTenantSearch(query);
  return (
    <Combobox
      label={t('common.tenant')}
      placeholder={t('tenantPicker.placeholder')}
      {...(value ? { value } : {})}
      options={(search.data?.items ?? []).map(toOption)}
      loading={search.isFetching && !search.data}
      {...(search.error ? { error: errorMessage(search.error) } : {})}
      emptyText={t('tenantPicker.noResults')}
      onSearch={setQuery}
      onSelect={(option) => onSelect(option.id)}
    />
  );
}
