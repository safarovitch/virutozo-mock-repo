// NFR-PERF-5: while scrolling 10,000 tenants, the median of 3 throttled runs (Chromium, 4× CPU) has no
// long task over 50 ms. A target, not an AC: this measures and reports (test-results/perf/), never fails.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { signIn } from '../src/support';

const RUNS = 3;
const TARGET_MS = 50;
const OUT = fileURLToPath(new URL('../../../test-results/perf/', import.meta.url));

declare global {
  interface Window {
    __longTasks: number[];
  }
}

/** Scrolls the table to the end until every tenant is loaded; returns the long tasks seen meanwhile. */
async function scrollAll(page: Page): Promise<number[]> {
  const table = page.getByRole('table', { name: 'Tenants' });
  const count = page.getByText(/^Showing [\d,]+ of 10,000 tenants$/);
  await expect(count).toHaveText('Showing 100 of 10,000 tenants');
  await page.evaluate(() => (window.__longTasks = []));
  for (;;) {
    const before = (await count.textContent()) ?? '';
    if (before === 'Showing 10,000 of 10,000 tenants') break;
    await table.evaluate((el) => {
      const scroller = el.parentElement as HTMLElement;
      scroller.scrollBy({ top: scroller.scrollHeight }); // to the end; the next page loads there
    });
    await expect(count).not.toHaveText(before, { timeout: 30_000 });
  }
  // A few full-height jumps back up, to render rows that are already loaded.
  for (let i = 0; i < 20; i++) await table.evaluate((el) => (el.parentElement as HTMLElement).scrollBy({ top: -5_000 }));
  return page.evaluate(() => window.__longTasks);
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

test('NFR-PERF-5: long tasks while scrolling 10,000 tenants (median of 3 runs, 4× CPU throttling)', async ({ page }) => {
  await page.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  });
  await signIn(page, 'provider_admin');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const runs: { longest: number; over50: number; count: number }[] = [];
  for (let run = 0; run < RUNS; run++) {
    await page.goto('/tenants');
    const tasks = await scrollAll(page);
    runs.push({ longest: Math.round(Math.max(0, ...tasks)), over50: tasks.filter((d) => d > TARGET_MS).length, count: tasks.length });
  }

  // Instrument check: a planted 120 ms page task must be recorded, or the numbers above prove nothing.
  // (Code run by page.evaluate itself isn't a page task, so the busy loop is scheduled with setTimeout.)
  await page.evaluate(() => {
    window.__longTasks = [];
    setTimeout(() => {
      const start = performance.now();
      while (performance.now() - start < 120);
    }, 0);
  });
  await expect.poll(() => page.evaluate(() => window.__longTasks.length), { timeout: 5_000 }).toBeGreaterThan(0).catch(() => undefined);
  const instrumentOk = (await page.evaluate(() => window.__longTasks.length)) > 0;

  const result = {
    instrumentOk,
    target: `no long task over ${TARGET_MS} ms (median of ${RUNS} runs)`,
    medianLongestMs: median(runs.map((r) => r.longest)),
    medianOver50: median(runs.map((r) => r.over50)),
    met: instrumentOk && median(runs.map((r) => r.over50)) === 0,
    runs,
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(result, null, 2));
  writeFileSync(
    path.join(OUT, 'perf.md'),
    [
      '## Perf (NFR-PERF-5, non-blocking)',
      '',
      `Scrolling 10,000 tenants, Chromium, 4× CPU throttling, median of ${RUNS} runs: longest task **${result.medianLongestMs} ms**, tasks over ${TARGET_MS} ms: **${result.medianOver50}** → ${!instrumentOk ? '⚠️ no result: the long-task instrument check failed' : result.met ? '✅ target met' : '⚠️ target missed'}.`,
      '',
      `Instrument check (a planted 120 ms task is recorded): ${instrumentOk ? 'ok' : 'FAILED'}.`,
      '',
      '| Run | Longest task (ms) | Tasks > 50 ms | Long tasks |',
      '|---|---|---|---|',
      ...runs.map((r, i) => `| ${i + 1} | ${r.longest} | ${r.over50} | ${r.count} |`),
    ].join('\n'),
  );
  test.info().annotations.push({ type: 'NFR-PERF-5', description: JSON.stringify(result) });
  console.log(`[perf] ${JSON.stringify(result)}`);
});
