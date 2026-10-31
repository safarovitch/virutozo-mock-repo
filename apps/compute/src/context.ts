import type { InjectionKey, ShallowRef } from 'vue';
import type { RemoteContext } from '@nimbus/mf-contract';

/** The reactive RemoteContext; replaced on every update(ctx) (specs/shared/mf-contract.md). */
export const CTX_KEY: InjectionKey<ShallowRef<RemoteContext>> = Symbol('nimbus-remote-ctx');
