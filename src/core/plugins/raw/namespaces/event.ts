import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../renderer/config';

export function makeDebounce(this: ExtendedNamespace, f: Function, delay: number = 500) {
  const setTimeout = window.setTimeout;
  const clearTimeout = window.clearTimeout;

  let cancellable: number | undefined = undefined;
  
  return (...args: unknown[]) => {
    if (cancellable !== undefined) {
      clearTimeout(cancellable);
    }

    cancellable = setTimeout(() => {
      f.apply(this, args);
      cancellable = undefined;
    }, delay);
  };
};

export function makeAsync(this: ExtendedNamespace, f: Function) {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resolve(f());
    });
  });
};

export function nextTick(this: ExtendedNamespace, f: Function) {
  const requestIdleCallback = window.requestIdleCallback;

  const gapWaitingTimeout = RendererConfig.frame.nextTickGapWaitingTimeout;
  const gapFrames = RendererConfig.frame.nextTickGapFrames;
  let gapCount = 0;

  const execFunction : IdleRequestCallback = (ddl: IdleDeadline) => {
    if (ddl.timeRemaining() > 0 || ddl.didTimeout) {
      this.makeAsync(f);
    };
  };

  const hangFunction: IdleRequestCallback = (ddl: IdleDeadline) => {
    while(ddl.timeRemaining() > 0 && !ddl.didTimeout) {};
    gapCount++;

    if (gapCount >= gapFrames) {
      requestIdleCallback(execFunction, { timeout: gapWaitingTimeout });
    } else {
      requestIdleCallback(hangFunction, { timeout: gapWaitingTimeout });
    }
  };

  requestIdleCallback(hangFunction, { timeout: gapWaitingTimeout });
};

export function registerEvent(this: ExtendedNamespace, name: string) {
  this.getEventManager().registerEvent(name);
};

export function onEvent(this: ExtendedNamespace, name: string, callback: Function) {
  this.getEventManager().onEvent(name, callback);
};

export function emitEvent(this: ExtendedNamespace, name: string, payload?: Object | string | number | null) {
  this.getEventManager().emitEvent(name, payload);
};