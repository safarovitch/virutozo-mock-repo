// Compute's UI state (Pinia, one store per mount): the action waiting for confirmation, the tasks this
// mount started (their outcome toasts), and the polite live announcements (AC-CMP-1.4, D6-06).
// Server data stays in Vue Query.
import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { Vm, VmAction } from '@nimbus/api-client/model';
import { t } from './messages/en';

export const ANNOUNCE_WINDOW_MS = 1000;
const MAX_SENTENCES = 3;

export const useComputeUi = defineStore('compute-ui', () => {
  // ── Confirmation (D6-09, AC-CMP-4.3) ──
  const confirming = shallowRef<{ vm: Vm; action: VmAction } | null>(null);
  const askConfirm = (vm: Vm, action: VmAction) => {
    confirming.value = { vm, action };
  };
  const clearConfirm = () => {
    confirming.value = null;
  };

  // ── Tasks started here: compute shows their outcome toast while it is mounted (D6-10) ──
  const started = new Set<string>();
  const trackStarted = (taskId: string) => void started.add(taskId);
  /** True once per started task: the caller shows the toast. */
  const takeFinished = (taskId: string) => started.delete(taskId);

  // ── Announcements: the first at once, the rest of each second together (D6-06) ──
  const announcement = ref('');
  let queued: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const closeWindow = () => {
    timer = undefined;
    if (queued.length === 0) return;
    const more = queued.length - MAX_SENTENCES;
    const sentences = queued.slice(0, MAX_SENTENCES);
    if (more > 0) sentences.push(t('compute.moreStatusChanges', { count: more }));
    queued = [];
    announcement.value = sentences.join(' ');
    timer = setTimeout(closeWindow, ANNOUNCE_WINDOW_MS); // at most one announcement per second
  };

  function announce(sentence: string) {
    if (timer !== undefined) {
      queued.push(sentence);
      return;
    }
    announcement.value = sentence;
    timer = setTimeout(closeWindow, ANNOUNCE_WINDOW_MS);
  }

  /** RT-7: nothing fires after unmount. */
  function stop() {
    clearTimeout(timer);
    timer = undefined;
    queued = [];
    started.clear();
  }

  return { confirming, askConfirm, clearConfirm, trackStarted, takeFinished, announcement, announce, stop };
});
