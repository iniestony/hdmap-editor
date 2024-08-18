export interface PluginOptions {
  name: string,
  uiWrapperId?: string,
  hideOnInit?: boolean,
};

export interface IRawPlugin {
  name: string,
  activated: boolean,
  activate(): void,
  deactivate(): void,
};

export interface ExtendedNamespace {
  [key: string]: Function,
}

export interface IPluginManager {
  getPlugin(name: string): IRawPlugin | null,
  activatePlugin(name: string): void,
  deactivatePlugin(name: string): void,
  registerPlugin(instance: IRawPlugin): void,
};