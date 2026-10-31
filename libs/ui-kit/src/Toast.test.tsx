import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TOAST_TIMEOUT_MS, ToastProvider, useToast, type ToastInput } from './Toast';

function Trigger({ toast }: { toast: ToastInput }) {
  const show = useToast();
  return (
    <button type="button" onClick={() => show(toast)}>
      show
    </button>
  );
}

const showToast = (toast: ToastInput) => {
  render(
    <ToastProvider>
      <Trigger toast={toast} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'show' }));
};

describe('Toast timing (D3-02)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('TECH-6: a success toast closes after 5 s', () => {
    showToast({ tone: 'success', message: 'Tenant acme created.' });
    expect(screen.getByRole('status').textContent).toContain('Tenant acme created.');
    act(() => vi.advanceTimersByTime(TOAST_TIMEOUT_MS - 1));
    expect(screen.queryByText('Tenant acme created.')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Tenant acme created.')).toBeNull();
  });

  it('TECH-6: a toast stays while hovered and gets the full time again afterwards', () => {
    showToast({ tone: 'info', message: 'Bucket logs created.' });
    const toast = screen.getByText('Bucket logs created.').parentElement as HTMLElement;
    act(() => vi.advanceTimersByTime(4000));
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.queryByText('Bucket logs created.')).not.toBeNull();
    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(TOAST_TIMEOUT_MS));
    expect(screen.queryByText('Bucket logs created.')).toBeNull();
  });

  it('AC-SHL-3.2: an error toast is an alert and stays until dismissed', () => {
    showToast({ tone: 'error', message: "You don't have permission to do this." });
    expect(screen.getByRole('alert').textContent).toContain("You don't have permission to do this.");
    act(() => vi.advanceTimersByTime(10 * TOAST_TIMEOUT_MS));
    expect(screen.queryByText("You don't have permission to do this.")).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText("You don't have permission to do this.")).toBeNull();
  });
});
