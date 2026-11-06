<script setup lang="ts">
// Combobox (§8.2, D8-05): WAI-ARIA APG "combobox with listbox popup", the same markup and CSS as ui-kit's
// React Combobox. Focus stays in the input; the active option is `aria-activedescendant`. The owner does
// the search (`search`, debounced here) and passes the results as `options`.
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue';
import { t } from '@nimbus/messages';
import StatusBadge from './NuiStatusBadge.vue';
import type { ComboboxOption } from './types';

const props = withDefaults(
  defineProps<{
    label: string;
    placeholder?: string;
    /** The chosen option's label, shown while the user isn't typing. */
    value?: string;
    options: readonly ComboboxOption[];
    loading?: boolean;
    /** A mapped message for a failed search (MSG-3). */
    error?: string;
    emptyText: string;
    searchDelayMs?: number;
  }>(),
  { placeholder: undefined, value: '', loading: false, error: undefined, searchDelayMs: 300 },
);
const emit = defineEmits<{ search: [query: string]; select: [option: ComboboxOption] }>();

const inputId = useId();
const listId = useId();
const open = ref(false);
const text = ref<string | null>(null); // null: not typing, show `value`
const active = ref(-1);
let timer: ReturnType<typeof setTimeout> | undefined;

onBeforeUnmount(() => clearTimeout(timer));
watch(() => props.options.map((o) => o.id).join('\n'), () => (active.value = -1));

function search(query: string, delay: number) {
  clearTimeout(timer);
  timer = setTimeout(() => emit('search', query.trim()), delay);
}
function show() {
  if (open.value) return;
  open.value = true;
  search(text.value ?? '', 0);
}
function close() {
  clearTimeout(timer);
  open.value = false;
  text.value = null;
  active.value = -1;
}
function choose(option: ComboboxOption) {
  close();
  emit('select', option);
}
function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  text.value = value;
  open.value = true;
  search(value, props.searchDelayMs);
}
function onKeydown(event: KeyboardEvent) {
  const count = props.options.length;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (!open.value) return show();
    if (!count) return;
    active.value = event.key === 'ArrowDown' ? (active.value + 1) % count : active.value <= 0 ? count - 1 : active.value - 1;
  } else if (event.key === 'Enter' && open.value && active.value >= 0) {
    const option = props.options[active.value];
    if (!option) return;
    event.preventDefault();
    choose(option);
  } else if (event.key === 'Escape' && (open.value || text.value !== null)) {
    event.preventDefault();
    event.stopPropagation(); // a combobox in a dialog closes its popup, not the dialog
    close();
  }
}

const status = computed(() => (props.loading ? t('common.loading') : props.error ? props.error : props.options.length === 0 ? props.emptyText : null));
const optionId = (i: number) => `${listId}-${i}`;
</script>

<template>
  <div class="nui-combobox">
    <label :for="inputId">{{ label }}</label>
    <input
      :id="inputId"
      class="nui-input"
      role="combobox"
      :aria-expanded="open"
      :aria-controls="listId"
      aria-autocomplete="list"
      :aria-activedescendant="open && active >= 0 ? optionId(active) : undefined"
      autocomplete="off"
      spellcheck="false"
      :placeholder="placeholder"
      :value="text ?? value"
      @input="onInput"
      @click="show"
      @keydown="onKeydown"
      @blur="close"
    >
    <div
      class="nui-combobox__popup"
      :hidden="!open"
    >
      <p
        v-if="status"
        :class="error && !loading ? 'nui-combobox__status nui-combobox__status--error' : 'nui-combobox__status'"
        role="status"
      >
        {{ status }}
      </p>
      <ul
        :id="listId"
        role="listbox"
        :aria-label="label"
        class="nui-combobox__list"
      >
        <template v-if="!loading && !error">
          <li
            v-for="(option, i) in options"
            :id="optionId(i)"
            :key="option.id"
            role="option"
            :aria-selected="i === active"
            class="nui-combobox__option"
            @mousedown.prevent
            @click="choose(option)"
          >
            <span>{{ option.label }}</span>
            <span
              v-if="option.description"
              class="nui-combobox__description"
            >{{ option.description }}</span>
            <StatusBadge
              v-if="option.badge"
              :tone="option.badge.tone"
              :label="option.badge.label"
            />
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>
