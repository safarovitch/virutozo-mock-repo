// The shell's root bus for one session (RT-10), with bus errors going to the logger (D4-08).
import { createLogger } from '@nimbus/logger';
import { BusPublishError, createRootBus, type RootBus } from '@nimbus/mf-contract';

const log = createLogger('shell');

/**
 * `strict` (development and e2e builds): a remote publishing a non-remote event throws.
 * In production that publish is dropped and logged (`bus.publish_rejected`, AC-SHL-6.11).
 * A throwing subscriber is logged with its scope and never stops delivery (`bus.subscriber_error`, RT-8).
 */
export function createSessionBus({ strict }: { strict: boolean }): RootBus {
  return createRootBus({
    strict,
    onError(error, { event, subscriber }) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof BusPublishError) log.error('bus.publish_rejected', { event, scope: subscriber });
      else log.error('bus.subscriber_error', { event, scope: subscriber, message });
    },
  });
}
