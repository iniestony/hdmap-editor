import { LogicalPlugin } from './logical';
import { PluginOptions, ExtendedNamespace } from '../../types/plugins/raw';

export class UIPlugin extends LogicalPlugin {
  uiWrapperId: string;
  hideOnInit: boolean;

  constructor(options: PluginOptions) {
    super(options);

    this.uiWrapperId = options.uiWrapperId || '';
    this.hideOnInit = !!options.hideOnInit;
  }

  activate() {
    super.activate();

    this.generateUIWrapper();
  }

  generateUIWrapper() {
    if (!this.uiWrapperId) return;

    const uiElement = document.createElement('div');
    uiElement.id = this.uiWrapperId;
    uiElement.style.display = this.hideOnInit ? 'none' : 'block';

    const scope = this as unknown as ExtendedNamespace;
    (document.querySelector(`#${scope.getRendererOptions().house}`) as HTMLElement).appendChild(uiElement);

    const toggleUIEvent = `UI_Plugin_Toggle_Wrapper_${this.uiWrapperId}`;
    scope.registerEvent(toggleUIEvent);
    scope.onEvent(toggleUIEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as number;
      const uiElement = scope.queryMountedPosition();

      if (payload === 1) {
        uiElement.style.display = 'block';
      } else {
        uiElement.style.display = 'none';
      }
    });
  }

  queryMountedPosition() {
    return document.querySelector(`#${this.uiWrapperId}`);
  }
};