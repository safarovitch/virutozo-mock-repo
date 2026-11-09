// Tabs keep their sessions in step over BroadcastChannel('nimbus:session') (SPEC-SHL-7, D8-17). Messages
// carry no secrets: a type and, for a sign-in, the user ID. A tab never receives its own messages.
import { createLogger } from '@nimbus/logger';

const log = createLogger('shell');

export type TabMessage = { type: 'signed-out' } | { type: 'expired' } | { type: 'signed-in'; userId: string };

export interface TabChannel {
  post(message: TabMessage): void;
  subscribe(listener: (message: TabMessage) => void): () => void;
}

/** The three shapes, checked by hand; anything else is ignored (another app version, a stray post). */
export function isTabMessage(data: unknown): data is TabMessage {
  if (typeof data !== 'object' || data === null || !('type' in data)) return false;
  const { type } = data as { type: unknown };
  if (type === 'signed-out' || type === 'expired') return Object.keys(data).length === 1;
  return type === 'signed-in' && Object.keys(data).length === 2 && typeof (data as { userId?: unknown }).userId === 'string';
}

/** Structural type of the BroadcastChannel this needs, so tests pass a fake. */
export interface ChannelLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

export const CHANNEL_NAME = 'nimbus:session';

export function createTabChannel(channel: ChannelLike): TabChannel {
  let warned = false;
  return {
    post: (message) => channel.postMessage(message),
    subscribe(listener) {
      const onMessage = (event: { data: unknown }) => {
        if (isTabMessage(event.data)) return listener(event.data);
        if (!warned) log.warn('tabs.message.invalid'); // logged once, never the payload
        warned = true;
      };
      channel.addEventListener('message', onMessage);
      return () => channel.removeEventListener('message', onMessage);
    },
  };
}
