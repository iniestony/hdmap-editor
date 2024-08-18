import {
  FreeCamera,
  FreeCameraInputsManager,
  FreeCameraMouseInput,
  FreeCameraMouseWheelInput,
  ArcRotateCamera,
  ArcRotateCameraInputsManager,
  ArcRotateCameraPointersInput,
  ArcRotateCameraMouseWheelInput,
  BoundingInfo,
  Vector3,
  Matrix,
} from "@babylonjs/core";
import {
  OrbitCameraVisualAngle
} from '../../cameraManager/type'

import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../renderer/config';

export function enableOrbitCameraRotateAndPan(this: ExtendedNamespace) {
  const contextScene = this.getSceneManager().getContextScene();
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  const inputs = activeCamera.inputs as ArcRotateCameraInputsManager;
  const pointersInput = inputs.attached.pointers as ArcRotateCameraPointersInput;

  pointersInput.angularSensibilityX = RendererConfig.orbitCamera.angularSensibilityX;
  pointersInput.angularSensibilityY = RendererConfig.orbitCamera.angularSensibilityY;
  activeCamera.panningSensibility = RendererConfig.orbitCamera.panningSensibility;
};

export function disableOrbitCameraRotateAndPan(this: ExtendedNamespace) {
  const contextScene = this.getSceneManager().getContextScene();
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  const inputs = activeCamera.inputs as ArcRotateCameraInputsManager;
  const pointersInput = inputs.attached.pointers as ArcRotateCameraPointersInput;

  pointersInput.angularSensibilityX = Infinity;
  pointersInput.angularSensibilityY = Infinity;
  activeCamera.panningSensibility = 0;
};

export function enableOrbitCameraRotate(this: ExtendedNamespace) {
  const contextScene = this.getSceneManager().getContextScene();
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  const inputs = activeCamera.inputs as ArcRotateCameraInputsManager;
  const pointersInput = inputs.attached.pointers as ArcRotateCameraPointersInput;
  pointersInput.angularSensibilityX = RendererConfig.orbitCamera.angularSensibilityX;
  pointersInput.angularSensibilityY = RendererConfig.orbitCamera.angularSensibilityY;
};

export function disableOrbitCameraRotate(this: ExtendedNamespace) {
  const contextScene = this.getSceneManager().getContextScene();
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  const inputs = activeCamera.inputs as ArcRotateCameraInputsManager;
  const pointersInput = inputs.attached.pointers as ArcRotateCameraPointersInput;

  pointersInput.angularSensibilityX = Infinity;
  pointersInput.angularSensibilityY = Infinity;
}

export function enableFirstPersonCameraRotateAndZoom(this: ExtendedNamespace) {
  const contextScene = this.getSceneManager().getContextScene();
  const activeCamera = contextScene.activeCamera as FreeCamera;

  const inputs = activeCamera.inputs as FreeCameraInputsManager;
  const mouseInput = inputs.attached.mouse as FreeCameraMouseInput;
  const mousewheelInput = inputs.attached.mousewheel as FreeCameraMouseWheelInput;

  mouseInput._allowCameraRotation = true;
  mousewheelInput.wheelPrecisionX = RendererConfig.firstPersonCamera.wheelPrecisionRate;
  mousewheelInput.wheelPrecisionY = RendererConfig.firstPersonCamera.wheelPrecisionRate;
  mousewheelInput.wheelPrecisionZ = RendererConfig.firstPersonCamera.wheelPrecisionRate;
};

export function disableFirstPersonCameraRotateAndZoom(this: ExtendedNamespace) {
  const contextScene = this.getSceneManager().getContextScene();
  const activeCamera = contextScene.activeCamera as FreeCamera;

  const inputs = activeCamera.inputs as FreeCameraInputsManager;
  const mouseInput = inputs.attached.mouse as FreeCameraMouseInput;
  const mousewheelInput = inputs.attached.mousewheel as FreeCameraMouseWheelInput;

  mouseInput._allowCameraRotation = false;
  mousewheelInput.wheelPrecisionX = 0;
  mousewheelInput.wheelPrecisionY = 0;
  mousewheelInput.wheelPrecisionZ = 0;
};

export function resolveCameraVisualAngle(this: ExtendedNamespace, orbitCameraVisualAngle: OrbitCameraVisualAngle) {
  const contextScene = this.getSceneManager().getContextScene();
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;
  switch (orbitCameraVisualAngle) {

    case OrbitCameraVisualAngle.BirdEyeView:
      activeCamera.beta = RendererConfig.orbitCamera.birdEyeCamera.beta;
      break;
    case OrbitCameraVisualAngle.DueNorthView:
      activeCamera.alpha = RendererConfig.orbitCamera.dueNorthView.alpha;
      break;
  };

  this.makeSceneDirty();
};

export function resolveOrbitCameraTargetInWorld(this: ExtendedNamespace) {
  const contextScene = this.getSceneManager().getContextScene();
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  return activeCamera.getTarget();
};

export function resolveOrbitCameraTargetInView(this: ExtendedNamespace) {
  const contextScene = this.getSceneManager().getContextScene();
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  const targetInWorld = this.resolveOrbitCameraTargetInWorld() as Vector3;

  const cameraWorldMatrix = activeCamera.getWorldMatrix();

  const targetInView = Vector3.TransformCoordinates(targetInWorld, cameraWorldMatrix.invert());

  return targetInView;
};