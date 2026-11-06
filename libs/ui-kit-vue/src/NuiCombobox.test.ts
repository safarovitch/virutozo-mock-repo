import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/vue';
import Combobox from './NuiCombobox.vue';
import type { ComboboxOption } from './types';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const OPTIONS: ComboboxOption[] = [
  { id: 't_acme', label: 'Acme Corporation', description: 'acme' },
  { id: 't_beta', label: 'Beta Ltd', description: 'beta', badge: { tone: 'warning', label: 'Suspended' } },
];

function setup(props: Record<string, unknown> = {}) {
  const result = render(Combobox, { props: { label: 'Tenant', emptyText: 'No tenants match.', options: OPTIONS, ...props } });
  return { ...result, input: screen.getByRole('combobox', { name: 'Tenant' }) };
}

describe('NuiCombobox', () => {
  it('TECH-6: typing searches once after the debounce, with the trimmed text', async () => {
    vi.useFakeTimers();
    const { input, emitted } = setup();
    await fireEvent.update(input, 'ac');
    await fireEvent.update(input, 'acme ');
    vi.advanceTimersByTime(299);
    expect(emitted().search).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(emitted().search).toEqual([['acme']]);
  });

  it('TECH-6: arrow keys move the active option and Enter selects it', async () => {
    const { input, emitted } = setup();
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    const beta = screen.getByRole('option', { name: /Beta Ltd/ });
    expect(input.getAttribute('aria-activedescendant')).toBe(beta.id);
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(emitted().select).toEqual([[OPTIONS[1]]]);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('TECH-6: Escape closes the popup and shows the chosen value again', async () => {
    const { input } = setup({ value: 'Acme Corporation' });
    await fireEvent.update(input, 'be');
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect((input as HTMLInputElement).value).toBe('Acme Corporation');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('TECH-6: loading, error and no-results are announced in the popup', async () => {
    const loading = setup({ loading: true });
    await fireEvent.click(loading.input);
    expect(screen.getByRole('status').textContent?.trim()).toBe('Loading…');
    cleanup();
    await fireEvent.click(setup({ error: 'Something failed.' }).input);
    expect(screen.getByRole('status').textContent?.trim()).toBe('Something failed.');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    cleanup();
    await fireEvent.click(setup({ options: [] }).input);
    expect(screen.getByRole('status').textContent?.trim()).toBe('No tenants match.');
  });
});
