// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Combobox, type ComboboxOption } from './Combobox';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const OPTIONS: ComboboxOption[] = [
  { id: 't_acme', label: 'Acme Corporation', description: 'acme' },
  { id: 't_beta', label: 'Beta Ltd', description: 'beta' },
];

function setup(props: Partial<Parameters<typeof Combobox>[0]> = {}) {
  const onSearch = vi.fn();
  const onSelect = vi.fn();
  render(<Combobox label="Tenant" emptyText="No tenants match." options={OPTIONS} onSearch={onSearch} onSelect={onSelect} {...props} />);
  return { onSearch, onSelect, input: screen.getByRole('combobox', { name: 'Tenant' }) };
}

describe('Combobox', () => {
  it('TECH-6: typing searches once after the debounce, with the trimmed text', () => {
    vi.useFakeTimers();
    const { input, onSearch } = setup();
    fireEvent.change(input, { target: { value: 'ac' } });
    fireEvent.change(input, { target: { value: 'acme ' } });
    act(() => vi.advanceTimersByTime(299));
    expect(onSearch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('acme');
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('TECH-6: arrow keys move the active option and Enter selects it; focus stays in the input', () => {
    const { input, onSelect } = setup();
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // opens
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const beta = screen.getByRole('option', { name: /Beta Ltd/ });
    expect(input.getAttribute('aria-activedescendant')).toBe(beta.id);
    expect(beta.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(OPTIONS[1]);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(input);
  });

  it('TECH-6: Escape closes the popup and shows the chosen value again', () => {
    const { input } = setup({ value: 'Acme Corporation' });
    fireEvent.change(input, { target: { value: 'be' } });
    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(false); // handled: default prevented
    expect((input as HTMLInputElement).value).toBe('Acme Corporation');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('TECH-6: a click on an option selects it', () => {
    const { input, onSelect } = setup();
    fireEvent.click(input);
    fireEvent.click(screen.getByRole('option', { name: /Acme Corporation/ }));
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[0]);
  });

  it('TECH-6: loading, error and no-results are announced in the popup', () => {
    const { input } = setup({ loading: true });
    fireEvent.click(input);
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    cleanup();
    fireEvent.click(setup({ error: 'Something failed.' }).input);
    expect(screen.getByRole('status').textContent).toBe('Something failed.');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    cleanup();
    fireEvent.click(setup({ options: [] }).input);
    expect(screen.getByRole('status').textContent).toBe('No tenants match.');
  });
});
