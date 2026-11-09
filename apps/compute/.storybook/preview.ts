import type { Preview } from '@storybook/vue3-vite';
import '@nimbus/design-tokens';
import '@nimbus/design-tokens/components.css';
import '../src/compute.css';

const preview: Preview = { parameters: { layout: 'padded' } };
export default preview;
