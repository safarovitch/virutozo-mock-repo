import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '@nimbus/messages';
import { Button } from './Button';

export interface WizardStep {
  id: string;
  title: string;
  content: ReactNode;
  /** Returns false to block Next (§8.2: "Next blocked on invalid step"); the step shows its own errors. */
  validate?: () => boolean;
}

export interface WizardProps {
  steps: readonly WizardStep[];
  /** Label of the last step's button, a verb naming the result, e.g. "Create tenant". */
  submitLabel: string;
  onSubmit: () => void;
  submitting?: boolean;
}

/** Steps with per-step validation; the caller makes the last step a review (§8.2). */
export function Wizard({ steps, submitLabel, onSubmit, submitting = false }: WizardProps) {
  const [index, setIndex] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const step = steps[index];
  const last = index === steps.length - 1;

  // Move focus to the new step's heading, so keyboard and screen-reader users land on it (not on first render).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [index]);

  if (!step) return null;
  const next = () => {
    if (step.validate && !step.validate()) return;
    if (last) onSubmit();
    else setIndex(index + 1);
  };

  return (
    <div className="nui-wizard">
      <ol className="nui-wizard__steps">
        {steps.map((s, i) => (
          <li key={s.id} aria-current={i === index ? 'step' : undefined}>
            {s.title}
          </li>
        ))}
      </ol>
      <section aria-labelledby={`${step.id}-title`}>
        <p className="nui-visually-hidden">{t('common.stepOf', { current: index + 1, total: steps.length })}</p>
        <h2 id={`${step.id}-title`} ref={heading} tabIndex={-1}>
          {step.title}
        </h2>
        {step.content}
      </section>
      <div className="nui-wizard__footer">
        <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          {t('common.back')}
        </Button>
        <Button variant="primary" loading={submitting} onClick={next}>
          {last ? submitLabel : t('common.next')}
        </Button>
      </div>
    </div>
  );
}
