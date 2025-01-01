import {
  Engine,
  Scene,
  FreeCamera,
  FreeCameraMouseWheelInput,
  ArcRotateCamera,
  ArcRotateCameraPointersInput,
  ArcRotateCameraMouseWheelInput,
  HemisphericLight,
} from "@babylonjs/core";
import { EventManager } from './eventManager';
import { ISceneManager, CameraCategory } from '../types/renderer/sceneManager';
import RendererConfig from './config';

export const AlterCameraCategoryEvent = "scene_manager_alter_camera_category";

export class SceneManager implements ISceneManager {
  private eventManager: EventManager;

  private contextCanvas: HTMLCanvasElement;
  private contextEngine: Engine;
  private contextScene: Scene;

  private cameraCategory: CameraCategory;
  private orbitCamera?: ArcRotateCamera;
  private firstPersonCamera?: FreeCamera;

  private isDirty: boolean = false;
  private frameThreshold: number = 0;
  
  constructor(options: { canvas: string, eventManager: EventManager }) {
    this.eventManager = options.eventManager;

    this.contextCanvas = document.querySelector<any>(`#${options.canvas}`) as HTMLCanvasElement;
    
    this.contextEngine = new Engine(this.contextCanvas, true, {
      preserveDrawingBuffer: true,
      stencil: true, 
      disableWebGL2Support: false
    });
    
    this.contextScene = new Scene(this.contextEngine);
    this.contextScene.clearColor = RendererConfig.scene.clearColor;

    this.cameraCategory = CameraCategory.Orbit;

    this.renderExecFunc = this.renderExecFunc.bind(this);

    this.init();
  }

  getContextEngine() {
    return this.contextEngine;
  }
  
  getContextScene() {
    return this.contextScene;
  }

  getContextCanvas() {
    return this.contextCanvas;
  }

  getCameraCategory() {
    return this.cameraCategory;
  }

  dirty() {
    this.isDirty = true;
    this.frameThreshold = 0;

    if (!this.contextEngine.activeRenderLoops.length) {
      this.contextEngine.runRenderLoop(this.renderExecFunc);
    }
  }

  unDirty() {
    this.isDirty = false;
    this.contextEngine.stopRenderLoop(this.renderExecFunc);
  }

  init() {
    this.initLight();
    this.initCamera();

    window.addEventListener("resize", () => {
      this.contextEngine.resize();
    });
  }

  renderExecFunc() {
    if (!this.isDirty) return;

    if (this.contextScene.activeCamera) {
      this.contextScene.render();
      this.frameThreshold++;

      if (this.frameThreshold >= RendererConfig.scene.frameThreshold) {
        this.isDirty = false;
        this.contextEngine.stopRenderLoop(this.renderExecFunc);
      }
    } else {
      this.isDirty = false;
      this.contextEngine.stopRenderLoop(this.renderExecFunc);
    }
  }

  initLight() {
    new HemisphericLight("light", RendererConfig.scene.hemisphericLightAim, this.contextScene);
  }

  initCamera() {
    this.firstPersonCamera = this.initFirstPersonCamera();
    this.orbitCamera = this.initOrbitCamera();

    this.alterCamera(this.cameraCategory);

    this.eventManager.registerEvent(AlterCameraCategoryEvent);
    this.eventManager.onEvent(AlterCameraCategoryEvent, (params: { payload: Object | string | number | null }) => {
      const cameraCategory = (params.payload as { cameraCategory: CameraCategory }).cameraCategory;
      this.alterCamera(cameraCategory);
    });
  }

  initOrbitCamera() {
    const camera = new ArcRotateCamera(
      "HDMap_Orbit_Camera",
      RendererConfig.orbitCamera.longitude,
      RendererConfig.orbitCamera.latitude,
      RendererConfig.orbitCamera.radius,
      RendererConfig.orbitCamera.target,
      this.contextScene
    );

    camera.lowerAlphaLimit = RendererConfig.orbitCamera.lowerLongitude;
    camera.upperAlphaLimit = RendererConfig.orbitCamera.upperLongitude;
    camera.lowerBetaLimit = RendererConfig.orbitCamera.lowerLatitude;
    camera.upperBetaLimit = RendererConfig.orbitCamera.upperLatitude;
    camera.lowerRadiusLimit = RendererConfig.orbitCamera.lowerRadius;
    camera.upperRadiusLimit = RendererConfig.orbitCamera.upperRadius;

    camera.panningSensibility = RendererConfig.orbitCamera.panningSensibility;

    const pointersInput = camera.inputs.attached.pointers as ArcRotateCameraPointersInput;

    pointersInput.angularSensibilityX = RendererConfig.orbitCamera.angularSensibilityX;
    pointersInput.angularSensibilityY = RendererConfig.orbitCamera.angularSensibilityY;

    const mouseWheelInput = camera.inputs.attached.mousewheel as ArcRotateCameraMouseWheelInput;
    mouseWheelInput.wheelDeltaPercentage = RendererConfig.orbitCamera.wheelDeltaPercentage;
    
    camera.attachControl(false, false);

    return camera;
  }

  initFirstPersonCamera() {
    const camera = new FreeCamera("HDMap_FirstPerson_Camera", RendererConfig.firstPersonCamera.position, this.contextScene);
    camera.setTarget(RendererConfig.firstPersonCamera.target);
    camera.inputs.addMouseWheel();

    camera.invertRotation = true;
    camera.inverseRotationSpeed = RendererConfig.firstPersonCamera.inverseRotationSpeed;

    const mousewheelInput = camera.inputs.attached.mousewheel as FreeCameraMouseWheelInput;

    mousewheelInput.wheelPrecisionX = RendererConfig.firstPersonCamera.wheelPrecisionRate;
    mousewheelInput.wheelPrecisionY = RendererConfig.firstPersonCamera.wheelPrecisionRate;
    mousewheelInput.wheelPrecisionZ = RendererConfig.firstPersonCamera.wheelPrecisionRate;

    camera.attachControl(false);

    return camera;
  }

  alterCamera(cameraCategory: CameraCategory) {
    if (cameraCategory === CameraCategory.Orbit) {
      this.contextScene.activeCamera = (this.orbitCamera as ArcRotateCamera);
    } else if (cameraCategory === CameraCategory.FirstPerson) {
      this.contextScene.activeCamera = (this.firstPersonCamera as FreeCamera);
    }

    this.cameraCategory = cameraCategory;
  }
};