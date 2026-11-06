// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmDialog, Dialog } from './Dialog';
import { Wizard, type WizardStep } from './Wizard';

afterEach(cleanup);

const steps: WizardStep[] = [
  { id: 'one', title: 'One', content: <p>first</p> },
  { id: 'two', title: 'Two', content: <p>second</p> },
  { id: 'three', title: 'Three', content: <button type="button">jump</button> },
];

describe('Wizard', () => {
  it('TECH-6: uncontrolled, Next and Back move between steps', async () => {
    render(<Wizard steps={steps} submitLabel="Create" onSubmit={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Two' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'One' })).toBeTruthy();
  });

  it('TECH-6: controlled, the owner moves the step and focus goes to its heading', async () => {
    function Controlled() {
      const [step, setStep] = useState(2);
      return <Wizard steps={steps.map((s) => (s.id === 'three' ? { ...s, content: <button type="button" onClick={() => setStep(0)}>jump</button> } : s))} step={step} onStepChange={setStep} submitLabel="Create" onSubmit={() => undefined} />;
    }
    render(<Controlled />);
    expect(screen.getByRole('heading', { name: 'Three' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'jump' }));
    expect(screen.getByRole('heading', { name: 'One' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'One' }));
  });
});

describe('Dialog', () => {
  it('TECH-6: Escape in a dialog opened over another closes only the top one', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <>
        <Dialog open onClose={outer} title="Outer">
          <ConfirmDialog open title="Inner" confirmLabel="OK" onConfirm={() => undefined} onCancel={inner}>
            {null}
          </ConfirmDialog>
        </Dialog>
      </>,
    );
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Inner' }), { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });
});
