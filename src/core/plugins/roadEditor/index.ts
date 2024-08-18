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
  EnterEditingRoadItemEvent,
  ExitEditingRoadItemEvent,
  PickActionMeshEvent,
  OperateActionMeshEvent,
  UnpickActionMeshEvent,
  DeliverRoadExtendCatmullPointEvent,
  DeliverRoadInnerAddCatmullPointEvent,
  DeliverRoadInnerRemoveCatmullPointEvent
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
  InvokeRemoveTwoStraightLineRoadEvent,
  InvokeRemoveThreeCircleCurveRoadEvent,
  InvokeRemoveQuadraticBezierCurveRoadEvent,
  InvokeRemoveCubicBezierCurveRoadEvent,
  InvokeRemoveCatmullSerieRoadEvent,
  InvokeReformatTwoStraightLineRoadEvent,
  InvokeReformatThreeCircleCurveRoadEvent,
  InvokeReformatQuadraticBezierCurveRoadEvent,
  InvokeReformatCubicBezierCurveRoadEvent,
  InvokeReformatCatmullSerieRoadEvent,
  InvokeLaneWidthEditTwoStraightLineRoadEvent,
  InvokeLaneWidthEditThreeCircleCurveRoadEvent,
  InvokeLaneWidthEditQuadraticBezierCurveRoadEvent,
  InvokeLaneWidthEditCubicBezierCurveRoadEvent,
  InvokeLaneWidthEditCatmullSerieRoadEvent,
  InvokeAddLaneTwoStraightLineRoadEvent,
  InvokeAddLaneThreeCircleCurveRoadEvent,
  InvokeAddLaneQuadraticBezierCurveRoadEvent,
  InvokeAddLaneCubicBezierCurveRoadEvent,
  InvokeAddLaneCatmullSerieRoadEvent,
  InvokeRemoveLaneTwoStraightLineRoadEvent,
  InvokeRemoveLaneThreeCircleCurveRoadEvent,
  InvokeRemoveLaneQuadraticBezierCurveRoadEvent,
  InvokeRemoveLaneCubicBezierCurveRoadEvent,
  InvokeRemoveLaneCatmullSerieRoadEvent,
  InvokeCatmullEditTwoStraightLineRoadEvent,
  InvokeCatmullEditThreeCircleCurveRoadEvent,
  InvokeCatmullEditQuadraticBezierCurveRoadEvent,
  InvokeCatmullEditCubicBezierCurveRoadEvent,
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
  EnterRoadAltitudeAdaptorEvent,
  ExitRoadAltitudeAdaptorEvent,
} from '../roadAltitudeAdaptor/constant';

export default class RoadEditorPlugin extends LogicalPlugin {
  private editingRoadItem: RoadItem | null;
  private currentActionMesh: Mesh | null;
  private currentActionMeshInitPosition: Vector3 | null;
  private actionMeshes: { [id: string]: Mesh };
  private actionMeshIndex: number;

  constructor(options: PluginOptions) {
    super(options);

    this.editingRoadItem = null;
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
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);

    scope.registerEvent(EnterEditingRoadItemEvent);
    scope.onEvent(EnterEditingRoadItemEvent, (params: { payload: Object | string | number | null }) => {
      scope.unhighlightAllRoadsAndJunctions();

      scope.undecorateEditingRoadItem();

      scope.editingRoadItem = (params.payload as { roadItem: RoadItem }).roadItem;

      scope.highlightSingleRoad(scope.editingRoadItem.roadId, scope.editingRoadItem.category);
      
      scope.decorateEditingRoadItem();

      scope.emitEvent(EnterRoadAltitudeAdaptorEvent, { roadItem: scope.editingRoadItem });
    });

    scope.registerEvent(ExitEditingRoadItemEvent);
    scope.onEvent(ExitEditingRoadItemEvent, (params: { payload: Object | string | number | null }) => {
      scope.unhighlightAllRoadsAndJunctions();

      scope.undecorateEditingRoadItem();

      scope.emitEvent(ExitRoadAltitudeAdaptorEvent);
    });

    scope.registerEvent(PickActionMeshEvent);
    scope.onEvent(PickActionMeshEvent, (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      const pickedMesh = (params.payload as { pickedMesh: Mesh }).pickedMesh;
      if (!scope.isActionMesh(pickedMesh)) return;

      const actionMeshMetadata = pickedMesh.metadata as ActionMeshMetadata;
      const actionMeshCategory = actionMeshMetadata.category;
      const actionMeshPoint = actionMeshMetadata.point;

      // no movement on connected with as prev or next
      if (actionMeshCategory === ActionMeshCategory.RefLineCatmullReformat && (actionMeshMetadata.isStartCatmull || actionMeshMetadata.isEndCatmull)) {
        const connectedRoads = [...scope.editingRoadItem.prevRoads].concat([...scope.editingRoadItem.nextRoads]);

        const isConnected = connectedRoads.some((r: {
          roadId: string;
          roadCategory: RoadCategory;
        }) => {
          const roadItem = scope.resolveRoadByRoadIdAndRoadCategory(r.roadId, r.roadCategory) as RoadItem;
          const reflineSeriePoints = roadItem.referenceLine.seriePoints;

          return scope.isGeoConnectedPoint(actionMeshPoint, reflineSeriePoints[0]) || scope.isGeoConnectedPoint(actionMeshPoint, reflineSeriePoints[reflineSeriePoints.length - 1]);
        });

        if (isConnected) {
          scope.notifyInfo('不可移动在该处存在前驱/后继道路的道路关键点');
          return;
        }
      }

      scope.currentActionMesh = pickedMesh;
      scope.currentActionMeshInitPosition = pickedMesh.position;
    });

    scope.registerEvent(OperateActionMeshEvent);
    scope.onEvent(OperateActionMeshEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem || !scope.currentActionMesh) return;

      const pointerInfo = (params.payload as { pointerInfo: PointerInfo }).pointerInfo;
      const alignAltitude = scope.currentActionMesh.position.y;

      const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
        altitude: alignAltitude,
      });

      scope.onOperateActionMesh(pickingInfo, alignAltitude);
    });

    scope.registerEvent(UnpickActionMeshEvent);
    scope.onEvent(UnpickActionMeshEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem || !scope.currentActionMesh) return;

      const pointerInfo = (params.payload as { pointerInfo: PointerInfo }).pointerInfo;
      const alignAltitude = scope.currentActionMesh.position.y;

      const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
        altitude: alignAltitude,
      });

      scope.onUnpickActionMesh(pickingInfo, alignAltitude);
    });

    scope.registerEvent(DeliverRoadExtendCatmullPointEvent);
    scope.onEvent(DeliverRoadExtendCatmullPointEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      
      scope.onDeliverRoadExtendCatmullPoint(pickedPoint);
    });

    scope.registerEvent(DeliverRoadInnerAddCatmullPointEvent);
    scope.onEvent(DeliverRoadInnerAddCatmullPointEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      const belongingRoadItem = (params.payload as { belongingRoadItem: RoadItem }).belongingRoadItem;

      if (scope.editingRoadItem.roadId !== belongingRoadItem.roadId || scope.editingRoadItem.category !== belongingRoadItem.category) return;
      
      scope.onDeliverRoadInnerAddCatmullPoint(pickedPoint);
    });

    scope.registerEvent(DeliverRoadInnerRemoveCatmullPointEvent);
    scope.onEvent(DeliverRoadInnerRemoveCatmullPointEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      const belongingRoadItem = (params.payload as { belongingRoadItem: RoadItem }).belongingRoadItem;

      if (scope.editingRoadItem.roadId !== belongingRoadItem.roadId || scope.editingRoadItem.category !== belongingRoadItem.category) return;
      
      scope.onDeliverRoadInnerRemoveCatmullPoint(pickedPoint);
    });
  }

  initTransactionInvokedEvent() {
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);

    // exit if editing road is removed
    const clearRoadDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      const roadId = (params.payload as { roadId: string }).roadId;

      if (scope.editingRoadItem.roadId === roadId) {
        scope.exitEditRoad();
      }
    };

    scope.onEvent(InvokeRemoveTwoStraightLineRoadEvent, clearRoadDecorationCallback);
    scope.onEvent(InvokeRemoveThreeCircleCurveRoadEvent, clearRoadDecorationCallback);
    scope.onEvent(InvokeRemoveQuadraticBezierCurveRoadEvent, clearRoadDecorationCallback);
    scope.onEvent(InvokeRemoveCubicBezierCurveRoadEvent, clearRoadDecorationCallback);
    scope.onEvent(InvokeRemoveCatmullSerieRoadEvent, clearRoadDecorationCallback);


    // after editing, refresh decoration
    const refreshRoadDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      scope.emitEvent(EnterEditingRoadItemEvent, {
        roadItem: scope.resolveRoadByRoadIdAndRoadCategory(scope.editingRoadItem.roadId, scope.editingRoadItem.category) as RoadItem,
      });
    };

    scope.onEvent(InvokeReformatTwoStraightLineRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeReformatThreeCircleCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeReformatQuadraticBezierCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeReformatCubicBezierCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeReformatCatmullSerieRoadEvent, refreshRoadDecorationCallback);

    scope.onEvent(InvokeLaneWidthEditTwoStraightLineRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeLaneWidthEditThreeCircleCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeLaneWidthEditQuadraticBezierCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeLaneWidthEditCubicBezierCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeLaneWidthEditCatmullSerieRoadEvent, refreshRoadDecorationCallback);

    scope.onEvent(InvokeAddLaneTwoStraightLineRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeAddLaneThreeCircleCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeAddLaneQuadraticBezierCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeAddLaneCubicBezierCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeAddLaneCatmullSerieRoadEvent, refreshRoadDecorationCallback);

    scope.onEvent(InvokeRemoveLaneTwoStraightLineRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeRemoveLaneThreeCircleCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeRemoveLaneQuadraticBezierCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeRemoveLaneCubicBezierCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeRemoveLaneCatmullSerieRoadEvent, refreshRoadDecorationCallback);

    scope.onEvent(InvokeCatmullEditTwoStraightLineRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeCatmullEditThreeCircleCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeCatmullEditQuadraticBezierCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeCatmullEditCubicBezierCurveRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeCatmullEditCatmullSerieRoadEvent, refreshRoadDecorationCallback);

    scope.onEvent(InvokeCatmullAlterLaneCatmullSerieRoadEvent, refreshRoadDecorationCallback);

    scope.onEvent(InvokeCatmullExtendCatmullSerieRoadEvent, refreshRoadDecorationCallback);

    scope.onEvent(InvokeRoadTransparencyEditEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeRoadAttributeEditEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeRoadLaneAttributeEditEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeRoadLaneLineInnerAttributeEditEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeRoadLaneLineOuterAttributeEditEvent, refreshRoadDecorationCallback);

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
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);
    if (!scope.editingRoadItem) return false;

    return !!(pickedMesh?.metadata?.isActionMesh);
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
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);

    const id = `Road_Editor_Action_Mesh_${scope.actionMeshIndex}`;
    const actionMesh = scope.createMarker(point, color, id) as Mesh;
    actionMesh.metadata = {
      isActionMesh: true,
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
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);

    const oldMesh = scope.actionMeshes[id];
    if (!oldMesh) return;
    const oldMetadata = oldMesh.metadata as ActionMeshMetadata;

    const actionMesh = scope.createMarker(point, oldMetadata.color, id) as Mesh;
    actionMesh.metadata = {
      isActionMesh: true,
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

  undecorateEditingRoadItem() {
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);

    const ids = Object.keys(scope.actionMeshes);
    ids.forEach((id: string) => {
      scope.actionMeshes[id].dispose();
    });

    scope.editingRoadItem = null;
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
    scope.actionMeshes = {};

    scope.makeSceneDirty();
  }

  decorateEditingRoadItem() {
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);
    if (!scope.editingRoadItem) return;

    scope.decorateRefLineCatmullReformat();

    scope.makeSceneDirty();
  }

  decorateRefLineCatmullReformat() {
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);
    if (!scope.editingRoadItem) return;

    if (scope.editingRoadItem.referenceLineEditable) {
      const referenceLine = scope.editingRoadItem.referenceLine;
      const catmullPoints = referenceLine.catmullPoints;
      const numCatmullPoints = catmullPoints.length;

      catmullPoints.forEach((p: Vector3, catmullIndex: number) => {
        scope.createActionMesh(
          p,
          RendererConfig.mesh.reflineMarkerColor,
          ActionMeshCategory.RefLineCatmullReformat,
          {
            relatedRefLine: referenceLine,
            isStartCatmull: catmullIndex === 0,
            isEndCatmull: catmullIndex === numCatmullPoints - 1,
            catmullIndex: catmullIndex,
          },
        );
      });
    }
  }

  onOperateActionMesh(pickingInfo: PickingInfo, alignAltitude: number) {
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);

    if (!pickingInfo.pickedPoint) return;
    // escape outside road edit mode & move loop
    if (!scope.editingRoadItem || !scope.currentActionMesh || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;
    pickedPoint.y = alignAltitude;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) return;

    let meshPoint = pickedPoint;

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as ActionMeshMetadata;
    const actionMeshCategory = actionMeshMetadata.category;

    if (
      actionMeshCategory === ActionMeshCategory.RefLineCatmullReformat
    ) {
      meshPoint = pickedPoint;
    }

    scope.updateActionMesh(scope.currentActionMesh.id, meshPoint);
  }

  onUnpickActionMesh(pickingInfo: PickingInfo, alignAltitude: number) {
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);

    if (!scope.editingRoadItem || !scope.currentActionMesh || !pickingInfo.pickedPoint || !scope.currentActionMeshInitPosition) return;

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
      actionMeshCategory === ActionMeshCategory.RefLineCatmullReformat
    ) {
      const catmullPoints = (actionMeshMetadata.relatedRefLine as ReferenceLineItem).catmullPoints;
      const catmullTangents = (actionMeshMetadata.relatedRefLine as ReferenceLineItem).catmullTangents;

      const actionMeshCatmullIndex = actionMeshMetadata.catmullIndex as number;
      const newCatmullPoint = pickedPoint;

      const newRefLineCatmullPoints = [...catmullPoints];
      newRefLineCatmullPoints.splice(actionMeshCatmullIndex, 1, newCatmullPoint);

      const newRefLineCatmullTangents = [...catmullTangents];

      scope.onUnpickActionMeshRefLineCatmullReformat(actionMeshMetadata, newRefLineCatmullPoints, newRefLineCatmullTangents);
    }

    // clear after one down-move-up loop, actionMesh is active only in every loop
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
  }

  onUnpickActionMeshRefLineCatmullReformat(
    actionMeshMetadata: ActionMeshMetadata,
    newRefLineCatmullPoints: Vector3[],
    newRefLineCatmullTangents: Vector3[],
  ) {
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);
    if (!scope.editingRoadItem) return;

    const isStartCatmull = !!actionMeshMetadata.isStartCatmull;
    const isEndCatmull = !!actionMeshMetadata.isEndCatmull;

    if (scope.editingRoadItem.category === RoadCategory.TwoStraightLineRoad) {
      const opts = {
        scope,
        newRefLineCatmullPoints,
        newRefLineCatmullTangents,
        isStartCatmull,
        isEndCatmull,
        roadId: scope.editingRoadItem.roadId,
        roadCategory: scope.editingRoadItem.category,
      };

      const transaction = scope.createTransaction(TransactionType.CatmullReformatTwoStraightLineRoad, opts);
      scope.commitTransaction(transaction);
    } else if (scope.editingRoadItem.category === RoadCategory.ThreeCircleCurveRoad) {
      const opts = {
        scope,
        newRefLineCatmullPoints,
        newRefLineCatmullTangents,
        isStartCatmull,
        isEndCatmull,
        roadId: scope.editingRoadItem.roadId,
        roadCategory: scope.editingRoadItem.category,
      };

      const transaction = scope.createTransaction(TransactionType.CatmullReformatThreeCircleCurveRoad, opts);
      scope.commitTransaction(transaction);
    } else if (scope.editingRoadItem.category === RoadCategory.QuadraticBezierCurveRoad) {
      const opts = {
        scope,
        newRefLineCatmullPoints,
        newRefLineCatmullTangents,
        isStartCatmull,
        isEndCatmull,
        roadId: scope.editingRoadItem.roadId,
        roadCategory: scope.editingRoadItem.category,
      };

      const transaction = scope.createTransaction(TransactionType.CatmullReformatQuadraticBezierCurveRoad, opts);
      scope.commitTransaction(transaction);
    } else if (scope.editingRoadItem.category === RoadCategory.CubicBezierCurveRoad) {
      const opts = {
        scope,
        newRefLineCatmullPoints,
        newRefLineCatmullTangents,
        isStartCatmull,
        isEndCatmull,
        roadId: scope.editingRoadItem.roadId,
        roadCategory: scope.editingRoadItem.category,
      };

      const transaction = scope.createTransaction(TransactionType.CatmullReformatCubicBezierCurveRoad, opts);
      scope.commitTransaction(transaction);
    } else if (scope.editingRoadItem.category === RoadCategory.CatmullSerieRoad) {
      const opts = {
        scope,
        newRefLineCatmullPoints,
        newRefLineCatmullTangents,
        isStartCatmull,
        isEndCatmull,
        roadId: scope.editingRoadItem.roadId,
        roadCategory: scope.editingRoadItem.category,
      };

      const transaction = scope.createTransaction(TransactionType.CatmullReformatCatmullSerieRoad, opts);
      scope.commitTransaction(transaction);
    }
  }

  onDeliverRoadExtendCatmullPoint(pickedPoint: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);
    if (!scope.editingRoadItem || !pickedPoint) return;

    // CatmullSerieRoad only
    if (scope.editingRoadItem.category !== RoadCategory.CatmullSerieRoad) return;

    const oldCatmullPoints = scope.editingRoadItem.referenceLine.catmullPoints;
    const newRefLineCatmullPoints = [...oldCatmullPoints, pickedPoint];

    const opts = {
      scope,
      newRefLineCatmullPoints,
      roadId: scope.editingRoadItem.roadId,
      roadCategory: scope.editingRoadItem.category,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullExtendCatmullSerieRoad, opts);
    scope.commitTransaction(transaction);
  }

  onDeliverRoadInnerAddCatmullPoint(pickedPoint: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);
    if (!scope.editingRoadItem || !pickedPoint) return;

    // CatmullSerieRoad only
    if (scope.editingRoadItem.category !== RoadCategory.CatmullSerieRoad) return;

    const oldSeriePoints = scope.editingRoadItem.referenceLine.seriePoints;
    const virtualPointPostion = scope.resolveNearestVirtualPointPositionViaLineSeriePoints(oldSeriePoints, pickedPoint);
    const virtualPoint = scope.resolveNearestVirtualPointViaLineSeriePoints(oldSeriePoints, pickedPoint);

    const oldCatmullPoints = scope.editingRoadItem.referenceLine.catmullPoints;
    const oldCatmullPointsPosition = oldCatmullPoints.map((v: Vector3) => {
      return scope.resolveNearestVirtualPointPositionViaLineSeriePoints(oldSeriePoints, v);
    });

    const oldCatmullTangents = scope.editingRoadItem.referenceLine.catmullTangents;

    const sameCatmullPointIdx = oldCatmullPointsPosition.findIndex((v: number) => {
      return Math.abs(v - virtualPointPostion) <= RendererConfig.scene.minimumGeoPositionDiffAmount;
    });
    if (sameCatmullPointIdx > 0) return;

    const nextCatmullPointIdx = oldCatmullPointsPosition.findIndex((v: number) => {
      return v > virtualPointPostion;
    });
    if (nextCatmullPointIdx <= 0) return;

    const newRefLineCatmullPoints = [...oldCatmullPoints];
    newRefLineCatmullPoints.splice(nextCatmullPointIdx, 0, virtualPoint);

    const generatedRawCatmullTangents = scope.generateHermiteSerieLineCatmullTangentsViaCatmullPoints(newRefLineCatmullPoints);
    const targetTangent = generatedRawCatmullTangents[nextCatmullPointIdx];

    const newRefLineCatmullTangents = [...oldCatmullTangents];
    newRefLineCatmullTangents.splice(nextCatmullPointIdx, 0, targetTangent);

    const opts = {
      scope,
      newRefLineCatmullPoints,
      newRefLineCatmullTangents,
      isStartCatmull: false,
      isEndCatmull: false,
      roadId: scope.editingRoadItem.roadId,
      roadCategory: scope.editingRoadItem.category,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullReformatCatmullSerieRoad, opts);
    scope.commitTransaction(transaction);
  }

  onDeliverRoadInnerRemoveCatmullPoint(pickedPoint: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadEditorPlugin);
    if (!scope.editingRoadItem || !pickedPoint) return;

    // CatmullSerieRoad only
    if (scope.editingRoadItem.category !== RoadCategory.CatmullSerieRoad) return;

    const oldCatmullPoints = scope.editingRoadItem.referenceLine.catmullPoints;
    // at least two catmull points
    if (oldCatmullPoints.length <= 2) return;

    const oldCatmullTangents = scope.editingRoadItem.referenceLine.catmullTangents;

    const sameCatmullPointIdx = oldCatmullPoints.findIndex((v: Vector3) => {
      return v.subtract(pickedPoint).length() <= RendererConfig.scene.maximumSameCatmullPointDistance;
    });
    if (sameCatmullPointIdx < 0) return;

    const newRefLineCatmullPoints = [...oldCatmullPoints];
    newRefLineCatmullPoints.splice(sameCatmullPointIdx, 1);

    const newRefLineCatmullTangents = [...oldCatmullTangents];
    newRefLineCatmullTangents.splice(sameCatmullPointIdx, 1);

    const opts = {
      scope,
      newRefLineCatmullPoints,
      newRefLineCatmullTangents,
      isStartCatmull: sameCatmullPointIdx === 0,
      isEndCatmull: sameCatmullPointIdx === oldCatmullPoints.length - 1,
      roadId: scope.editingRoadItem.roadId,
      roadCategory: scope.editingRoadItem.category,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullReformatCatmullSerieRoad, opts);
    scope.commitTransaction(transaction);
  }
};