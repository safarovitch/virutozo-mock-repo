// jsdom has no layout. TanStack Virtual sizes its viewport from clientHeight/clientWidth, so give every
// element a size; the virtualised table then renders the rows a 600 px viewport would show.
import { vi } from 'vitest';

export function stubLayout(height = 600, width = 1000): void {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
}
