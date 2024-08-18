import { RendererOptions } from '../types/renderer';
import { PluginManager } from '../plugins/raw/manager';
import { EventManager } from './eventManager';
import { SceneManager } from './sceneManager';
import { TransactionManager } from './transactionManager';

export class Renderer {
  private options: RendererOptions;
 
  private pluginManager: PluginManager;
  private eventManager: EventManager;
  private sceneManager: SceneManager;
  private transactionManager: TransactionManager;

  constructor(options: RendererOptions) {
    this.options = options;

    this.pluginManager = new PluginManager();
    this.eventManager = new EventManager();
    this.sceneManager = new SceneManager({ canvas: this.options.canvas, eventManager: this.eventManager });
    this.transactionManager = new TransactionManager({ eventManager: this.eventManager });
  }

  getOptions() {
    return this.options;
  }

  getPluginManager() {
    return this.pluginManager;
  }

  getEventManager() {
    return this.eventManager;
  }

  getSceneManager() {
    return this.sceneManager;
  }

  getTransactionManager() {
    return this.transactionManager;
  }
}

let _renderer: Renderer | null = null;

export default function getRenderer(options?: RendererOptions) {
  if (!_renderer && options) {
    _renderer = new Renderer(options);
    (window as unknown as { hdmapRenderer: Renderer }).hdmapRenderer = _renderer;
  }
  return _renderer as Renderer;
};