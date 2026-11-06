<script setup lang="ts">
// The admin tenant picker (SPEC-CMP-4, D8-05/06): ui-kit-vue's Combobox over this area's own `listTenants`
// query (MF-2). The owner keeps the choice in the URL.
import { computed, ref } from 'vue';
import type { Tenant } from '@nimbus/api-client/model';
import { Combobox, type ComboboxOption } from '@nimbus/ui-kit-vue';
import { errorMessage, useTenantSearch } from './data';
import { t } from './messages/en';

defineProps<{ value?: string }>();
const emit = defineEmits<{ select: [tenantId: string] }>();

const query = ref<string | undefined>(undefined); // undefined until the popup first opens
const search = useTenantSearch(query);

const TONE = { suspended: 'warning', provisioning: 'info', error: 'danger', active: 'success' } as const;
const toOption = (tenant: Tenant): ComboboxOption => ({
  id: tenant.id,
  label: tenant.displayName,
  description: tenant.name,
  ...(tenant.status !== 'active' ? { badge: { tone: TONE[tenant.status], label: t(`status.tenant.${tenant.status}`) } } : {}),
});
const options = computed(() => (search.data.value?.items ?? []).map(toOption));
</script>

<template>
  <Combobox
    :label="t('common.tenant')"
    :placeholder="t('tenantPicker.placeholder')"
    :value="value"
    :options="options"
    :loading="search.isFetching.value && !search.data.value"
    :error="search.error.value ? errorMessage(search.error.value) : undefined"
    :empty-text="t('tenantPicker.noResults')"
    @search="query = $event"
    @select="emit('select', $event.id)"
  />
</template>
