import type { InjectionKey } from 'vue';
import type { ScopedBus } from '@nimbus/mf-contract';

/** This remote's scope of the root bus (`ctx.events`), provided once in mount.ts (specs/shared/realtime.md). */
export const BUS_KEY: InjectionKey<ScopedBus> = Symbol('nimbus-bus');
