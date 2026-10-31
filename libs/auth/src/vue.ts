// Vue permission gate (RBAC-1, AC-SHL-3.3): `v-can="Permission['vm:operate']"`.
// The session can't change while a remote is mounted (sign-out unmounts it, RT-10), so the check runs
// once: before mount the element is hidden, so nothing flashes, and on mount it's removed from the DOM.
import type { Directive } from 'vue';
import type { Permission } from '@nimbus/api-client/model';
import type { SessionSnapshot } from '@nimbus/mf-contract';
import { can } from './index';

export function createCanDirective(getSession: () => SessionSnapshot | null): Directive<HTMLElement, Permission> {
  return {
    beforeMount(el, binding) {
      if (!can(getSession(), binding.value)) el.style.display = 'none';
    },
    mounted(el, binding) {
      if (!can(getSession(), binding.value)) el.remove();
    },
  };
}
