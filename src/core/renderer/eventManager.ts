import { IEventManager } from '../types/renderer/eventManager';

export class EventManager implements IEventManager {
  protected eventListeners: Map<string, Function[]> = new Map();

  constructor() {}

  getEventCollections(name: string) {
    return this.eventListeners.get(name) || null;
  }

  registerEvent(name: string) {
    const c = this.getEventCollections(name);
    if (c) {
      console.error(`Registered Event with the same name -- ${name}`);
      return this;
    }

    this.eventListeners.set(name, []);
    return this;
  }

  onEvent(name: string, callback: Function) {
    const c = this.getEventCollections(name);
    if (!c) {
      console.error(`Unregistered Event with name -- ${name}`);
      return this;
    }

    c.push(callback);
    return this;
  }

  emitEvent(name: string, payload?: Object | string | number | null) {
    const c = this.getEventCollections(name);
    if (!c) {
      console.error(`Unregistered Event with name -- ${name}`);
      return this;
    }

    c.forEach(f => {
      f({
        payload: (payload == null) ? null : payload,
      });
    });
    return this;
  }
};