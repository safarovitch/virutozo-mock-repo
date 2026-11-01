// @vitest-environment jsdom
// Every tenants story renders (H6: each state has a story), once each in jsdom.
import type { ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { composeStories, setProjectAnnotations } from '@storybook/react-vite';
import preview from '../.storybook/preview';
import { stubLayout } from './testing/layout';

setProjectAnnotations(preview);
const realFetch = globalThis.fetch;
beforeEach(() => stubLayout());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  globalThis.fetch = realFetch; // stories install their own fake API
});

const modules = import.meta.glob<Record<string, unknown>>('./*.stories.tsx', { eager: true });

describe('stories', () => {
  for (const [file, mod] of Object.entries(modules)) {
    const stories = composeStories(mod as Parameters<typeof composeStories>[0]);
    // The glob loses each module's story types; every composed story is a component without props.
    for (const [name, Story] of Object.entries(stories) as [string, ComponentType][]) {
      it(`TECH-6: ${file.replace('./', '').replace('.stories.tsx', '')} / ${name} renders`, () => {
        const { container } = render(<Story />);
        expect(container.firstChild).not.toBeNull();
      });
    }
  }
});
