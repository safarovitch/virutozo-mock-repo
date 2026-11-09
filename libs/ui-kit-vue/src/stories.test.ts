// Every Vue story renders (H6). Interaction stories (`play`) also run in Chromium via `storybook-test`.
import { afterEach, describe, expect, it } from 'vitest';
import type { Component } from 'vue';
import { cleanup, render } from '@testing-library/vue';
import { composeStories, setProjectAnnotations } from '@storybook/vue3-vite';
import preview from '../.storybook/preview';

setProjectAnnotations(preview);
afterEach(cleanup);

const modules = import.meta.glob<Record<string, unknown>>('./*.stories.ts', { eager: true });

describe('stories', () => {
  for (const [file, mod] of Object.entries(modules)) {
    const stories = composeStories(mod as Parameters<typeof composeStories>[0]);
    // The glob loses each module's story types; every composed story is a component without props.
    for (const [name, Story] of Object.entries(stories) as [string, Component][]) {
      it(`TECH-6: ${file.replace('./', '').replace('.stories.ts', '')} / ${name} renders`, () => {
        const { container } = render(Story);
        expect(container.firstElementChild).not.toBeNull();
      });
    }
  }
});
