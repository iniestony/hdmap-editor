import { ExtendedNamespace } from '../../../types/plugins/raw';
import getRenderer from '../../../renderer';

export function getRendererOptions() {
  const contextRenderer = getRenderer();

  return contextRenderer.getOptions();
};

export function getTransactionManager() {
  const contextRenderer = getRenderer();

  return contextRenderer.getTransactionManager();
};

export function getSceneManager() {
  const contextRenderer = getRenderer();

  return contextRenderer.getSceneManager();
};

export function getEventManager() {
  const contextRenderer = getRenderer();

  return contextRenderer.getEventManager();
};