import type { Preview } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import '@nimbus/design-tokens';
import '@nimbus/design-tokens/components.css';
import '../src/shell.css';

const preview: Preview = {
  parameters: { layout: 'padded' },
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
};
export default preview;
