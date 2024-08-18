import { ExtendedNamespace } from '../../../types/plugins/raw';
import { DisposeLineAndCurveMarkerEvent, DisposeRoadMarkerEvent } from '../../../../core/plugins/statusManager/constant';
import { DisposeLineAndCurveMarkerOpt, DisposeRoadMarkerOpt } from '../../../../core/plugins/statusManager/type';
import { AlterInteractionModeEvent } from '../../../../core/plugins/interactorManager/constant';
import { InteractionMode } from '../../../../core/plugins/interactorManager/type';
import {
  RoadItem,
  RoadCategory,
  LaneItem,
  JunctionItem,
  SignalItem,
} from '../../../../core/plugins/statusManager/type';
import {
  SegmentAlignPointItem,
  SegmentAlignItem,
  SegmentAlignPointItemKeyInfo,
  SegmentAlignItemKeyInfo,
} from '../../../../core/plugins/segmentAlignDrawer/type';
import {
  PointAlignItem,
  PointAlignItemKeyInfo
} from '../../../../core/plugins/pointAlignDrawer/type';
import {
  EnterEditingRoadItemEvent,
  ExitEditingRoadItemEvent,
} from '../../../../core/plugins/roadEditor/constant';
import {
  EnterEditingRoadLaneItemEvent,
  ExitEditingRoadLaneItemEvent,
} from '../../../../core/plugins/roadLaneEditor/constant';
import {
  EnterEditingRoadConnectionLaneItemEvent,
  ExitEditingRoadConnectionLaneItemEvent,
} from '../../../../core/plugins/roadConnectionLaneEditor/constant';
import {
  EnterPickingRoadVertexEvent,
  ExitPickingRoadVertexEvent,
  CleanPickedRoadVertexEvent,
} from '../../../../core/plugins/roadConnectionDrawer/constant';
import {
  EnterEditingRoadConnectionItemEvent,
  ExitEditingRoadConnectionItemEvent,
  CleanNewLanePrevAndNextConnectionLaneVertexEvent,
} from '../../../../core/plugins/roadConnectionEditor/constant';
import {
  CleanPickedPrevAndNextConnectionLaneVertexEvent
} from '../../../../core/plugins/roadConnectionLaneEditor/constant'
import {
  EnterPickingJunctionVertexEvent,
  ExitPickingJunctionVertexEvent,
  CleanPickedJunctionVertexEvent,
  ConfirmPickedJunctionVertexEvent,
} from '../../../../core/plugins/junctionDrawer/constant';
import {
  EnterEditingJunctionItemEvent,
  ExitEditingJunctionItemEvent,
  CleanNewRoadPrevAndNextConnectionRoadVertexEvent,
} from '../../../../core/plugins/junctionEditor/constant';
import {
  EnterEditingPointAlignItemListEvent,
} from '../../../../core/plugins/pointAlignDrawer/constant';
import {
  EnterEditingSegmentAlignItemListEvent,
} from '../../../../core/plugins/segmentAlignDrawer/constant';
import {
  EnterEditingSignalItemEvent,
  ExitEditingSignalItemEvent,
} from '../../../../core/plugins/signalEditor/constant';
import {
  RoadPropertyPanelConfig,
  RoadLanePropertyPanelConfig,
  RoadConnectionPropertyPanelConfig,
  RoadConnectionLanePropertyPanelConfig,
  JunctionPropertyPanelConfig,
  SignalPropertyPanelConfig,
} from '../../../../business/constant';

export function onBeforeRenderFrame(this: ExtendedNamespace, cb: Function) {
  this.getSceneManager().getContextScene().onBeforeRenderObservable.add(cb);
};

export function onAfterRenderFrame(this: ExtendedNamespace, cb: Function) {
  this.getSceneManager().getContextScene().onAfterRenderObservable.add(cb);
};

export function makeSceneDirty(this: ExtendedNamespace) {
  this.getSceneManager().dirty();
};

export function makeSceneUnDirty(this: ExtendedNamespace) {
  this.getSceneManager().unDirty();
};

export function getSceneCameraCategory(this: ExtendedNamespace) {
  return this.getSceneManager().getCameraCategory();
};

export function toggleUIWrapper(this: ExtendedNamespace, wrapperId: string, show: number) {
  const toggleUIEvent = `UI_Plugin_Toggle_Wrapper_${wrapperId}`;
  this.emitEvent(toggleUIEvent, show);
};

export function toggleUIBySelector(this: ExtendedNamespace, selector: string, show: number) {
  const elem = document.querySelector(selector);
  if (!elem) return;

  if (show === 1) {
    (elem as HTMLElement).style.display = 'block';
  } else {
    (elem as HTMLElement).style.display = 'none';
  }
};

export function disposeAllMarkers(this: ExtendedNamespace) {
  this.emitEvent(DisposeLineAndCurveMarkerEvent, {
    twoStraightLinePerm: true,
    twoStraightLineTemp: true,
    threeCircleCurvePerm: true,
    threeCircleCurveTemp: true,
    quadraticBezierCurvePerm: true,
    quadraticBezierCurveTemp: true,
    cubicBezierCurvePerm: true,
    cubicBezierCurveTemp: true,
  } as DisposeLineAndCurveMarkerOpt);

  this.emitEvent(DisposeRoadMarkerEvent, {
    twoStraightLineRoadPerm: true,
    twoStraightLineRoadTemp: true,
    threeCircleCurveRoadPerm: true,
    threeCircleCurveRoadTemp: true,
    quadraticBezierCurveRoadPerm: true,
    quadraticBezierCurveRoadTemp: true,
    cubicBezierCurveRoadPerm: true,
    cubicBezierCurveRoadTemp: true,
    catmullSerieRoadPerm: true,
    catmullSerieRoadTemp: true,
  } as DisposeRoadMarkerOpt);
};

export function disposeAllDrawers(this: ExtendedNamespace) {
  this.disposeAllMarkers();

  this.emitEvent(ExitPickingRoadVertexEvent);

  this.emitEvent(ExitPickingJunctionVertexEvent);
};

export function enterEditRoad(this: ExtendedNamespace, roadItem: RoadItem) {
  this.disposeAllDrawers();

  this.emitEvent(AlterInteractionModeEvent, InteractionMode.EditRoad);

  this.toggleUIWrapper(RoadPropertyPanelConfig.uiWrapperId, 1);
  this.toggleUIBySelector('#road_altitude_canvas', 1);

  this.emitEvent(EnterEditingRoadItemEvent, { roadItem });
};

export function exitEditRoad(this: ExtendedNamespace) {
  this.emitEvent(AlterInteractionModeEvent, InteractionMode.Roam);

  this.toggleUIWrapper(RoadPropertyPanelConfig.uiWrapperId, 0);
  this.toggleUIBySelector('#road_altitude_canvas', 0);

  this.emitEvent(ExitEditingRoadItemEvent);
};

export function enterEditRoadLane(this: ExtendedNamespace, roadItem: RoadItem, laneItem: LaneItem) {
  this.disposeAllDrawers();

  this.emitEvent(AlterInteractionModeEvent, InteractionMode.EditRoadLane);

  this.toggleUIWrapper(RoadLanePropertyPanelConfig.uiWrapperId, 1);
  this.toggleUIBySelector('#road_lane_altitude_canvas', 1);

  this.emitEvent(EnterEditingRoadLaneItemEvent, { roadItem, laneItem });
};

export function exitEditRoadLane(this: ExtendedNamespace) {
  this.emitEvent(AlterInteractionModeEvent, InteractionMode.Roam);

  this.toggleUIWrapper(RoadLanePropertyPanelConfig.uiWrapperId, 0);
  this.toggleUIBySelector('#road_lane_altitude_canvas', 0);

  this.emitEvent(ExitEditingRoadLaneItemEvent);
};

export function enterDrawRoadConnection(this: ExtendedNamespace) {
  this.emitEvent(AlterInteractionModeEvent, InteractionMode.DrawConnectionRoad);

  this.emitEvent(EnterPickingRoadVertexEvent);
};

export function exitDrawRoadConnection(this: ExtendedNamespace) {
  this.emitEvent(AlterInteractionModeEvent, InteractionMode.Roam);

  this.emitEvent(ExitPickingRoadVertexEvent);
};

export function cleanPickedRoadVertices(this: ExtendedNamespace) {
  this.emitEvent(CleanPickedRoadVertexEvent);
};

export function enterEditRoadConnection(this: ExtendedNamespace, roadItem: RoadItem) {
  this.disposeAllDrawers();

  this.emitEvent(AlterInteractionModeEvent, InteractionMode.EditConnectionRoad);

  this.toggleUIWrapper(RoadConnectionPropertyPanelConfig.uiWrapperId, 1);
  this.toggleUIBySelector('#plugin-road-connection-property-panel-canvas-wrapper', !roadItem.junctionId ? 1 : 0)
  this.toggleUIBySelector('#road_connection_altitude_canvas', !roadItem.junctionId ? 1 : 0);

  this.emitEvent(EnterEditingRoadConnectionItemEvent, { roadItem });
};

export function exitEditRoadConnection(this: ExtendedNamespace) {
  this.emitEvent(AlterInteractionModeEvent, InteractionMode.Roam);

  this.toggleUIWrapper(RoadConnectionPropertyPanelConfig.uiWrapperId, 0);
  this.toggleUIBySelector('#plugin-road-connection-property-panel-canvas-wrapper', 0);
  this.toggleUIBySelector('#road_connection_altitude_canvas', 0);

  this.emitEvent(ExitEditingRoadConnectionItemEvent);
};

export function cleanPickedPrevAndNextConnectionLaneVertices(this: ExtendedNamespace) {
  this.emitEvent(CleanPickedPrevAndNextConnectionLaneVertexEvent);
};

export function cleanNewLanePrevAndNextConnectionLaneVertices(this: ExtendedNamespace) {
  this.emitEvent(CleanNewLanePrevAndNextConnectionLaneVertexEvent);
};

export function enterEditRoadConnectionLane(this: ExtendedNamespace, roadItem: RoadItem, laneItem: LaneItem) {
  this.disposeAllDrawers();

  this.emitEvent(AlterInteractionModeEvent, InteractionMode.EditRoadConnectionLane);

  this.toggleUIWrapper(RoadConnectionLanePropertyPanelConfig.uiWrapperId, 1);
  this.toggleUIBySelector('#plugin-road-connection-lane-property-panel-canvas-wrapper', !roadItem.junctionId ? 1 : 0)
  this.toggleUIBySelector('#road_connection_lane_altitude_canvas', !roadItem.junctionId ? 1 : 0);

  this.emitEvent(EnterEditingRoadConnectionLaneItemEvent, { roadItem, laneItem });
};

export function exitEditRoadConnectionLane(this: ExtendedNamespace) {
  this.emitEvent(AlterInteractionModeEvent, InteractionMode.Roam);

  this.toggleUIWrapper(RoadConnectionLanePropertyPanelConfig.uiWrapperId, 0);
  this.toggleUIBySelector('#plugin-road-connection-lane-property-panel-canvas-wrapper', 0);
  this.toggleUIBySelector('#road_connection_lane_altitude_canvas', 0);

  this.emitEvent(ExitEditingRoadConnectionLaneItemEvent);
};

export function enterDrawJunction(this: ExtendedNamespace) {
  this.emitEvent(AlterInteractionModeEvent, InteractionMode.DrawJunction);

  this.emitEvent(EnterPickingJunctionVertexEvent);
};

export function exitDrawJunction(this: ExtendedNamespace) {
  this.emitEvent(AlterInteractionModeEvent, InteractionMode.Roam);

  this.emitEvent(ExitPickingJunctionVertexEvent);
};

export function cleanPickedJunctionVertices(this: ExtendedNamespace) {
  this.emitEvent(CleanPickedJunctionVertexEvent);
};

export function confirmPickedJunctionVertices(this: ExtendedNamespace) {
  this.emitEvent(ConfirmPickedJunctionVertexEvent);
};

export function enterEditJunction(this: ExtendedNamespace, junctionItem: JunctionItem) {
  this.disposeAllDrawers();

  this.emitEvent(AlterInteractionModeEvent, InteractionMode.EditJunction);

  this.toggleUIWrapper(JunctionPropertyPanelConfig.uiWrapperId, 1);

  this.emitEvent(EnterEditingJunctionItemEvent, { junctionItem });
};

export function exitEditJunction(this: ExtendedNamespace) {
  this.emitEvent(AlterInteractionModeEvent, InteractionMode.Roam);

  this.toggleUIWrapper(JunctionPropertyPanelConfig.uiWrapperId, 0);

  this.emitEvent(ExitEditingJunctionItemEvent);
};

export function cleanNewRoadPrevAndNextConnectionRoadVertices(this: ExtendedNamespace) {
  this.emitEvent(CleanNewRoadPrevAndNextConnectionRoadVertexEvent);
};

export function enterEditPointAlignItemList(this: ExtendedNamespace, pointAlignItemList: PointAlignItem[]) {
  if (!pointAlignItemList) return;

  const pointAlignItemKeyInfoList: PointAlignItemKeyInfo[] = []

  pointAlignItemList.forEach((PointAlignItem: PointAlignItem) => {
    pointAlignItemKeyInfoList.push(
      {
        pointAlignId: PointAlignItem.pointAlignId,
        pointAlignPoint: PointAlignItem.pointAlignPoint,
        pointAlignlasPoint2D: this.resolveACloudPoint2D(PointAlignItem.pointAlignPoint),
      }
    )
  });

  this.emitEvent(EnterEditingPointAlignItemListEvent, { pointAlignItemKeyInfoList: pointAlignItemKeyInfoList });
};

export function enterEditSegmentAlignItemList(this: ExtendedNamespace, segmentAlignItem: SegmentAlignItem[]) {
  const segmentAlignItemKeyInfoList: SegmentAlignItemKeyInfo[] = [];
  let segmentAlignPointItemKeyInfoList: SegmentAlignPointItemKeyInfo[] = [];

  segmentAlignItem.forEach((segmentAlignItem: SegmentAlignItem) => {

    segmentAlignPointItemKeyInfoList = [];
    segmentAlignItem.segmentAlignPoints.forEach((segmentAlignPointItem: SegmentAlignPointItem) => {
      segmentAlignPointItemKeyInfoList.push({
        segmentAlignPointId: segmentAlignPointItem.segmentAlignPointId,
        position2D: this.resolveACloudPoint2D(segmentAlignPointItem.position),
        position: segmentAlignPointItem.position,
        pointType: segmentAlignPointItem.pointType
      })
    });

    segmentAlignItemKeyInfoList.push({
      segmentAlignId: segmentAlignItem.segmentAlignId,
      segmentAlignPoints: segmentAlignPointItemKeyInfoList,
      lasPlaneDistance: segmentAlignItem.lasPlaneDistance,
      lasAltitudeDistance: segmentAlignItem.lasAltitudeDistance,
      lasSpaceDistance: segmentAlignItem.lasSpaceDistance,
    });

  })
  this.emitEvent(EnterEditingSegmentAlignItemListEvent, { segmentAlignItemKeyInfoList: segmentAlignItemKeyInfoList });
};

export function enterEditSignal(this: ExtendedNamespace, signalItem: SignalItem) {
  this.disposeAllDrawers();

  this.emitEvent(AlterInteractionModeEvent, InteractionMode.EditTrafficLights);

  this.toggleUIWrapper(SignalPropertyPanelConfig.uiWrapperId, 1);

  this.emitEvent(EnterEditingSignalItemEvent, { signalItem });
};

export function exitEditSignal(this: ExtendedNamespace) {
  this.emitEvent(AlterInteractionModeEvent, InteractionMode.Roam);

  this.toggleUIWrapper(SignalPropertyPanelConfig.uiWrapperId, 0);

  this.emitEvent(ExitEditingSignalItemEvent);
};