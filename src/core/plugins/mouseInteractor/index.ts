import {
  PointerEventTypes,
  PointerInfo,
  Mesh,
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../../core/types/plugins/raw';
import { ExtendedNamespace } from '../../../core/types/plugins/raw';
import RendererConfig from '../../../core/renderer/config';
import {
  AlterMouseInteractionModeEvent,
  AlterGroundAltitudeEvent,
  AlterPickItemUpCategoryEvent,
} from './constant';
import {
  MouseInteractionMode,
  PickItemUpCategory,
} from './type';
import {
  ReceiveTwoStraightLinePointEvent,
  ReceiveThreeCircleCurvePointEvent,
  ReceiveQuadraticBezierCurvePointEvent,
  ReceiveCubicBezierCurvePointEvent,
} from '../lineDrawer/constant';
import {
  ReceiveTwoStraightLineRoadPointEvent,
  ReceiveThreeCircleCurveRoadPointEvent,
  ReceiveQuadraticBezierCurveRoadPointEvent,
  ReceiveCubicBezierCurveRoadPointEvent,
  ReceiveCatmullSerieRoadPointEvent,
} from '../roadDrawer/constant';
import {
  PickActionMeshEvent,
  OperateActionMeshEvent,
  UnpickActionMeshEvent,
  DeliverRoadExtendCatmullPointEvent,
  DeliverRoadInnerAddCatmullPointEvent,
  DeliverRoadInnerRemoveCatmullPointEvent,
} from '../roadEditor/constant';
import {
  PickLaneActionMeshEvent,
  OperateLaneActionMeshEvent,
  UnpickLaneActionMeshEvent,
  DeliverRoadLaneInnerAddCatmullPointEvent,
  DeliverRoadLaneInnerRemoveCatmullPointEvent,
} from '../roadLaneEditor/constant';
import {
  PickRoadVertexEvent,
} from '../roadConnectionDrawer/constant';
import {
  PickConnectionActionMeshEvent,
  OperateConnectionActionMeshEvent,
  UnpickConnectionActionMeshEvent,
  PickNewLanePrevAndNextConnectionLaneVertexEvent,
  DeliverRoadConnectionInnerAddCatmullPointEvent,
  DeliverRoadConnectionInnerRemoveCatmullPointEvent,
} from '../roadConnectionEditor/constant';
import {
  PickConnectionLaneActionMeshEvent,
  OperateConnectionLaneActionMeshEvent,
  UnpickConnectionLaneActionMeshEvent,
  PickPrevAndNextConnectionLaneVertexEvent,
  DeliverRoadConnectionLaneInnerAddCatmullPointEvent,
  DeliverRoadConnectionLaneInnerRemoveCatmullPointEvent,
} from '../roadConnectionLaneEditor/constant';
import {
  PickJunctionVertexEvent,
} from '../junctionDrawer/constant';
import {
  PickJunctionActionMeshEvent,
  OperateJunctionActionMeshEvent,
  UnpickJunctionActionMeshEvent,
  PickNewRoadPrevAndNextConnectionRoadVertexEvent,
  DeliverJunctionAddEdgePointEvent,
  DeliverJunctionRemoveEdgePointEvent,
} from '../junctionEditor/constant';
import {
  SyncPickedOctreePCSMeshEvent,
  FetchTrafficLightsSurroundingOctreePCSMeshEvent,
} from '../octreeLoader/constant';
import {
  RoadItem,
  RoadCategory,
  LaneItem,
  JunctionItem,
  SignalItem,
} from '../statusManager/type';
import {
  UpdatePointAlignItemsAnd2DTipsEvent,
} from '../pointAlignDrawer/constant';
import {
  UpdateSegmentAlignItemsAnd2DTipsEvent,
} from '../segmentAlignDrawer/constant';
import {
  TriggerOctreeNodeVisibleChangeEvent,
} from "../octreeLoader/constant";

export default class MouseInteractorPlugin extends LogicalPlugin {
  private mouseInteractionMode: MouseInteractionMode;
  private mousePressing: boolean = false;
  private groundAltitude: number = 0;
  private pickItemUpCategory: PickItemUpCategory = PickItemUpCategory.Road;

  constructor(options: PluginOptions) {
    super(options);

    this.mouseInteractionMode = MouseInteractionMode.Roam;
  }

  activate() {
    super.activate();

    this.init();
  }

  init() {
    this.initEvent();
    this.initObservable();
  }

  initEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(AlterMouseInteractionModeEvent);
    scope.onEvent(AlterMouseInteractionModeEvent, (params: { payload: Object | string | number | null }) => {
      this.mouseInteractionMode = params.payload as MouseInteractionMode;
    });

    scope.registerEvent(AlterGroundAltitudeEvent);
    scope.onEvent(AlterGroundAltitudeEvent, (params: { payload: Object | string | number | null }) => {
      this.groundAltitude = params.payload as number;
    });

    scope.registerEvent(AlterPickItemUpCategoryEvent);
    scope.onEvent(AlterPickItemUpCategoryEvent, (params: { payload: Object | string | number | null }) => {
      const pickItemUpCategory = (params.payload as { pickItemUpCategory: PickItemUpCategory }).pickItemUpCategory;

      this.pickItemUpCategory = pickItemUpCategory;
    });
  }

  initObservable() {
    const scope = this as unknown as ExtendedNamespace;
    const contextScene = scope.getSceneManager().getContextScene();

    contextScene.onPointerObservable.add((pointerInfo: { type: number }) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN:
          this.onPointerDown(pointerInfo);
          break;
        case PointerEventTypes.POINTERUP:
          this.onPointerUp(pointerInfo);
          break;
        case PointerEventTypes.POINTERMOVE:
          this.onPointerMove(pointerInfo);
          break;
        case PointerEventTypes.POINTERWHEEL:
          this.onPointerWheel(pointerInfo);
          break;
        case PointerEventTypes.POINTERPICK:
          break;
        case PointerEventTypes.POINTERTAP:
          this.onPointerTap(pointerInfo);
          break;
        case PointerEventTypes.POINTERDOUBLETAP:
          this.onPointerDoubleTap(pointerInfo);
          break;
      }
    });
  }

  onPointerDown(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & MouseInteractorPlugin);
    this.mousePressing = true;

    const rawPointerInfo = pointerInfo as PointerInfo;

    const pointerEventButton = (pointerInfo as PointerInfo).event.button;
    const isLeftButton = pointerEventButton === 0;
    const isRightButton = pointerEventButton === 2;

    const isCtrl = (pointerInfo as PointerInfo).event.ctrlKey;
    const isAlt = (pointerInfo as PointerInfo).event.altKey;
    const isShift = (pointerInfo as PointerInfo).event.shiftKey;

    if (isAlt && isLeftButton) {
      scope.enableOrbitCameraRotate();
    } else {
      scope.disableOrbitCameraRotate();
    }

    switch (scope.mouseInteractionMode) {
      case MouseInteractionMode.Roam:
        break;
      case MouseInteractionMode.DrawTwoStraightLine:
      case MouseInteractionMode.DrawThreeCircleCurve:
      case MouseInteractionMode.DrawQuadraticBezierCurve:
      case MouseInteractionMode.DrawCubicBezierCurve:
      case MouseInteractionMode.DrawTwoStraightLineRoad:
      case MouseInteractionMode.DrawThreeCircleCurveRoad:
      case MouseInteractionMode.DrawQuadraticBezierCurveRoad:
      case MouseInteractionMode.DrawCubicBezierCurveRoad:
      case MouseInteractionMode.DrawCatmullSerieRoad:
        break;
      case MouseInteractionMode.EditRoad:
        if (rawPointerInfo.pickInfo?.pickedMesh) {
          const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;

          if (pickedMesh?.metadata?.isActionMesh) {
            scope.disableOrbitCameraRotateAndPan();
            scope.emitEvent(PickActionMeshEvent, { pickedMesh });
          }
        }
        break;
      case MouseInteractionMode.EditRoadLane:
        if (rawPointerInfo.pickInfo?.pickedMesh) {
          const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;

          if (pickedMesh?.metadata?.isLaneActionMesh) {
            scope.disableOrbitCameraRotateAndPan();
            scope.emitEvent(PickLaneActionMeshEvent, { pickedMesh });
          }
        }
        break;
      case MouseInteractionMode.DrawConnectionRoad:
        break;
      case MouseInteractionMode.EditConnectionRoad:
        if (rawPointerInfo.pickInfo?.pickedMesh) {
          const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;

          if (pickedMesh?.metadata?.isConnectionActionMesh) {
            scope.disableOrbitCameraRotateAndPan();
            scope.emitEvent(PickConnectionActionMeshEvent, { pickedMesh });
          }
        }
        break;
      case MouseInteractionMode.EditRoadConnectionLane:
        if (rawPointerInfo.pickInfo?.pickedMesh) {
          const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;
          if (pickedMesh?.metadata?.isConnectionLaneActionMesh) {
            scope.disableOrbitCameraRotateAndPan();
            scope.emitEvent(PickConnectionLaneActionMeshEvent, { pickedMesh });
          }
        }
        break;
      case MouseInteractionMode.DrawJunction:
        break;
      case MouseInteractionMode.EditJunction:
        if (rawPointerInfo.pickInfo?.pickedMesh) {
          const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;

          if (pickedMesh?.metadata?.isJunctionActionMesh) {
            scope.disableOrbitCameraRotateAndPan();
            scope.emitEvent(PickJunctionActionMeshEvent, { pickedMesh });
          }
        }
        break;
      case MouseInteractionMode.DrawPointAlign:
        break;
      case MouseInteractionMode.DrawSegmentAlign:
        break;
      case MouseInteractionMode.DrawTrafficLights:
        break;
      case MouseInteractionMode.EditTrafficLights:
        // if (rawPointerInfo.pickInfo?.pickedMesh) {
        //   const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;

        //   if (pickedMesh?.metadata?.isJunctionActionMesh) {
        //     scope.disableOrbitCameraRotateAndPan();
        //     scope.emitEvent(PickJunctionActionMeshEvent, { pickedMesh });
        //   }
        // }
        break;  
      default:
    }
  }

  onPointerUp(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & MouseInteractorPlugin);
    this.mousePressing = false;

    switch (scope.mouseInteractionMode) {
      case MouseInteractionMode.Roam:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawTwoStraightLine:
      case MouseInteractionMode.DrawThreeCircleCurve:
      case MouseInteractionMode.DrawQuadraticBezierCurve:
      case MouseInteractionMode.DrawCubicBezierCurve:
      case MouseInteractionMode.DrawTwoStraightLineRoad:
      case MouseInteractionMode.DrawThreeCircleCurveRoad:
      case MouseInteractionMode.DrawQuadraticBezierCurveRoad:
      case MouseInteractionMode.DrawCubicBezierCurveRoad:
      case MouseInteractionMode.DrawCatmullSerieRoad:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditRoad:
        scope.emitEvent(UnpickActionMeshEvent, { pointerInfo: (pointerInfo as PointerInfo) });
        scope.enableOrbitCameraRotateAndPan();
        break;
      case MouseInteractionMode.EditRoadLane:
        scope.emitEvent(UnpickLaneActionMeshEvent, { pointerInfo: (pointerInfo as PointerInfo) });
        scope.enableOrbitCameraRotateAndPan();
        break;
      case MouseInteractionMode.DrawConnectionRoad:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditConnectionRoad:
        scope.emitEvent(UnpickConnectionActionMeshEvent, { pointerInfo: (pointerInfo as PointerInfo) });
        scope.enableOrbitCameraRotateAndPan();
        break;
      case MouseInteractionMode.EditRoadConnectionLane:
        scope.emitEvent(UnpickConnectionLaneActionMeshEvent, { pointerInfo: (pointerInfo as PointerInfo) });
        scope.enableOrbitCameraRotateAndPan();
        break;
      case MouseInteractionMode.DrawJunction:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditJunction:
        scope.emitEvent(UnpickJunctionActionMeshEvent, { pointerInfo: (pointerInfo as PointerInfo) });
        scope.enableOrbitCameraRotateAndPan();
        break;
      case MouseInteractionMode.DrawPointAlign:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.emitEvent(UpdatePointAlignItemsAnd2DTipsEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawSegmentAlign:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.emitEvent(UpdateSegmentAlignItemsAnd2DTipsEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawTrafficLights:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditTrafficLights:
        // scope.emitEvent(UnpickConnectionLaneActionMeshEvent, { pointerInfo: (pointerInfo as PointerInfo) });
        scope.enableOrbitCameraRotateAndPan();
        break;   
      default:
    }
  }

  onPointerMove(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & MouseInteractorPlugin);

    const pickedRoadItem = scope.resolveMousePickingRoadItemInfo(pointerInfo as PointerInfo);
    const pickedLaneItem = scope.resolveMousePickingLaneItemInfo(pointerInfo as PointerInfo);
    const pickedJunctionItem = scope.resolveMousePickingJunctionItemInfo(pointerInfo as PointerInfo);

    const highlightDecision = (
      pickedRoadItem: RoadItem,
      pickedLaneItem: {
        belongingRoadItem: RoadItem,
        belongingLaneItem: LaneItem,
      },
      pickedJunctionItem: JunctionItem,
    ) => {
      scope.unhighlightAllRoadsAndJunctions();

      if (pickedRoadItem && this.pickItemUpCategory === PickItemUpCategory.Road) {
        scope.highlightSingleRoad(pickedRoadItem.roadId, pickedRoadItem.category);

        return;
      }
      
      if (pickedLaneItem && this.pickItemUpCategory === PickItemUpCategory.Lane) {
        const belongingRoadItem = pickedLaneItem.belongingRoadItem as RoadItem;
        const belongingLaneItem = pickedLaneItem.belongingLaneItem as LaneItem;
        
        scope.highlightSingleLane(belongingLaneItem.laneId, belongingRoadItem.roadId, belongingRoadItem.category);
        return;
      }

      if (pickedJunctionItem && this.pickItemUpCategory === PickItemUpCategory.Junction) {
        scope.highlightSingleJunction(pickedJunctionItem.junctionId);

        return;
      }
    };

    switch (scope.mouseInteractionMode) {
      case MouseInteractionMode.Roam:
        highlightDecision(pickedRoadItem, pickedLaneItem, pickedJunctionItem);

        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawTwoStraightLine:
      case MouseInteractionMode.DrawThreeCircleCurve:
      case MouseInteractionMode.DrawQuadraticBezierCurve:
      case MouseInteractionMode.DrawCubicBezierCurve:
      case MouseInteractionMode.DrawTwoStraightLineRoad:
      case MouseInteractionMode.DrawThreeCircleCurveRoad:
      case MouseInteractionMode.DrawQuadraticBezierCurveRoad:
      case MouseInteractionMode.DrawCubicBezierCurveRoad:
      case MouseInteractionMode.DrawCatmullSerieRoad:
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditRoad:
        scope.emitEvent(OperateActionMeshEvent, { pointerInfo: (pointerInfo as PointerInfo) });

        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditRoadLane:
        scope.emitEvent(OperateLaneActionMeshEvent, { pointerInfo: (pointerInfo as PointerInfo) });

        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawConnectionRoad:
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditConnectionRoad:
        scope.emitEvent(OperateConnectionActionMeshEvent, { pointerInfo: (pointerInfo as PointerInfo) });

        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditRoadConnectionLane:
        scope.emitEvent(OperateConnectionLaneActionMeshEvent, { pointerInfo: (pointerInfo as PointerInfo) });

        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawJunction:
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditJunction:
        scope.emitEvent(OperateJunctionActionMeshEvent, { pointerInfo: (pointerInfo as PointerInfo) });

        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawPointAlign:
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawSegmentAlign:
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawTrafficLights:
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditTrafficLights:
        // scope.emitEvent(OperateLaneActionMeshEvent, { pointerInfo: (pointerInfo as PointerInfo) });

        scope.makeSceneDirty();
        break;    
      default:
    }
  }

  onPointerWheel(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & MouseInteractorPlugin);

    switch (scope.mouseInteractionMode) {
      case MouseInteractionMode.Roam:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawTwoStraightLine:
      case MouseInteractionMode.DrawThreeCircleCurve:
      case MouseInteractionMode.DrawQuadraticBezierCurve:
      case MouseInteractionMode.DrawCubicBezierCurve:
      case MouseInteractionMode.DrawTwoStraightLineRoad:
      case MouseInteractionMode.DrawThreeCircleCurveRoad:
      case MouseInteractionMode.DrawQuadraticBezierCurveRoad:
      case MouseInteractionMode.DrawCubicBezierCurveRoad:
      case MouseInteractionMode.DrawCatmullSerieRoad:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditRoad:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditRoadLane:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawConnectionRoad:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditConnectionRoad:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditRoadConnectionLane:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawJunction:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditJunction:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawPointAlign:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.emitEvent(UpdatePointAlignItemsAnd2DTipsEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawSegmentAlign:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.emitEvent(UpdateSegmentAlignItemsAnd2DTipsEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.DrawTrafficLights:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;
      case MouseInteractionMode.EditTrafficLights:
        scope.emitEvent(TriggerOctreeNodeVisibleChangeEvent);
        scope.makeSceneDirty();
        break;    
      default:
    }
  }

  async onPointerTap(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & MouseInteractorPlugin);

    const rawPointerInfo = pointerInfo as PointerInfo;

    const pointerEventButton = (pointerInfo as PointerInfo).event.button;
    const isLeftButton = pointerEventButton === 0;
    const isRightButton = pointerEventButton === 2;

    const isCtrl = (pointerInfo as PointerInfo).event.ctrlKey;
    const isAlt = (pointerInfo as PointerInfo).event.altKey;
    const isShift = (pointerInfo as PointerInfo).event.shiftKey;

    const hasActualPickedMesh = !!((pointerInfo as PointerInfo).pickInfo?.pickedMesh);

    const pickedReferenceLineItem = scope.resolveMousePickingReferenceLineItemInfo(pointerInfo as PointerInfo);

    const pickedLaneLineItems = scope.resolveMousePickingLaneLineItemInfo(pointerInfo as PointerInfo);

    const pickedJunctionEdgeItems = scope.resolveMousePickingJunctionEdgeItemInfo(pointerInfo as PointerInfo);

    const pickedOnGround = await scope.resolveMouseRayPickingInfoOnDummyXZPlane(pointerInfo as PointerInfo, { yOffset: this.groundAltitude });

    switch (scope.mouseInteractionMode) {
      case MouseInteractionMode.Roam:
        break;
      case MouseInteractionMode.DrawTwoStraightLine:
        if (isRightButton && pickedOnGround?.pickedMesh) {
          scope.emitEvent(ReceiveTwoStraightLinePointEvent, { pickedPoint: pickedOnGround.pickedPoint });
        }
        break;
      case MouseInteractionMode.DrawThreeCircleCurve:
        if (isRightButton && pickedOnGround?.pickedMesh) {
          scope.emitEvent(ReceiveThreeCircleCurvePointEvent, { pickedPoint: pickedOnGround.pickedPoint });
        }
        break;
      case MouseInteractionMode.DrawQuadraticBezierCurve:
        if (isRightButton && pickedOnGround?.pickedMesh) {
          scope.emitEvent(ReceiveQuadraticBezierCurvePointEvent, { pickedPoint: pickedOnGround.pickedPoint });
        }
        break;
      case MouseInteractionMode.DrawCubicBezierCurve:
        if (isRightButton && pickedOnGround?.pickedMesh) {
          scope.emitEvent(ReceiveCubicBezierCurvePointEvent, { pickedPoint: pickedOnGround.pickedPoint });
        }
        break;
      case MouseInteractionMode.DrawTwoStraightLineRoad:
        if (isRightButton && pickedOnGround?.pickedMesh) {
          scope.emitEvent(ReceiveTwoStraightLineRoadPointEvent, { pickedPoint: pickedOnGround.pickedPoint });
        }
        break;
      case MouseInteractionMode.DrawThreeCircleCurveRoad:
        if (isRightButton && pickedOnGround?.pickedMesh) {
          scope.emitEvent(ReceiveThreeCircleCurveRoadPointEvent, { pickedPoint: pickedOnGround.pickedPoint });
        }
        break;
      case MouseInteractionMode.DrawQuadraticBezierCurveRoad:
        if (isRightButton && pickedOnGround?.pickedMesh) {
          scope.emitEvent(ReceiveQuadraticBezierCurveRoadPointEvent, { pickedPoint: pickedOnGround.pickedPoint });
        }
        break;
      case MouseInteractionMode.DrawCubicBezierCurveRoad:
        if (isRightButton && pickedOnGround?.pickedMesh) {
          scope.emitEvent(ReceiveCubicBezierCurveRoadPointEvent, { pickedPoint: pickedOnGround.pickedPoint });
        }
        break;
      case MouseInteractionMode.DrawCatmullSerieRoad:
        if (isRightButton && pickedOnGround?.pickedMesh) {
          scope.emitEvent(ReceiveCatmullSerieRoadPointEvent, { pickedPoint: pickedOnGround.pickedPoint });
        }
        break;
      case MouseInteractionMode.EditRoad:
        if (isRightButton && pickedOnGround?.pickedMesh && !hasActualPickedMesh) {
          scope.emitEvent(DeliverRoadExtendCatmullPointEvent, { pickedPoint: pickedOnGround.pickedPoint });
        } else if (isRightButton && hasActualPickedMesh && pickedReferenceLineItem) {
          const pickedPoint = pickedReferenceLineItem.pickedPoint;
          const belongingRoadItem = pickedReferenceLineItem.belongingRoadItem;

          if (isCtrl) {
            scope.emitEvent(DeliverRoadInnerRemoveCatmullPointEvent, { pickedPoint, belongingRoadItem });
          } else {
            scope.emitEvent(DeliverRoadInnerAddCatmullPointEvent, { pickedPoint, belongingRoadItem });
          }
        }
        break;
      case MouseInteractionMode.EditRoadLane:
        if (isRightButton && hasActualPickedMesh && pickedLaneLineItems) {
          if (isCtrl) {
            scope.emitEvent(DeliverRoadLaneInnerRemoveCatmullPointEvent, { pickedLaneLineItems });
          } else {
            scope.emitEvent(DeliverRoadLaneInnerAddCatmullPointEvent, { pickedLaneLineItems });
          }
        }
        break;
      case MouseInteractionMode.DrawConnectionRoad:
        if (rawPointerInfo.pickInfo?.pickedMesh) {
          const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;

          if (pickedMesh?.metadata?.isRoadVertex) {
            scope.emitEvent(PickRoadVertexEvent, { pickedMesh });
          }
        }
        break;
      case MouseInteractionMode.EditConnectionRoad:
        if (isRightButton && hasActualPickedMesh && pickedReferenceLineItem) {
          const pickedPoint = pickedReferenceLineItem.pickedPoint;
          const belongingRoadItem = pickedReferenceLineItem.belongingRoadItem;

          if (isCtrl) {
            scope.emitEvent(DeliverRoadConnectionInnerRemoveCatmullPointEvent, { pickedPoint, belongingRoadItem });
          } else {
            scope.emitEvent(DeliverRoadConnectionInnerAddCatmullPointEvent, { pickedPoint, belongingRoadItem });
          }
        } else if (rawPointerInfo.pickInfo?.pickedMesh?.metadata?.isNewLanePrevAndNextConnectionLaneVertex) {
          const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;

          if (pickedMesh?.metadata?.isNewLanePrevAndNextConnectionLaneVertex) {
            scope.emitEvent(PickNewLanePrevAndNextConnectionLaneVertexEvent, { pickedMesh });
          }
        }
        break;
      case MouseInteractionMode.EditRoadConnectionLane:
        if (isRightButton && hasActualPickedMesh && pickedLaneLineItems) {
          if (isCtrl) {
            scope.emitEvent(DeliverRoadConnectionLaneInnerRemoveCatmullPointEvent, { pickedLaneLineItems });
          } else {
            scope.emitEvent(DeliverRoadConnectionLaneInnerAddCatmullPointEvent, { pickedLaneLineItems });
          }
        } else if (rawPointerInfo.pickInfo?.pickedMesh?.metadata?.isPrevAndNextConnectionLaneVertex) {
          const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;

          if (pickedMesh?.metadata?.isPrevAndNextConnectionLaneVertex) {
            scope.emitEvent(PickPrevAndNextConnectionLaneVertexEvent, { pickedMesh });
          }
        }
        break;
      case MouseInteractionMode.DrawJunction:
        if (rawPointerInfo.pickInfo?.pickedMesh) {
          const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;

          if (pickedMesh?.metadata?.isJunctionVertex) {
            scope.emitEvent(PickJunctionVertexEvent, { pickedMesh });
          }
        }
        break;
      case MouseInteractionMode.EditJunction:
        if (isRightButton && hasActualPickedMesh && pickedJunctionEdgeItems) {
          const pickedPoint = pickedJunctionEdgeItems.pickedPoint;
          const belongingJunctionEdgeItem = pickedJunctionEdgeItems.belongingJunctionEdgeItem;
          
          if (isCtrl) {
            scope.emitEvent(DeliverJunctionRemoveEdgePointEvent, { pickedPoint, belongingJunctionEdgeItem });
          } else {
            scope.emitEvent(DeliverJunctionAddEdgePointEvent, { pickedPoint, belongingJunctionEdgeItem });
          }
        } else if (rawPointerInfo.pickInfo?.pickedMesh?.metadata?.isNewRoadPrevAndNextConnectionRoadVertex) {
          const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;

          if (pickedMesh?.metadata?.isNewRoadPrevAndNextConnectionRoadVertex) {
            scope.emitEvent(PickNewRoadPrevAndNextConnectionRoadVertexEvent, { pickedMesh });
          }
        }
        break;
      case MouseInteractionMode.DrawPointAlign:
        if (isLeftButton) {
          const pickedPCSMeshs = scope.resolveMousePickingPCSItemInfo(pointerInfo as PointerInfo);

          scope.emitEvent(SyncPickedOctreePCSMeshEvent, {
            pointerInfo: (pointerInfo as PointerInfo),
            mouseInteractionMode: MouseInteractionMode.DrawPointAlign,
            pickedPCSMeshs,
          });
        }
        break;
      case MouseInteractionMode.DrawSegmentAlign:
        if (isLeftButton) {
          const pickedPCSMeshs = scope.resolveMousePickingPCSItemInfo(pointerInfo as PointerInfo);

          scope.emitEvent(SyncPickedOctreePCSMeshEvent, {
            pointerInfo: (pointerInfo as PointerInfo),
            mouseInteractionMode: MouseInteractionMode.DrawSegmentAlign,
            pickedPCSMeshs,
          });
        }
        break;
      case MouseInteractionMode.DrawTrafficLights:
        if (isRightButton) {
          const pickedPCSMeshs = scope.resolveMousePickingPCSItemInfo(pointerInfo as PointerInfo);

          scope.emitEvent(FetchTrafficLightsSurroundingOctreePCSMeshEvent, {
            pointerInfo: (pointerInfo as PointerInfo),
            pickedPCSMeshs,
          });
        }
        break;
      case MouseInteractionMode.EditTrafficLights:
        if (isRightButton) {
          
        }
        break;  
      default:
    }
  }

  onPointerDoubleTap(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & MouseInteractorPlugin);

    const pickedRoadItem = scope.resolveMousePickingRoadItemInfo(pointerInfo as PointerInfo);
    const pickedLaneItem = scope.resolveMousePickingLaneItemInfo(pointerInfo as PointerInfo);
    const pickedJunctionItem = scope.resolveMousePickingJunctionItemInfo(pointerInfo as PointerInfo);
    const pickedSignalItem = scope.resolveMousePickingSignalItemInfo(pointerInfo as PointerInfo);

    const editModeDecision = (
      pickedRoadItem: RoadItem,
      pickedLaneItem: {
        belongingRoadItem: RoadItem,
        belongingLaneItem: LaneItem,
      },
      pickedJunctionItem: JunctionItem,
      pickedSignalItem: SignalItem,
    ) => {
      if (!pickedRoadItem && !pickedLaneItem && !pickedJunctionItem && !pickedSignalItem) {
        scope.exitEditRoad();
        scope.exitEditRoadLane();
        scope.exitEditRoadConnection();
        scope.exitEditRoadConnectionLane();
        scope.exitEditJunction();
        scope.exitEditSignal();

        return;
      }

      if (pickedRoadItem && this.pickItemUpCategory === PickItemUpCategory.Road) {
        scope.exitEditRoad();
        scope.exitEditRoadLane();
        scope.exitEditRoadConnection();
        scope.exitEditRoadConnectionLane();
        scope.exitEditJunction();
        scope.exitEditSignal();

        const roadCategory = (pickedRoadItem as RoadItem).category;

        if (roadCategory === RoadCategory.ConnectionRoad) {
          scope.enterEditRoadConnection(pickedRoadItem);
        } else {
          scope.enterEditRoad(pickedRoadItem);
        }

        return;
      }
      
      if (pickedLaneItem && this.pickItemUpCategory === PickItemUpCategory.Lane) {
        scope.exitEditRoad();
        scope.exitEditRoadLane();
        scope.exitEditRoadConnection();
        scope.exitEditRoadConnectionLane();
        scope.exitEditJunction();
        scope.exitEditSignal();

        const belongingRoadItem = pickedLaneItem.belongingRoadItem as RoadItem;
        const belongingLaneItem = pickedLaneItem.belongingLaneItem as LaneItem;
        const roadCategory = belongingRoadItem.category;

        if (roadCategory === RoadCategory.ConnectionRoad) {
          scope.enterEditRoadConnectionLane(belongingRoadItem, belongingLaneItem);
        } else {
          scope.enterEditRoadLane(belongingRoadItem, belongingLaneItem);
        }

        return;
      }

      if (pickedJunctionItem && this.pickItemUpCategory === PickItemUpCategory.Junction) {
        scope.exitEditRoad();
        scope.exitEditRoadLane();
        scope.exitEditRoadConnection();
        scope.exitEditRoadConnectionLane();
        scope.exitEditJunction();
        scope.exitEditSignal();

        scope.enterEditJunction(pickedJunctionItem);

        return;
      }

      if (pickedSignalItem && this.pickItemUpCategory === PickItemUpCategory.Signal) {
        scope.exitEditRoad();
        scope.exitEditRoadLane();
        scope.exitEditRoadConnection();
        scope.exitEditRoadConnectionLane();
        scope.exitEditJunction();
        scope.exitEditSignal();

        scope.enterEditSignal(pickedSignalItem);

        return;
      }
    };

    switch (scope.mouseInteractionMode) {
      case MouseInteractionMode.Roam:
        if (pickedRoadItem && this.pickItemUpCategory === PickItemUpCategory.Road) {
          const roadCategory = (pickedRoadItem as RoadItem).category;

          if (roadCategory === RoadCategory.ConnectionRoad) {
            scope.enterEditRoadConnection(pickedRoadItem);
          } else {
            scope.enterEditRoad(pickedRoadItem);
          }
        } else if (pickedLaneItem && this.pickItemUpCategory === PickItemUpCategory.Lane) {
          const belongingRoadItem = pickedLaneItem.belongingRoadItem as RoadItem;
          const belongingLaneItem = pickedLaneItem.belongingLaneItem as LaneItem;
          const roadCategory = belongingRoadItem.category;

          if (roadCategory === RoadCategory.ConnectionRoad) {
            scope.enterEditRoadConnectionLane(belongingRoadItem, belongingLaneItem);
          } else {
            scope.enterEditRoadLane(belongingRoadItem, belongingLaneItem);
          }
        } else if (pickedJunctionItem && this.pickItemUpCategory === PickItemUpCategory.Junction) {
          scope.enterEditJunction(pickedJunctionItem);
        } else if (pickedSignalItem && this.pickItemUpCategory === PickItemUpCategory.Signal) {
          scope.enterEditSignal(pickedSignalItem);
        }
        break;
      case MouseInteractionMode.DrawTwoStraightLine:
      case MouseInteractionMode.DrawThreeCircleCurve:
      case MouseInteractionMode.DrawQuadraticBezierCurve:
      case MouseInteractionMode.DrawCubicBezierCurve:
      case MouseInteractionMode.DrawTwoStraightLineRoad:
      case MouseInteractionMode.DrawThreeCircleCurveRoad:
      case MouseInteractionMode.DrawQuadraticBezierCurveRoad:
      case MouseInteractionMode.DrawCubicBezierCurveRoad:
      case MouseInteractionMode.DrawCatmullSerieRoad:
        break;
      case MouseInteractionMode.EditRoad:
        editModeDecision(pickedRoadItem, pickedLaneItem, pickedJunctionItem, pickedSignalItem);
        break;
      case MouseInteractionMode.EditRoadLane:
        editModeDecision(pickedRoadItem, pickedLaneItem, pickedJunctionItem, pickedSignalItem);
        break;
      case MouseInteractionMode.DrawConnectionRoad:
        break;
      case MouseInteractionMode.EditConnectionRoad:
        editModeDecision(pickedRoadItem, pickedLaneItem, pickedJunctionItem, pickedSignalItem);
        break;
      case MouseInteractionMode.EditRoadConnectionLane:
        editModeDecision(pickedRoadItem, pickedLaneItem, pickedJunctionItem, pickedSignalItem);
        break;
      case MouseInteractionMode.DrawJunction:
        break;
      case MouseInteractionMode.EditJunction:
        editModeDecision(pickedRoadItem, pickedLaneItem, pickedJunctionItem, pickedSignalItem);
        break;
      case MouseInteractionMode.DrawPointAlign:
        break;
      case MouseInteractionMode.DrawSegmentAlign:
        break;
      case MouseInteractionMode.DrawTrafficLights:
        break;
      case MouseInteractionMode.EditTrafficLights:
        editModeDecision(pickedRoadItem, pickedLaneItem, pickedJunctionItem, pickedSignalItem);
        break;    
      default:
    }
  }
};