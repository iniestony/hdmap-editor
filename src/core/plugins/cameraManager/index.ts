import {
  ArcRotateCamera
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import {
  AlterCameraVisualAngleEvent,
} from './constant';
import {
  OrbitCameraVisualAngle
} from './type';
export default class CameraManagerPlugin extends LogicalPlugin {
  constructor(options: PluginOptions) {
    super(options);
  }

  activate() {
    super.activate();

    this.init();
  }

  init() {
    this.initEvent();

  }

  initEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(AlterCameraVisualAngleEvent);
    scope.onEvent(AlterCameraVisualAngleEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { orbitCameraVisualAngle: OrbitCameraVisualAngle };
      scope.resolveCameraVisualAngle(payload.orbitCameraVisualAngle);
    });
  }
}