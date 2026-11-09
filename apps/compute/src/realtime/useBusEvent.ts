// Subscribes for the lifetime of the calling component; unmount removes it (RT-7).
import { inject, onUnmounted } from 'vue';
import type { BusEventName, BusEvents } from '@nimbus/mf-contract';
import { BUS_KEY } from './bus';

export function useBusEvent<K extends BusEventName>(type: K, handler: (payload: BusEvents[K]) => void): void {
  const bus = inject(BUS_KEY);
  if (!bus) throw new Error('useBusEvent needs BUS_KEY (provided in mount.ts)');
  const off = bus.subscribe(type, (payload) => handler(payload));
  onUnmounted(off);
}
