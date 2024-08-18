import {
  Vector3,
  Color3,
  Mesh,
  PointerInfo,
  PickingInfo,
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  EnterEditingRoadLaneItemEvent,
  ExitEditingRoadLaneItemEvent,
  PickLaneActionMeshEvent,
  OperateLaneActionMeshEvent,
  UnpickLaneActionMeshEvent,
  DeliverRoadLaneInnerAddCatmullPointEvent,
  DeliverRoadLaneInnerRemoveCatmullPointEvent
} from './constant';
import {
  ActionMeshCategory,
  ActionMeshMetadata,
} from './type';
import {
  LineAndCurveCategory,
  LineAndCurveItem,
  ReferenceLineItem,
  LaneLineItem,
  LaneItem,
  RoadItem,
  RoadCategory,
  LaneSide,
  LaneLineSide,
} from '../statusManager/type';
import { TransactionType } from '../../transactions';
import {
  InvokeRemoveCatmullSerieRoadEvent,
  InvokeReformatCatmullSerieRoadEvent,
  InvokeAddLaneCatmullSerieRoadEvent,
  InvokeRemoveLaneCatmullSerieRoadEvent,
  InvokeLaneWidthEditCatmullSerieRoadEvent,
  InvokeCatmullEditCatmullSerieRoadEvent,
  InvokeCatmullAlterLaneCatmullSerieRoadEvent,
  InvokeCatmullExtendCatmullSerieRoadEvent,
  InvokeRoadTransparencyEditEvent,
  InvokeRoadAttributeEditEvent,
  InvokeRoadLaneAttributeEditEvent,
  InvokeRoadLaneLineInnerAttributeEditEvent,
  InvokeRoadLaneLineOuterAttributeEditEvent,
  InvokeRoadLaneLineSeriePointsOnlyPostInvalidEvent,
  InvokeRoadLaneLineSeriePointsPreAndPostInvalidEvent,
} from '../../transactions/event';
import {
  EnterRoadLaneAltitudeAdaptorEvent,
  ExitRoadLaneAltitudeAdaptorEvent,
} from '../roadLaneAltitudeAdaptor/constant';

export default class RoadLaneEditorPlugin extends LogicalPlugin {
  private editingRoadItem: RoadItem | null;
  private editingRoadLaneItem: LaneItem | null;
  private currentActionMesh: Mesh | null;
  private currentActionMeshInitPosition: Vector3 | null;
  private actionMeshes: { [id: string]: Mesh };
  private actionMeshIndex: number;

  constructor(options: PluginOptions) {
    super(options);

    this.editingRoadItem = null;
    this.editingRoadLaneItem = null;
    this.currentActionMesh = null;
    this.currentActionMeshInitPosition = null;
    this.actionMeshes = {};
    this.actionMeshIndex = 0;
  }

  activate() {
    super.activate();

    this.init();
  }

  init() {
    this.initEvent();
    this.initTransactionInvokedEvent();
  }

  initEvent() {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);

    scope.registerEvent(EnterEditingRoadLaneItemEvent);
    scope.onEvent(EnterEditingRoadLaneItemEvent, (params: { payload: Object | string | number | null }) => {
      scope.unhighlightAllRoadsAndJunctions();

      scope.undecorateEditingLaneItem();

      scope.editingRoadItem = (params.payload as { roadItem: RoadItem }).roadItem;
      scope.editingRoadLaneItem = (params.payload as { laneItem: LaneItem }).laneItem;

      scope.highlightSingleLane(scope.editingRoadLaneItem.laneId, scope.editingRoadItem.roadId, scope.editingRoadItem.category);

      scope.decorateEditingLaneItem();

      scope.emitEvent(EnterRoadLaneAltitudeAdaptorEvent, { roadItem: scope.editingRoadItem, laneItem: scope.editingRoadLaneItem });
    });

    scope.registerEvent(ExitEditingRoadLaneItemEvent);
    scope.onEvent(ExitEditingRoadLaneItemEvent, (params: { payload: Object | string | number | null }) => {
      scope.unhighlightAllRoadsAndJunctions();

      scope.undecorateEditingLaneItem();

      scope.emitEvent(ExitRoadLaneAltitudeAdaptorEvent);
    });

    scope.registerEvent(PickLaneActionMeshEvent);
    scope.onEvent(PickLaneActionMeshEvent, (params: { payload: Object | string | number | null }) => {
      const pickedMesh = (params.payload as { pickedMesh: Mesh }).pickedMesh;
      if (!scope.isActionMesh(pickedMesh)) return;

      scope.currentActionMesh = pickedMesh;
      scope.currentActionMeshInitPosition = pickedMesh.position;
    });

    scope.registerEvent(OperateLaneActionMeshEvent);
    scope.onEvent(OperateLaneActionMeshEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem || !scope.editingRoadLaneItem || !scope.currentActionMesh) return;

      const pointerInfo = (params.payload as { pointerInfo: PointerInfo }).pointerInfo;
      const alignAltitude = scope.currentActionMesh.position.y;

      const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
        altitude: alignAltitude,
      });

      scope.onOperateActionMesh(pickingInfo, alignAltitude);
    });

    scope.registerEvent(UnpickLaneActionMeshEvent);
    scope.onEvent(UnpickLaneActionMeshEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem || !scope.editingRoadLaneItem || !scope.currentActionMesh) return;

      const pointerInfo = (params.payload as { pointerInfo: PointerInfo }).pointerInfo;
      const alignAltitude = scope.currentActionMesh.position.y;

      const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
        altitude: alignAltitude,
      });

      scope.onUnpickActionMesh(pickingInfo, alignAltitude);
    });

    scope.registerEvent(DeliverRoadLaneInnerAddCatmullPointEvent);
    scope.onEvent(DeliverRoadLaneInnerAddCatmullPointEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem || !scope.editingRoadLaneItem) return;

      const d_editingRoadItem = scope.editingRoadItem as RoadItem;
      const d_editingRoadLaneItem = scope.editingRoadLaneItem as LaneItem;

      const pickedLaneLineItems = (params.payload as { pickedLaneLineItems: Array<{
        pickedPoint: Vector3;
        belongingRoadItem: RoadItem;
        belongingLaneItem: LaneItem;
        belongingLaneLineItem: LaneLineItem;
      }> }).pickedLaneLineItems;

      const targetLaneLineItem = pickedLaneLineItems.find((laneLineItem: {
        pickedPoint: Vector3;
        belongingRoadItem: RoadItem;
        belongingLaneItem: LaneItem;
        belongingLaneLineItem: LaneLineItem;
      }) => {
        return d_editingRoadItem.roadId === laneLineItem.belongingRoadItem.roadId && d_editingRoadItem.category === laneLineItem.belongingRoadItem.category && d_editingRoadLaneItem.laneId === laneLineItem.belongingLaneItem.laneId;
      });

      if (!targetLaneLineItem) return;

      const pickedPoint = targetLaneLineItem.pickedPoint;
      const belongingRoadItem = targetLaneLineItem.belongingRoadItem;
      const belongingLaneItem = targetLaneLineItem.belongingLaneItem;
      const belongingLaneLineItem = targetLaneLineItem.belongingLaneLineItem;

      const isMostInnerLane = scope.isMostInnerLaneInRoad(belongingRoadItem, belongingLaneItem);
      const isInnerLaneLine = belongingLaneLineItem.laneLineSide === LaneLineSide.Inner;

      if (isMostInnerLane && isInnerLaneLine) return;
      
      scope.onDeliverRoadLaneInnerAddCatmullPoint(pickedPoint, belongingLaneLineItem);
    });

    scope.registerEvent(DeliverRoadLaneInnerRemoveCatmullPointEvent);
    scope.onEvent(DeliverRoadLaneInnerRemoveCatmullPointEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem || !scope.editingRoadLaneItem) return;

      const d_editingRoadItem = scope.editingRoadItem as RoadItem;
      const d_editingRoadLaneItem = scope.editingRoadLaneItem as LaneItem;

      const pickedLaneLineItems = (params.payload as { pickedLaneLineItems: Array<{
        pickedPoint: Vector3;
        belongingRoadItem: RoadItem;
        belongingLaneItem: LaneItem;
        belongingLaneLineItem: LaneLineItem;
      }> }).pickedLaneLineItems;

      const targetLaneLineItem = pickedLaneLineItems.find((laneLineItem: {
        pickedPoint: Vector3;
        belongingRoadItem: RoadItem;
        belongingLaneItem: LaneItem;
        belongingLaneLineItem: LaneLineItem;
      }) => {
        return d_editingRoadItem.roadId === laneLineItem.belongingRoadItem.roadId && d_editingRoadItem.category === laneLineItem.belongingRoadItem.category && d_editingRoadLaneItem.laneId === laneLineItem.belongingLaneItem.laneId;
      });

      if (!targetLaneLineItem) return;

      const pickedPoint = targetLaneLineItem.pickedPoint;
      const belongingLaneLineItem = targetLaneLineItem.belongingLaneLineItem;
      
      scope.onDeliverRoadLaneInnerRemoveCatmullPoint(pickedPoint, belongingLaneLineItem);
    });
  }

  initTransactionInvokedEvent() {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);

    // exit if editing lane is removed
    const clearRoadLaneDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadLaneItem) return;

      const laneId = (params.payload as { laneId: string }).laneId;

      if (scope.editingRoadLaneItem.laneId === laneId) {
        scope.exitEditRoadLane();
      }
    };

    scope.onEvent(InvokeRemoveLaneCatmullSerieRoadEvent, clearRoadLaneDecorationCallback);

    const clearRoadDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      const roadId = (params.payload as { roadId: string }).roadId;

      if (scope.editingRoadItem.roadId === roadId) {
        scope.exitEditRoadLane();
      }
    };

    scope.onEvent(InvokeRemoveCatmullSerieRoadEvent, clearRoadDecorationCallback);


    // after editing, refresh decoration
    const refreshRoadLaneDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem || !scope.editingRoadLaneItem) return;

      scope.emitEvent(EnterEditingRoadLaneItemEvent, {
        roadItem: scope.resolveRoadByRoadIdAndRoadCategory(scope.editingRoadItem.roadId, scope.editingRoadItem.category) as RoadItem,
        laneItem: scope.resolveLaneByLaneRoadIdAndRoadCategory(scope.editingRoadLaneItem.laneId, scope.editingRoadItem.roadId, scope.editingRoadItem.category) as LaneItem,
      });
    };

    scope.onEvent(InvokeReformatCatmullSerieRoadEvent, refreshRoadLaneDecorationCallback);
    scope.onEvent(InvokeLaneWidthEditCatmullSerieRoadEvent, refreshRoadLaneDecorationCallback);
    scope.onEvent(InvokeAddLaneCatmullSerieRoadEvent, refreshRoadLaneDecorationCallback);
    scope.onEvent(InvokeRemoveLaneCatmullSerieRoadEvent, refreshRoadLaneDecorationCallback);
    scope.onEvent(InvokeCatmullEditCatmullSerieRoadEvent, refreshRoadLaneDecorationCallback);
    scope.onEvent(InvokeCatmullAlterLaneCatmullSerieRoadEvent, refreshRoadLaneDecorationCallback);

    scope.onEvent(InvokeCatmullExtendCatmullSerieRoadEvent, refreshRoadLaneDecorationCallback);

    scope.onEvent(InvokeRoadTransparencyEditEvent, refreshRoadLaneDecorationCallback);
    scope.onEvent(InvokeRoadAttributeEditEvent, refreshRoadLaneDecorationCallback);
    scope.onEvent(InvokeRoadLaneAttributeEditEvent, refreshRoadLaneDecorationCallback);
    scope.onEvent(InvokeRoadLaneLineInnerAttributeEditEvent, refreshRoadLaneDecorationCallback);
    scope.onEvent(InvokeRoadLaneLineOuterAttributeEditEvent, refreshRoadLaneDecorationCallback);

    // unexpected lane lines
    const roadLaneLineOnlyPostInvalidCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      const roadId = (params.payload as { roadId: string }).roadId;

      if (scope.editingRoadItem.roadId === roadId) {
        scope.alertUnexpectedRoadLaneLineSeriePointsOnlyPost();
      }
    };

    scope.onEvent(InvokeRoadLaneLineSeriePointsOnlyPostInvalidEvent, roadLaneLineOnlyPostInvalidCallback);

    const roadLaneLinePreAndPostInvalidCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      const roadId = (params.payload as { roadId: string }).roadId;

      if (scope.editingRoadItem.roadId === roadId) {
        scope.alertUnexpectedRoadLaneLineSeriePointsPreAndPost();
      }
    };

    scope.onEvent(InvokeRoadLaneLineSeriePointsPreAndPostInvalidEvent, roadLaneLinePreAndPostInvalidCallback);
  }

  isActionMesh(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);
    if (!scope.editingRoadLaneItem) return false;

    return !!(pickedMesh?.metadata?.isLaneActionMesh);
  }

  createActionMesh(
    point: Vector3,
    color: Color3,
    category: ActionMeshCategory,
    extra: {
      relatedRefLine?: ReferenceLineItem;
      relatedLaneLine?: LaneLineItem;
      relatedLane?: LaneItem;
      isStartCatmull?: boolean;
      isEndCatmull?: boolean;
      catmullIndex?: number;
    },
  ) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);

    const id = `Road_Lane_Editor_Action_Mesh_${scope.actionMeshIndex}`;
    const actionMesh = scope.createMarker(point, color, id) as Mesh;
    actionMesh.metadata = {
      isLaneActionMesh: true,
      point,
      color,
      category,
      relatedRefLine: extra.relatedRefLine,
      relatedLaneLine: extra.relatedLaneLine,
      relatedLane: extra.relatedLane,
      isStartCatmull: extra.isStartCatmull,
      isEndCatmull: extra.isEndCatmull,
      catmullIndex: extra.catmullIndex,
    } as ActionMeshMetadata;

    scope.actionMeshIndex++;
    scope.actionMeshes[id] = actionMesh;

    scope.makeSceneDirty();
  }

  updateActionMesh(id: string, point: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);

    const oldMesh = scope.actionMeshes[id];
    if (!oldMesh) return;
    const oldMetadata = oldMesh.metadata as ActionMeshMetadata;

    const actionMesh = scope.createMarker(point, oldMetadata.color, id) as Mesh;
    actionMesh.metadata = {
      isLaneActionMesh: true,
      point,
      color: oldMetadata.color,
      category: oldMetadata.category,
      relatedRefLine: oldMetadata.relatedRefLine,
      relatedLaneLine: oldMetadata.relatedLaneLine,
      relatedLane: oldMetadata.relatedLane,
      isStartCatmull: oldMetadata.isStartCatmull,
      isEndCatmull: oldMetadata.isEndCatmull,
      catmullIndex: oldMetadata.catmullIndex,
    } as ActionMeshMetadata;

    oldMesh.dispose();

    scope.currentActionMesh = actionMesh;
    scope.actionMeshes[id] = actionMesh;

    scope.makeSceneDirty();
  }

  undecorateEditingLaneItem() {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);

    const ids = Object.keys(scope.actionMeshes);
    ids.forEach((id: string) => {
      scope.actionMeshes[id].dispose();
    });

    scope.editingRoadItem = null;
    scope.editingRoadLaneItem = null;
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
    scope.actionMeshes = {};

    scope.makeSceneDirty();
  }

  decorateEditingLaneItem() {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem) return;

    // scope.decorateLaneWidthEdit();
    scope.decorateLaneCatmullEdit();

    scope.makeSceneDirty();
  }

  decorateLaneWidthEdit() {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem) return;

    const laneSide = scope.editingRoadLaneItem.laneSide;

    const outerLaneLine = scope.editingRoadLaneItem.laneLines.outerLaneLine;
    const outerCenter = scope.resolveCenterVirtualPointOnPathViaSeriePoints(outerLaneLine.seriePoints);

    scope.createActionMesh(
      outerCenter,
      RendererConfig.mesh.laneWidthEditMarkerColor,
      laneSide === LaneSide.Left ? ActionMeshCategory.LeftLaneWidthEdit : ActionMeshCategory.RightLaneWidthEdit,
      {
        relatedLaneLine: outerLaneLine,
        relatedLane: scope.editingRoadLaneItem,
      },
    );
  }

  decorateLaneCatmullEdit() {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem) return;

    const laneSide = scope.editingRoadLaneItem.laneSide;

    const innerLaneLine = scope.editingRoadLaneItem.laneLines.innerLaneLine;
    const outerLaneLine = scope.editingRoadLaneItem.laneLines.outerLaneLine;
    const innerCatmullPoints = innerLaneLine.catmullPoints;
    const outerCatmullPoints = outerLaneLine.catmullPoints;
    const innerCatmullPointsNum = innerCatmullPoints.length;
    const outerCatmullPointsNum = outerCatmullPoints.length;

    const isMostInner = scope.isMostInnerLaneInRoad(scope.editingRoadItem, scope.editingRoadLaneItem);

    if (!isMostInner) {
      innerCatmullPoints.forEach((p: Vector3, catmullIndex: number) => {
        scope.createActionMesh(
          p,
          RendererConfig.mesh.laneLineCatmullMarkerColor,
          laneSide === LaneSide.Left ? ActionMeshCategory.LeftLaneCatmullEdit : ActionMeshCategory.RightLaneCatmullEdit,
          {
            relatedLaneLine: innerLaneLine,
            relatedLane: scope.editingRoadLaneItem as LaneItem,
            isStartCatmull: catmullIndex === 0,
            isEndCatmull: catmullIndex === innerCatmullPointsNum - 1,
            catmullIndex: catmullIndex,
          },
        );
      });
    }

    outerCatmullPoints.forEach((p: Vector3, catmullIndex: number) => {
      scope.createActionMesh(
        p,
        RendererConfig.mesh.laneLineCatmullMarkerColor,
        laneSide === LaneSide.Left ? ActionMeshCategory.LeftLaneCatmullEdit : ActionMeshCategory.RightLaneCatmullEdit,
        {
          relatedLaneLine: outerLaneLine,
          relatedLane: scope.editingRoadLaneItem as LaneItem,
          isStartCatmull: catmullIndex === 0,
          isEndCatmull: catmullIndex === outerCatmullPointsNum - 1,
          catmullIndex: catmullIndex,
        },
      );
    });
  }

  onOperateActionMesh(pickingInfo: PickingInfo, alignAltitude: number) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);

    if (!pickingInfo.pickedPoint) return;
    // escape outside road edit mode & move loop
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem || !scope.currentActionMesh || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;
    pickedPoint.y = alignAltitude;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) return;

    let meshPoint = pickedPoint;

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as ActionMeshMetadata;
    const actionMeshCategory = actionMeshMetadata.category;

    if (
      actionMeshCategory === ActionMeshCategory.LeftLaneWidthEdit ||
      actionMeshCategory === ActionMeshCategory.RightLaneWidthEdit
    ) {
      // use projection amount on normal direction for width edit
      const actionMeshRelatedLane = actionMeshMetadata.relatedLane as LaneItem;
      meshPoint = scope.resolveLaneWidthEditTargetPointViaActionMesh((scope.editingRoadItem as RoadItem), actionMeshRelatedLane, pickedPoint).targetPoint;
    } else if (
      actionMeshCategory === ActionMeshCategory.LeftLaneCatmullEdit ||
      actionMeshCategory === ActionMeshCategory.RightLaneCatmullEdit
    ) {
      const laneLineSide = (actionMeshMetadata.relatedLaneLine as LaneLineItem).laneLineSide;
      const laneLines = (actionMeshMetadata.relatedLane as LaneItem).laneLines;

      const catmullPoints = (laneLineSide === LaneLineSide.Inner) ? laneLines.innerLaneLine.catmullPoints : laneLines.outerLaneLine.catmullPoints;

      const actionMeshIsStartCatmull = actionMeshMetadata.isStartCatmull as boolean;
      const actionMeshIsEndCatmull = actionMeshMetadata.isEndCatmull as boolean;
      const actionMeshCatmullIndex = actionMeshMetadata.catmullIndex as number;

      if (actionMeshIsStartCatmull || actionMeshIsEndCatmull) {
        // use normal projection point in non-start/end catmull
        meshPoint = scope.resolveCatmullStartAndEndEditTargetPointViaActionMesh(
          scope.editingRoadItem,
          actionMeshMetadata,
          catmullPoints[actionMeshCatmullIndex],
          pickedPoint,
        );
      } else {
        // use regular point in non-start/end catmull
        meshPoint = pickedPoint;
      }
    }

    scope.updateActionMesh(scope.currentActionMesh.id, meshPoint);
  }

  onUnpickActionMesh(pickingInfo: PickingInfo, alignAltitude: number) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);

    if (!scope.editingRoadItem || !scope.editingRoadLaneItem || !scope.currentActionMesh || !pickingInfo.pickedPoint || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;
    pickedPoint.y = alignAltitude;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) {
      scope.currentActionMesh = null;
      scope.currentActionMeshInitPosition = null;

      return;
    }

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as ActionMeshMetadata;
    const actionMeshCategory = actionMeshMetadata.category;

    if (
      actionMeshCategory === ActionMeshCategory.LeftLaneWidthEdit ||
      actionMeshCategory === ActionMeshCategory.RightLaneWidthEdit
    ) {
      const actionMeshRelatedLane = actionMeshMetadata.relatedLane as LaneItem;
      const targetDistance = scope.resolveLaneWidthEditTargetPointViaActionMesh((scope.editingRoadItem as RoadItem), actionMeshRelatedLane, pickedPoint).targetDistance;

      scope.onUnpickActionMeshLaneWidthEdit(actionMeshMetadata, targetDistance);
    } else if (
      actionMeshCategory === ActionMeshCategory.LeftLaneCatmullEdit ||
      actionMeshCategory === ActionMeshCategory.RightLaneCatmullEdit
    ) {
      const laneLineSide = (actionMeshMetadata.relatedLaneLine as LaneLineItem).laneLineSide;
      const laneLines = (actionMeshMetadata.relatedLane as LaneItem).laneLines;

      const catmullPoints = (laneLineSide === LaneLineSide.Inner) ? laneLines.innerLaneLine.catmullPoints : laneLines.outerLaneLine.catmullPoints;

      const catmullTangents = (laneLineSide === LaneLineSide.Inner) ? laneLines.innerLaneLine.catmullTangents : laneLines.outerLaneLine.catmullTangents;

      const actionMeshIsStartCatmull = actionMeshMetadata.isStartCatmull as boolean;
      const actionMeshIsEndCatmull = actionMeshMetadata.isEndCatmull as boolean;
      const actionMeshCatmullIndex = actionMeshMetadata.catmullIndex as number;

      let newCatmullPoint = pickedPoint;

      if (actionMeshIsStartCatmull || actionMeshIsEndCatmull) {
        // use normal projection point in non-start/end catmull
        newCatmullPoint = scope.resolveCatmullStartAndEndEditTargetPointViaActionMesh(
          scope.editingRoadItem,
          actionMeshMetadata,
          catmullPoints[actionMeshCatmullIndex],
          pickedPoint,
        );
      } else {
        // use regular point in non-start/end catmull
        newCatmullPoint = pickedPoint;
      }

      const newLaneLineCatmullPoints = [...catmullPoints];
      newLaneLineCatmullPoints.splice(actionMeshCatmullIndex, 1, newCatmullPoint);

      const newLaneLineCatmullTangents = [...catmullTangents];

      scope.onUnpickActionMeshLaneCatmullEdit(actionMeshMetadata, newLaneLineCatmullPoints, newLaneLineCatmullTangents, actionMeshCatmullIndex);
    }

    // clear after one down-move-up loop, actionMesh is active only in every loop
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
  }

  onUnpickActionMeshLaneWidthEdit(actionMeshMetadata: ActionMeshMetadata, targetDistance: number) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem) return;

    const laneItem = actionMeshMetadata.relatedLane as LaneItem;
    const laneId = laneItem.laneId;
    const laneSide = laneItem.laneSide;

    if (scope.editingRoadItem.category === RoadCategory.CatmullSerieRoad) {
      const opts = {
        scope,
        targetDistance,
        laneId,
        laneSide,
        roadId: scope.editingRoadItem.roadId,
        roadCategory: scope.editingRoadItem.category,
      };

      const transaction = scope.createTransaction(TransactionType.LaneWidthEditCatmullSerieRoad, opts);
      scope.commitTransaction(transaction);
    }
  }

  onUnpickActionMeshLaneCatmullEdit(
    actionMeshMetadata: ActionMeshMetadata,
    newLaneLineCatmullPoints: Vector3[],
    newLaneLineCatmullTangents: Vector3[],
    actionMeshCatmullIndex: number,
  ) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem) return;

    const laneItem = actionMeshMetadata.relatedLane as LaneItem;
    const laneId = laneItem.laneId;
    const laneSide = laneItem.laneSide;
    const laneLineSide = (actionMeshMetadata.relatedLaneLine as LaneLineItem).laneLineSide;

    if (scope.editingRoadItem.category === RoadCategory.CatmullSerieRoad) {
      const opts = {
        scope,
        laneId,
        laneSide,
        laneLineSide,
        newLaneLineCatmullPoints,
        newLaneLineCatmullTangents,
        catmullIndex: actionMeshCatmullIndex,
        roadId: scope.editingRoadItem.roadId,
        roadCategory: scope.editingRoadItem.category,
      };

      const transaction = scope.createTransaction(TransactionType.CatmullEditCatmullSerieRoad, opts);
      scope.commitTransaction(transaction);
    }
  }

  onDeliverRoadLaneInnerAddCatmullPoint(pickedPoint: Vector3, belongingLaneLineItem: LaneLineItem) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem || !pickedPoint) return;

    const oldSeriePoints = belongingLaneLineItem.seriePoints;
    const virtualPointPostion = scope.resolveNearestVirtualPointPositionViaLineSeriePoints(oldSeriePoints, pickedPoint);
    const virtualPoint = scope.resolveNearestVirtualPointViaLineSeriePoints(oldSeriePoints, pickedPoint);

    const oldCatmullPoints = belongingLaneLineItem.catmullPoints;
    const oldCatmullPointsPosition = oldCatmullPoints.map((v: Vector3) => {
      return scope.resolveNearestVirtualPointPositionViaLineSeriePoints(oldSeriePoints, v);
    });

    const oldCatmullTangents = belongingLaneLineItem.catmullTangents;

    const sameCatmullPointIdx = oldCatmullPointsPosition.findIndex((v: number) => {
      return Math.abs(v - virtualPointPostion) <= RendererConfig.scene.minimumGeoPositionDiffAmount;
    });
    if (sameCatmullPointIdx > 0) return;

    const nextCatmullPointIdx = oldCatmullPointsPosition.findIndex((v: number) => {
      return v > virtualPointPostion;
    });
    if (nextCatmullPointIdx <= 0) return;

    const newLaneLineCatmullPoints = [...oldCatmullPoints];
    newLaneLineCatmullPoints.splice(nextCatmullPointIdx, 0, virtualPoint);

    const generatedRawCatmullTangents = scope.generateHermiteSerieLineCatmullTangentsViaCatmullPoints(newLaneLineCatmullPoints);
    const targetTangent = generatedRawCatmullTangents[nextCatmullPointIdx];

    const newLaneLineCatmullTangents = [...oldCatmullTangents];
    newLaneLineCatmullTangents.splice(nextCatmullPointIdx, 0, targetTangent);

    const opts = {
      scope,
      newLaneLineCatmullPoints,
      newLaneLineCatmullTangents,
      roadId: scope.editingRoadItem.roadId,
      roadCategory: scope.editingRoadItem.category,
      laneId: scope.editingRoadLaneItem.laneId,
      laneSide: scope.editingRoadLaneItem.laneSide,
      laneLineSide: belongingLaneLineItem.laneLineSide,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullAlterLaneCatmullSerieRoad, opts);
    scope.commitTransaction(transaction);
  }

  onDeliverRoadLaneInnerRemoveCatmullPoint(pickedPoint: Vector3, belongingLaneLineItem: LaneLineItem) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneEditorPlugin);
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem || !pickedPoint) return;

    const oldCatmullPoints = belongingLaneLineItem.catmullPoints;
    // at least two catmull points
    if (oldCatmullPoints.length <= 2) return;

    const oldCatmullTangents = belongingLaneLineItem.catmullTangents;

    const sameCatmullPointIdx = oldCatmullPoints.findIndex((v: Vector3) => {
      return v.subtract(pickedPoint).length() <= RendererConfig.scene.maximumSameCatmullPointDistance;
    });
    if (sameCatmullPointIdx < 0) return;

    // not first nor last
    if (sameCatmullPointIdx === 0) return;
    if (sameCatmullPointIdx === oldCatmullPoints.length - 1) return;

    const newLaneLineCatmullPoints = [...oldCatmullPoints];
    newLaneLineCatmullPoints.splice(sameCatmullPointIdx, 1);

    const newLaneLineCatmullTangents = [...oldCatmullTangents];
    newLaneLineCatmullTangents.splice(sameCatmullPointIdx, 1);

    const opts = {
      scope,
      newLaneLineCatmullPoints,
      newLaneLineCatmullTangents,
      roadId: scope.editingRoadItem.roadId,
      roadCategory: scope.editingRoadItem.category,
      laneId: scope.editingRoadLaneItem.laneId,
      laneSide: scope.editingRoadLaneItem.laneSide,
      laneLineSide: belongingLaneLineItem.laneLineSide,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullAlterLaneCatmullSerieRoad, opts);
    scope.commitTransaction(transaction);
  }
};