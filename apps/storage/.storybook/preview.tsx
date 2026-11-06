import type { Preview } from '@storybook/react-vite';
import '@nimbus/design-tokens';
import '@nimbus/design-tokens/components.css';
import '../src/storage.css';

const preview: Preview = { parameters: { layout: 'padded' } };
export default preview;
