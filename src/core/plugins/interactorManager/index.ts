import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import { AlterInteractionModeEvent } from './constant';
import { InteractionMode } from './type';
import { AlterMouseInteractionModeEvent } from '../mouseInteractor/constant';
import { MouseInteractionMode } from '../mouseInteractor/type';
import { CameraCategory } from '../../types/renderer/sceneManager';

export default class InteractorManagerPlugin extends LogicalPlugin {
  private interactionMode: InteractionMode;

  constructor(options: PluginOptions) {
    super(options);

    this.interactionMode = InteractionMode.Roam;
  }

  activate() {
    super.activate();

    this.init();
  }

  getInteractionMode() {
    return this.interactionMode;
  }

  init() {
    this.initEvent();
  }

  initEvent() {
    const scope = this as unknown as ExtendedNamespace;

    this.adaptRelativeElements();

    scope.registerEvent(AlterInteractionModeEvent);
    scope.onEvent(AlterInteractionModeEvent, (params: { payload: Object | string | number | null }) => {
      this.interactionMode = params.payload as InteractionMode;
      this.adaptRelativeElements();
    });
  }

  adaptRelativeElements() {
    this.adaptCameraInputs();
    this.adaptInteractors();
  }

  adaptCameraInputs() {
    const scope = this as unknown as (ExtendedNamespace & InteractorManagerPlugin);
    const cameraCategory = scope.getSceneCameraCategory();

    if (cameraCategory === CameraCategory.Orbit) {
      this.adaptOrbitCameraInputs();
    } else if (cameraCategory === CameraCategory.FirstPerson) {
      this.adaptFirstPersonCameraInputs();
    }
  }

  adaptOrbitCameraInputs() {
    const scope = this as unknown as (ExtendedNamespace & InteractorManagerPlugin);

    switch (scope.interactionMode) {
      case InteractionMode.Roam:
        scope.enableOrbitCameraRotateAndPan();
        break;
      case InteractionMode.DrawTwoStraightLine:
      case InteractionMode.DrawThreeCircleCurve:
      case InteractionMode.DrawQuadraticBezierCurve:
      case InteractionMode.DrawCubicBezierCurve:
      case InteractionMode.DrawTwoStraightLineRoad:
      case InteractionMode.DrawThreeCircleCurveRoad:
      case InteractionMode.DrawQuadraticBezierCurveRoad:
      case InteractionMode.DrawCubicBezierCurveRoad:
      case InteractionMode.DrawCatmullSerieRoad:
        break;
      case InteractionMode.EditRoad:
        break;
      case InteractionMode.EditRoadLane:
        break;
      case InteractionMode.DrawConnectionRoad:
        break;
      case InteractionMode.EditConnectionRoad:
        break;
      case InteractionMode.EditRoadConnectionLane:
        break;
      case InteractionMode.DrawJunction:
        break;
      case InteractionMode.EditJunction:
        break;
      case InteractionMode.DrawPointAlign:
        break;
      case InteractionMode.DrawSegmentAlign:
        break;
      case InteractionMode.DrawTrafficLights:
        break;
      case InteractionMode.EditTrafficLights:
        break;  
      default:
        scope.enableOrbitCameraRotateAndPan();
    }
  }

  adaptFirstPersonCameraInputs() {
    const scope = this as unknown as (ExtendedNamespace & InteractorManagerPlugin);

    switch (scope.interactionMode) {
      case InteractionMode.Roam:
        scope.enableFirstPersonCameraRotateAndZoom();
        break;
      case InteractionMode.DrawTwoStraightLine:
      case InteractionMode.DrawThreeCircleCurve:
      case InteractionMode.DrawQuadraticBezierCurve:
      case InteractionMode.DrawCubicBezierCurve:
      case InteractionMode.DrawTwoStraightLineRoad:
      case InteractionMode.DrawThreeCircleCurveRoad:
      case InteractionMode.DrawQuadraticBezierCurveRoad:
      case InteractionMode.DrawCubicBezierCurveRoad:
      case InteractionMode.DrawCatmullSerieRoad:
        scope.disableFirstPersonCameraRotateAndZoom();
        break;
      case InteractionMode.EditRoad:
        scope.disableFirstPersonCameraRotateAndZoom();
        break;
      case InteractionMode.EditRoadLane:
        scope.disableFirstPersonCameraRotateAndZoom();
        break;
      case InteractionMode.DrawConnectionRoad:
        scope.disableFirstPersonCameraRotateAndZoom();
        break;
      case InteractionMode.EditConnectionRoad:
        scope.disableFirstPersonCameraRotateAndZoom();
        break;
      case InteractionMode.EditRoadConnectionLane:
        scope.disableFirstPersonCameraRotateAndZoom();
        break;
      case InteractionMode.DrawJunction:
        scope.disableFirstPersonCameraRotateAndZoom();
        break;
      case InteractionMode.EditJunction:
        scope.disableFirstPersonCameraRotateAndZoom();
        break;
      case InteractionMode.DrawPointAlign:
        scope.disableFirstPersonCameraRotateAndZoom();
        break;
      case InteractionMode.DrawSegmentAlign:
        scope.disableFirstPersonCameraRotateAndZoom();
        break;
      case InteractionMode.DrawTrafficLights:
        scope.disableFirstPersonCameraRotateAndZoom();
        break;
      case InteractionMode.EditTrafficLights:
        scope.disableFirstPersonCameraRotateAndZoom();
        break;    
      default:
        scope.enableFirstPersonCameraRotateAndZoom();
    }
  }

  adaptInteractors() {
    const scope = this as unknown as (ExtendedNamespace & InteractorManagerPlugin);

    switch (scope.interactionMode) {
      case InteractionMode.Roam:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.Roam);
        break;
      case InteractionMode.DrawTwoStraightLine:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawTwoStraightLine);
        break;
      case InteractionMode.DrawThreeCircleCurve:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawThreeCircleCurve);
        break;
      case InteractionMode.DrawQuadraticBezierCurve:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawQuadraticBezierCurve);
        break;
      case InteractionMode.DrawCubicBezierCurve:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawCubicBezierCurve);
        break;
      case InteractionMode.DrawTwoStraightLineRoad:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawTwoStraightLineRoad);
        break;
      case InteractionMode.DrawThreeCircleCurveRoad:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawThreeCircleCurveRoad);
        break;
      case InteractionMode.DrawQuadraticBezierCurveRoad:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawQuadraticBezierCurveRoad);
        break;
      case InteractionMode.DrawCubicBezierCurveRoad:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawCubicBezierCurveRoad);
        break;
      case InteractionMode.DrawCatmullSerieRoad:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawCatmullSerieRoad);
        break;
      case InteractionMode.EditRoad:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.EditRoad);
        break;
      case InteractionMode.EditRoadLane:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.EditRoadLane);
        break;
      case InteractionMode.DrawConnectionRoad:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawConnectionRoad);
        break;
      case InteractionMode.EditConnectionRoad:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.EditConnectionRoad);
        break;
      case InteractionMode.EditRoadConnectionLane:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.EditRoadConnectionLane);
        break;
      case InteractionMode.DrawJunction:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawJunction);
        break;
      case InteractionMode.EditJunction:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.EditJunction);
        break;
      case InteractionMode.DrawPointAlign:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawPointAlign);
        break;
      case InteractionMode.DrawSegmentAlign:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawSegmentAlign);
        break;
      case InteractionMode.DrawTrafficLights:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.DrawTrafficLights);
        break; 
      case InteractionMode.EditTrafficLights:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.EditTrafficLights);
        break;    
      default:
        scope.emitEvent(AlterMouseInteractionModeEvent, MouseInteractionMode.Roam);
    }
  }
};