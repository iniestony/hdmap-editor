import { IPluginManager, IRawPlugin } from '../../types/plugins/raw';

export class PluginManager implements IPluginManager {
  protected plugins: Map<string, IRawPlugin> = new Map();

  constructor() {}

  getPlugin(name: string) {
    return this.plugins.get(name) || null;
  }

  registerPlugin(instance: IRawPlugin) {
    const p = this.getPlugin(instance.name);
    if (p) {
      console.error(`Registered plugin with the same name -- ${instance.name}`);
      return this;
    }

    this.plugins.set(instance.name, instance);
    return this;
  }

  activatePlugin(name: string) {
    const p = this.getPlugin(name);
    if (!p || p.activated) return;

    p.activate();
  }

  deactivatePlugin(name: string) {
    const p = this.getPlugin(name);
    if (!p || !p.activated) return;

    p.deactivate();
  }

  activateAllPlugins() {
    this.plugins.forEach(p => {
      if (!p.activated) p.activate();
    });
  }

  deactivateAllPlugins() {
    this.plugins.forEach(p => {
      if (p.activated) p.deactivate();
    });
  }

  listPlugins() {
    return this.plugins;
  }
};