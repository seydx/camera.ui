import { PrimeVueResolver } from '@openvue/auto-import-resolver';
import { resolve } from 'node:path';

import type { ComponentResolver } from 'unplugin-vue-components/types';

const CUI_BUTTON = resolve(__dirname, '..', 'src', 'components', 'CuiButton', 'CuiButton');

export function openvueResolvers(): ComponentResolver[] {
  return PrimeVueResolver().map((resolver) => {
    if (typeof resolver === 'function') return resolver;
    if (resolver.type === 'directive') {
      // v-tooltip resolves at runtime to the directive the app registers
      return { ...resolver, resolve: (name: string) => (name === 'Tooltip' ? undefined : resolver.resolve(name)) };
    }
    // <Button> renders our functional button, same markup without the openvue component cost
    return { ...resolver, resolve: (name: string) => (name === 'Button' ? { from: CUI_BUTTON } : resolver.resolve(name)) };
  });
}
