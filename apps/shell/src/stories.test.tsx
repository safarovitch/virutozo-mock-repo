// @vitest-environment jsdom
// Every shell story renders (H6: each state has a story), once each in jsdom.
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { composeStories, setProjectAnnotations } from '@storybook/react-vite';
import preview from '../.storybook/preview';

setProjectAnnotations(preview);
afterEach(cleanup);

const modules = import.meta.glob<Record<string, unknown>>('./*.stories.tsx', { eager: true });

describe('stories', () => {
  for (const [file, mod] of Object.entries(modules)) {
    const stories = composeStories(mod as Parameters<typeof composeStories>[0]);
    // The glob loses each module's story types; every composed story is a component without props.
    for (const [name, Story] of Object.entries(stories) as [string, ComponentType][]) {
      it(`TECH-4: ${file.replace('./', '').replace('.stories.tsx', '')} / ${name} renders`, () => {
        const { container } = render(<Story />);
        expect(container.firstChild).not.toBeNull();
      });
    }
  }
});
