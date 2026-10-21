import { Theme, ThemeService } from '@openuxkit/styled';
import Base from '@openvue/core/base';
import ButtonStyle from 'openvue/button/style';
import TooltipStyle from 'openvue/tooltip/style';

interface ThemeParts {
  css?: string;
  style?: string;
}

interface ThemedStyle {
  name: string;
  getLayerOrderThemeCSS(): string | undefined;
  load(css: string | undefined, options: { name: string; first?: boolean }): unknown;
  loadStyle(options: { name: string }, style: string | undefined): unknown;
  getComponentTheme(): ThemeParts | undefined;
  getDirectiveTheme(): ThemeParts | undefined;
}

export function setupOpenvueStyles(): void {
  const clearLoadedStyleNames = Base.clearLoadedStyleNames.bind(Base);
  // every openvue mount and directive update clears the names and so rewrites the base styles, only a theme change has to
  Base.clearLoadedStyleNames = () => {};
  ThemeService.on('theme:change', clearLoadedStyleNames);
  // our own button and tooltip mount no openvue component, so their theme styles load here
  ThemeService.on('theme:change', loadOwnThemes);
  loadOwnThemes();
}

function loadOwnThemes(): void {
  const button = ButtonStyle as unknown as ThemedStyle;
  const tooltip = TooltipStyle as unknown as ThemedStyle;
  loadTheme(button, button.getComponentTheme());
  loadTheme(tooltip, tooltip.getDirectiveTheme());
  if (!Theme.isStyleNameLoaded('layer-order')) {
    button.load(button.getLayerOrderThemeCSS(), { name: 'layer-order', first: true });
    Theme.setLoadedStyleName('layer-order');
  }
}

function loadTheme(style: ThemedStyle, parts: ThemeParts | undefined): void {
  if (Theme.isStyleNameLoaded(style.name)) return;
  style.load(parts?.css, { name: `${style.name}-variables` });
  style.loadStyle({ name: `${style.name}-style` }, parts?.style);
  Theme.setLoadedStyleName(style.name);
}
