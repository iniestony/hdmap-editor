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
  EnterEditingRoadConnectionLaneItemEvent,
  ExitEditingRoadConnectionLaneItemEvent,
  PickConnectionLaneActionMeshEvent,
  OperateConnectionLaneActionMeshEvent,
  UnpickConnectionLaneActionMeshEvent,
  PickPrevAndNextConnectionLaneVertexEvent,
  CleanPickedPrevAndNextConnectionLaneVertexEvent,
  DeliverRoadConnectionLaneInnerAddCatmullPointEvent,
  DeliverRoadConnectionLaneInnerRemoveCatmullPointEvent,
} from './constant';
import {
  ConnectionLaneActionMeshCategory,
  ConnectionLaneActionMeshMetadata,
  PrevAndNextConnectionLaneCategory,
  PrevAndNextConnectionLaneVertexMetadata,
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
  InvokeRemoveConnectionRoadEvent,
  InvokeReformatConnectionRoadEvent,
  InvokeCatmullEditConnectionRoadEvent,
  InvokeCatmullAlterLaneConnectionRoadEvent,
  InvokeLanePrevNextEditConnectionRoadEvent,
  InvokeAddLaneConnectionRoadEvent,
  InvokeRemoveLaneConnectionRoadEvent,
  InvokeRoadConnectionTransparencyEditEvent,
  InvokeRoadConnectionAttributeEditEvent,
  InvokeRoadConnectionLaneAttributeEditEvent,
  InvokeRoadConnectionLaneInnerAttributeEditEvent,
  InvokeRoadConnectionLaneOuterAttributeEditEvent,
  InvokeRoadLaneLineSeriePointsOnlyPostInvalidEvent,
  InvokeRoadLaneLineSeriePointsPreAndPostInvalidEvent,
} from '../../transactions/event'

export default class RoadConnectionLaneEditorPlugin extends LogicalPlugin {
  private editingRoadConnectionItem: RoadItem | null;
  private editingRoadConnectionLaneItem: LaneItem | null;
  private currentActionMesh: Mesh | null;
  private currentActionMeshInitPosition: Vector3 | null;
  private actionMeshes: { [id: string]: Mesh };
  private actionMeshIndex: number;

  private laneVertices: { [id: string]: Mesh };
  private laneVertexIndex: number;
  private firstLaneVertex?: {
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
    laneVertexCategory: PrevAndNextConnectionLaneCategory;
  };
  private secondLaneVertex?: {
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
    laneVertexCategory: PrevAndNextConnectionLaneCategory;
  };
  private connectionLaneVertex?: {
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
    laneVertexCategory: PrevAndNextConnectionLaneCategory;
  };

  constructor(options: PluginOptions) {
    super(options);

    this.editingRoadConnectionItem = null;
    this.editingRoadConnectionLaneItem = null;
    this.currentActionMesh = null;
    this.currentActionMeshInitPosition = null;
    this.actionMeshes = {};
    this.actionMeshIndex = 0;

    this.laneVertices = {};
    this.laneVertexIndex = 0;
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
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);
    scope.registerEvent(EnterEditingRoadConnectionLaneItemEvent);
    scope.onEvent(EnterEditingRoadConnectionLaneItemEvent, (params: { payload: Object | string | number | null }) => {
      scope.unhighlightAllRoadsAndJunctions();

      scope.undecorateEditingLaneItem();

      scope.editingRoadConnectionItem = (params.payload as { roadItem: RoadItem }).roadItem;
      scope.editingRoadConnectionLaneItem = (params.payload as { laneItem: LaneItem }).laneItem;

      scope.highlightSingleLane(scope.editingRoadConnectionLaneItem.laneId, scope.editingRoadConnectionItem.roadId, scope.editingRoadConnectionItem.category);

      scope.decorateEditingLaneItem();

      scope.undecoratePrevAndNextLaneVertices();
      scope.decoratePrevAndNextLaneVertices();
    });

    scope.registerEvent(ExitEditingRoadConnectionLaneItemEvent);
    scope.onEvent(ExitEditingRoadConnectionLaneItemEvent, (params: { payload: Object | string | number | null }) => {
      scope.unhighlightAllRoadsAndJunctions();

      scope.undecorateEditingLaneItem();

      scope.undecoratePrevAndNextLaneVertices();
    });

    scope.registerEvent(PickConnectionLaneActionMeshEvent);
    scope.onEvent(PickConnectionLaneActionMeshEvent, (params: { payload: Object | string | number | null }) => {
      const pickedMesh = (params.payload as { pickedMesh: Mesh }).pickedMesh;
      if (!scope.isActionMesh(pickedMesh)) return;

      scope.currentActionMesh = pickedMesh;
      scope.currentActionMeshInitPosition = pickedMesh.position;
    });

    scope.registerEvent(OperateConnectionLaneActionMeshEvent);
    scope.onEvent(OperateConnectionLaneActionMeshEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadConnectionItem || !scope.editingRoadConnectionLaneItem || !scope.currentActionMesh) return;

      const pointerInfo = (params.payload as { pointerInfo: PointerInfo }).pointerInfo;
      const alignAltitude = scope.currentActionMesh.position.y;

      const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
        altitude: alignAltitude,
      });

      scope.onOperateActionMesh(pickingInfo, alignAltitude);
    });


    scope.registerEvent(UnpickConnectionLaneActionMeshEvent);
    scope.onEvent(UnpickConnectionLaneActionMeshEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadConnectionItem || !scope.editingRoadConnectionLaneItem || !scope.currentActionMesh) return;

      const pointerInfo = (params.payload as { pointerInfo: PointerInfo }).pointerInfo;
      const alignAltitude = scope.currentActionMesh.position.y;

      const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
        altitude: alignAltitude,
      });

      scope.onUnpickActionMesh(pickingInfo, alignAltitude);
    });

    scope.registerEvent(PickPrevAndNextConnectionLaneVertexEvent);
    scope.onEvent(PickPrevAndNextConnectionLaneVertexEvent, (params: { payload: Object | string | number | null }) => {
      const pickedMesh = (params.payload as { pickedMesh: Mesh }).pickedMesh;
      if (!scope.isPrevAndNextConnectionLaneVertex(pickedMesh)) return;

      const metadata = pickedMesh.metadata as PrevAndNextConnectionLaneVertexMetadata;

      if (scope.connectionLaneVertex === undefined) {
        scope.unpickAllPrevAndNextLaneVertices();
        scope.pickPrevAndNextLaneVertex(pickedMesh);

        scope.connectionLaneVertex = {
          laneId: metadata.laneItem.laneId,
          roadId: metadata.roadItem.roadId,
          roadCategory: metadata.roadItem.category,
          laneVertexCategory: metadata.category,
        };

        scope.decorateConnectionPrevAndNextLanes();
      } else if (scope.firstLaneVertex === undefined) {
        scope.pickPrevAndNextLaneVertex(pickedMesh);

        scope.firstLaneVertex = {
          laneId: metadata.laneItem.laneId,
          roadId: metadata.roadItem.roadId,
          roadCategory: metadata.roadItem.category,
          laneVertexCategory: metadata.category,
        };
      } else if (scope.secondLaneVertex === undefined) {
        scope.pickPrevAndNextLaneVertex(pickedMesh);

        scope.secondLaneVertex = {
          laneId: metadata.laneItem.laneId,
          roadId: metadata.roadItem.roadId,
          roadCategory: metadata.roadItem.category,
          laneVertexCategory: metadata.category,
        };

        scope.editConnectionLanePrevAndNext();
      }
    });

    scope.registerEvent(CleanPickedPrevAndNextConnectionLaneVertexEvent);
    scope.onEvent(CleanPickedPrevAndNextConnectionLaneVertexEvent, (params: { payload: Object | string | number | null }) => {
      scope.undecoratePrevAndNextLaneVertices();
      scope.decoratePrevAndNextLaneVertices();
    });

    scope.registerEvent(DeliverRoadConnectionLaneInnerAddCatmullPointEvent);
    scope.onEvent(DeliverRoadConnectionLaneInnerAddCatmullPointEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadConnectionItem || !scope.editingRoadConnectionLaneItem) return;

      const d_editingRoadConnectionItem = scope.editingRoadConnectionItem as RoadItem;
      const d_editingRoadConnectionLaneItem = scope.editingRoadConnectionLaneItem as LaneItem;

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
        return d_editingRoadConnectionItem.roadId === laneLineItem.belongingRoadItem.roadId && d_editingRoadConnectionItem.category === laneLineItem.belongingRoadItem.category && d_editingRoadConnectionLaneItem.laneId === laneLineItem.belongingLaneItem.laneId;
      });

      if (!targetLaneLineItem) return;

      const pickedPoint = targetLaneLineItem.pickedPoint;
      const belongingRoadItem = targetLaneLineItem.belongingRoadItem;
      const belongingLaneItem = targetLaneLineItem.belongingLaneItem;
      const belongingLaneLineItem = targetLaneLineItem.belongingLaneLineItem;
      
      scope.onDeliverRoadConnectionLaneInnerAddCatmullPoint(pickedPoint, belongingLaneLineItem);
    });

    scope.registerEvent(DeliverRoadConnectionLaneInnerRemoveCatmullPointEvent);
    scope.onEvent(DeliverRoadConnectionLaneInnerRemoveCatmullPointEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadConnectionItem || !scope.editingRoadConnectionLaneItem) return;

      const d_editingRoadConnectionItem = scope.editingRoadConnectionItem as RoadItem;
      const d_editingRoadConnectionLaneItem = scope.editingRoadConnectionLaneItem as LaneItem;

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
        return d_editingRoadConnectionItem.roadId === laneLineItem.belongingRoadItem.roadId && d_editingRoadConnectionItem.category === laneLineItem.belongingRoadItem.category && d_editingRoadConnectionLaneItem.laneId === laneLineItem.belongingLaneItem.laneId;
      });

      if (!targetLaneLineItem) return;

      const pickedPoint = targetLaneLineItem.pickedPoint;
      const belongingLaneLineItem = targetLaneLineItem.belongingLaneLineItem;
      
      scope.onDeliverRoadConnectionLaneInnerRemoveCatmullPoint(pickedPoint, belongingLaneLineItem);
    });
  }

  initTransactionInvokedEvent() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);

    // exit if editing lane is removed
    const clearRoadConnectionLaneDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadConnectionLaneItem) return;

      const laneId = (params.payload as { laneId: string }).laneId;
      if (scope.editingRoadConnectionLaneItem.laneId === laneId) {
        scope.exitEditRoadConnectionLane();
      }
    };

    scope.onEvent(InvokeRemoveLaneConnectionRoadEvent, clearRoadConnectionLaneDecorationCallback);

    const clearRoadDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadConnectionItem) return;

      const roadId = (params.payload as { roadId: string }).roadId;
      if (scope.editingRoadConnectionItem.roadId === roadId) {
        scope.exitEditRoadConnectionLane();
      }
    };

    scope.onEvent(InvokeRemoveConnectionRoadEvent, clearRoadDecorationCallback);

    // after editing, refresh decoration
    const refreshRoadConnectionLaneDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadConnectionItem || !scope.editingRoadConnectionLaneItem) return;

      scope.emitEvent(EnterEditingRoadConnectionLaneItemEvent, {
        roadItem: scope.resolveRoadByRoadIdAndRoadCategory(scope.editingRoadConnectionItem.roadId, scope.editingRoadConnectionItem.category) as RoadItem,
        laneItem: scope.resolveLaneByLaneRoadIdAndRoadCategory(scope.editingRoadConnectionLaneItem.laneId, scope.editingRoadConnectionItem.roadId, scope.editingRoadConnectionItem.category) as LaneItem,
      });
    };

    scope.onEvent(InvokeReformatConnectionRoadEvent, refreshRoadConnectionLaneDecorationCallback);
    scope.onEvent(InvokeCatmullEditConnectionRoadEvent, refreshRoadConnectionLaneDecorationCallback);
    scope.onEvent(InvokeCatmullAlterLaneConnectionRoadEvent, refreshRoadConnectionLaneDecorationCallback);
    scope.onEvent(InvokeLanePrevNextEditConnectionRoadEvent, refreshRoadConnectionLaneDecorationCallback);
    scope.onEvent(InvokeAddLaneConnectionRoadEvent, refreshRoadConnectionLaneDecorationCallback);
    scope.onEvent(InvokeRemoveLaneConnectionRoadEvent, refreshRoadConnectionLaneDecorationCallback);
    scope.onEvent(InvokeRoadConnectionTransparencyEditEvent, refreshRoadConnectionLaneDecorationCallback);
    scope.onEvent(InvokeRoadConnectionAttributeEditEvent, refreshRoadConnectionLaneDecorationCallback);
    scope.onEvent(InvokeRoadConnectionLaneAttributeEditEvent, refreshRoadConnectionLaneDecorationCallback);
    scope.onEvent(InvokeRoadConnectionLaneInnerAttributeEditEvent, refreshRoadConnectionLaneDecorationCallback);
    scope.onEvent(InvokeRoadConnectionLaneOuterAttributeEditEvent, refreshRoadConnectionLaneDecorationCallback);

    // unexpected lane lines
    const roadLaneLineOnlyPostInvalidCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadConnectionItem) return;

      const roadId = (params.payload as { roadId: string }).roadId;

      if (scope.editingRoadConnectionItem.roadId === roadId) {
        scope.alertUnexpectedRoadLaneLineSeriePointsOnlyPost();
      }
    };

    scope.onEvent(InvokeRoadLaneLineSeriePointsOnlyPostInvalidEvent, roadLaneLineOnlyPostInvalidCallback);

    const roadLaneLinePreAndPostInvalidCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadConnectionItem) return;

      const roadId = (params.payload as { roadId: string }).roadId;

      if (scope.editingRoadConnectionItem.roadId === roadId) {
        scope.alertUnexpectedRoadLaneLineSeriePointsPreAndPost();
      }
    };

    scope.onEvent(InvokeRoadLaneLineSeriePointsPreAndPostInvalidEvent, roadLaneLinePreAndPostInvalidCallback);
  }

  isActionMesh(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);
    if (!scope.editingRoadConnectionLaneItem) return false;

    return !!(pickedMesh?.metadata?.isConnectionLaneActionMesh);
  }

  isPrevAndNextConnectionLaneVertex(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);

    return !!(pickedMesh?.metadata?.isPrevAndNextConnectionLaneVertex);
  }

  createActionMesh(
    point: Vector3,
    color: Color3,
    category: ConnectionLaneActionMeshCategory,
    extra: {
      relatedRefLine?: ReferenceLineItem;
      relatedLaneLine?: LaneLineItem;
      relatedLane?: LaneItem;
      isStartCatmull?: boolean;
      isEndCatmull?: boolean;
      catmullIndex?: number;
    },
  ) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);

    const id = `Road_Connection_lane_Editor_Action_Mesh_${scope.actionMeshIndex}`;
    const actionMesh = scope.createMarker(point, color, id) as Mesh;
    actionMesh.metadata = {
      isConnectionLaneActionMesh: true,
      point,
      color,
      category,
      relatedRefLine: extra.relatedRefLine,
      relatedLaneLine: extra.relatedLaneLine,
      relatedLane: extra.relatedLane,
      isStartCatmull: extra.isStartCatmull,
      isEndCatmull: extra.isEndCatmull,
      catmullIndex: extra.catmullIndex,
    } as ConnectionLaneActionMeshMetadata;

    scope.actionMeshIndex++;
    scope.actionMeshes[id] = actionMesh;

    scope.makeSceneDirty();
  }

  updateActionMesh(id: string, point: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);

    const oldMesh = scope.actionMeshes[id];
    if (!oldMesh) return;
    const oldMetadata = oldMesh.metadata as ConnectionLaneActionMeshMetadata;

    const actionMesh = scope.createMarker(point, oldMetadata.color, id) as Mesh;
    actionMesh.metadata = {
      isConnectionLaneActionMesh: true,
      point,
      color: oldMetadata.color,
      category: oldMetadata.category,
      relatedRefLine: oldMetadata.relatedRefLine,
      relatedLaneLine: oldMetadata.relatedLaneLine,
      relatedLane: oldMetadata.relatedLane,
      isStartCatmull: oldMetadata.isStartCatmull,
      isEndCatmull: oldMetadata.isEndCatmull,
      catmullIndex: oldMetadata.catmullIndex,
    } as ConnectionLaneActionMeshMetadata;

    oldMesh.dispose();

    scope.currentActionMesh = actionMesh;
    scope.actionMeshes[id] = actionMesh;

    scope.makeSceneDirty();
  }

  undecorateEditingLaneItem() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);

    const ids = Object.keys(scope.actionMeshes);
    ids.forEach((id: string) => {
      scope.actionMeshes[id].dispose();
    });

    scope.editingRoadConnectionItem = null;
    scope.editingRoadConnectionLaneItem = null;
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
    scope.actionMeshes = {};

    scope.makeSceneDirty();
  }

  decorateEditingLaneItem() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);
    if (!scope.editingRoadConnectionItem || !scope.editingRoadConnectionLaneItem) return;

    scope.decorateLaneCatmullEdit();

    scope.makeSceneDirty();
  }

  decorateLaneCatmullEdit() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);
    if (!scope.editingRoadConnectionItem || !scope.editingRoadConnectionLaneItem) return;

    const laneSide = scope.editingRoadConnectionLaneItem.laneSide;

    const innerLaneLine = scope.editingRoadConnectionLaneItem.laneLines.innerLaneLine;
    const outerLaneLine = scope.editingRoadConnectionLaneItem.laneLines.outerLaneLine;
    const innerCatmullPoints = innerLaneLine.catmullPoints;
    const outerCatmullPoints = outerLaneLine.catmullPoints;
    const innerCatmullPointsNum = innerCatmullPoints.length;
    const outerCatmullPointsNum = outerCatmullPoints.length;

    innerCatmullPoints.forEach((p: Vector3, catmullIndex: number) => {
      scope.createActionMesh(
        p,
        RendererConfig.mesh.laneLineCatmullMarkerColor,
        laneSide === LaneSide.Left ? ConnectionLaneActionMeshCategory.LeftLaneCatmullEdit : ConnectionLaneActionMeshCategory.RightLaneCatmullEdit,
        {
          relatedLaneLine: innerLaneLine,
          relatedLane: scope.editingRoadConnectionLaneItem as LaneItem,
          isStartCatmull: catmullIndex === 0,
          isEndCatmull: catmullIndex === innerCatmullPointsNum - 1,
          catmullIndex: catmullIndex,
        },
      );
    });

    outerCatmullPoints.forEach((p: Vector3, catmullIndex: number) => {
      scope.createActionMesh(
        p,
        RendererConfig.mesh.laneLineCatmullMarkerColor,
        laneSide === LaneSide.Left ? ConnectionLaneActionMeshCategory.LeftLaneCatmullEdit : ConnectionLaneActionMeshCategory.RightLaneCatmullEdit,
        {
          relatedLaneLine: outerLaneLine,
          relatedLane: scope.editingRoadConnectionLaneItem as LaneItem,
          isStartCatmull: catmullIndex === 0,
          isEndCatmull: catmullIndex === outerCatmullPointsNum - 1,
          catmullIndex: catmullIndex,
        },
      );
    });
  }

  onOperateActionMesh(pickingInfo: PickingInfo, alignAltitude: number) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);

    if (!pickingInfo.pickedPoint) return;
    // escape outside road edit mode & move loop
    if (!scope.editingRoadConnectionItem || !scope.editingRoadConnectionLaneItem || !scope.currentActionMesh || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;
    pickedPoint.y = alignAltitude;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) return;

    let meshPoint = pickedPoint;

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as ConnectionLaneActionMeshMetadata;
    const actionMeshCategory = actionMeshMetadata.category;

    if (
      actionMeshCategory === ConnectionLaneActionMeshCategory.LeftLaneCatmullEdit ||
      actionMeshCategory === ConnectionLaneActionMeshCategory.RightLaneCatmullEdit
    ) {
      if (!actionMeshMetadata.isStartCatmull && !actionMeshMetadata.isEndCatmull) {
        meshPoint = pickedPoint;

        scope.updateActionMesh(scope.currentActionMesh.id, meshPoint);
      }
    }
  }

  onUnpickActionMesh(pickingInfo: PickingInfo, alignAltitude: number) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);

    if (!scope.editingRoadConnectionItem || !scope.currentActionMesh || !pickingInfo.pickedPoint || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;
    pickedPoint.y = alignAltitude;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) {
      scope.currentActionMesh = null;
      scope.currentActionMeshInitPosition = null;

      return;
    }

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as ConnectionLaneActionMeshMetadata;
    const actionMeshCategory = actionMeshMetadata.category;

    if (
      actionMeshCategory === ConnectionLaneActionMeshCategory.LeftLaneCatmullEdit ||
      actionMeshCategory === ConnectionLaneActionMeshCategory.RightLaneCatmullEdit
    ) {
      if (!actionMeshMetadata.isStartCatmull && !actionMeshMetadata.isEndCatmull) {
        const laneLineSide = (actionMeshMetadata.relatedLaneLine as LaneLineItem).laneLineSide;
        const laneLines = (actionMeshMetadata.relatedLane as LaneItem).laneLines;

        const catmullPoints = (laneLineSide === LaneLineSide.Inner) ? laneLines.innerLaneLine.catmullPoints : laneLines.outerLaneLine.catmullPoints;

        const catmullTangents = (laneLineSide === LaneLineSide.Inner) ? laneLines.innerLaneLine.catmullTangents : laneLines.outerLaneLine.catmullTangents;

        const actionMeshCatmullIndex = actionMeshMetadata.catmullIndex as number;

        let newCatmullPoint = pickedPoint;

        const newLaneLineCatmullPoints = [...catmullPoints];
        newLaneLineCatmullPoints.splice(actionMeshCatmullIndex, 1, newCatmullPoint);

        const newLaneLineCatmullTangents = [...catmullTangents];

        scope.onUnpickActionMeshLaneCatmullEdit(actionMeshMetadata, newLaneLineCatmullPoints, newLaneLineCatmullTangents, actionMeshCatmullIndex);
      }
    }

    // clear after one down-move-up loop, actionMesh is active only in every loop
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
  }

  onUnpickActionMeshLaneCatmullEdit(
    actionMeshMetadata: ConnectionLaneActionMeshMetadata,
    newLaneLineCatmullPoints: Vector3[],
    newLaneLineCatmullTangents: Vector3[],
    actionMeshCatmullIndex: number,
  ) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);
    if (!scope.editingRoadConnectionItem || !scope.editingRoadConnectionLaneItem) return;

    const laneItem = actionMeshMetadata.relatedLane as LaneItem;
    const laneId = laneItem.laneId;
    const laneSide = laneItem.laneSide;
    const laneLineSide = (actionMeshMetadata.relatedLaneLine as LaneLineItem).laneLineSide;

    const opts = {
      scope,
      laneId,
      laneSide,
      laneLineSide,
      newLaneLineCatmullPoints,
      newLaneLineCatmullTangents,
      catmullIndex: actionMeshCatmullIndex,
      roadId: scope.editingRoadConnectionItem.roadId,
      roadCategory: scope.editingRoadConnectionItem.category,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullEditConnectionRoad, opts);
    scope.commitTransaction(transaction);
  }

  unpickAllPrevAndNextLaneVertices() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);

    const ids = Object.keys(scope.laneVertices);
    ids.forEach((id: string) => {
      scope.laneVertices[id].material = scope.createColorMaterial(RendererConfig.mesh.roadVertexMarkerColor);
    });

    scope.firstLaneVertex = undefined;
    scope.secondLaneVertex = undefined;
    scope.connectionLaneVertex = undefined;

    scope.makeSceneDirty();
  }

  pickPrevAndNextLaneVertex(roadVertex: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);

    roadVertex.material = scope.createColorMaterial(RendererConfig.mesh.pickedRoadVertexMarkerColor);

    scope.makeSceneDirty();
  }

  createPrevAndNextLaneVertex(
    point: Vector3,
    color: Color3,
    category: PrevAndNextConnectionLaneCategory,
    extra: {
      laneItem: LaneItem;
      roadItem: RoadItem;
    },
  ) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);

    const id = `Road_Connection_Editor_PrevAndNextLane_Vertex_${scope.laneVertexIndex}`;
    const laneVertex = scope.createMarker(point, color, id) as Mesh;
    laneVertex.metadata = {
      isPrevAndNextConnectionLaneVertex: true,
      point,
      color,
      category,
      laneItem: extra.laneItem,
      roadItem: extra.roadItem,
    } as PrevAndNextConnectionLaneVertexMetadata;

    scope.laneVertexIndex++;
    scope.laneVertices[id] = laneVertex;

    scope.makeSceneDirty();
  }

  undecoratePrevAndNextLaneVertices() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);

    const ids = Object.keys(scope.laneVertices);
    ids.forEach((id: string) => {
      scope.laneVertices[id].dispose();
    });

    scope.laneVertices = {};
    scope.firstLaneVertex = undefined;
    scope.secondLaneVertex = undefined;
    scope.connectionLaneVertex = undefined;

    scope.makeSceneDirty();
  }

  decoratePrevAndNextLaneVertices() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);

    scope.decorateConnectionLane();

    scope.makeSceneDirty();
  }

  decorateConnectionLane() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);
    if (!scope.editingRoadConnectionItem && !scope.editingRoadConnectionLaneItem) return;

    const laneItem = scope.editingRoadConnectionLaneItem;
    if (!laneItem) return;

    const innerPoints = [...laneItem.laneLines.innerLaneLine.seriePoints];
    const outerPoints = [...laneItem.laneLines.outerLaneLine.seriePoints];

    const serieLength = innerPoints.length;
    const halfIdx = Math.floor(serieLength / 2);

    const innerCenter = innerPoints[halfIdx];
    const outerCenter = outerPoints[halfIdx];
    const yOffset = new Vector3(0, RendererConfig.connection.roadAlterPrevNextLaneMarkerYOffset, 0);
    const middleCenter = innerCenter.add(outerCenter).multiplyByFloats(0.5, 0.5, 0.5).add(yOffset);

    scope.createPrevAndNextLaneVertex(
      middleCenter,
      RendererConfig.mesh.roadVertexMarkerColor,
      PrevAndNextConnectionLaneCategory.ConnectionLane,
      {
        laneItem,
        roadItem: scope.editingRoadConnectionItem as RoadItem,
      },
    );
  }

  decorateConnectionPrevAndNextLanes() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);
    if (!scope.editingRoadConnectionItem || !scope.connectionLaneVertex) return;

    const connectionLaneVertexCategory = scope.connectionLaneVertex.laneVertexCategory;
    if (connectionLaneVertexCategory !== PrevAndNextConnectionLaneCategory.ConnectionLane) return;

    const connectionLane = scope.resolveLaneByLaneRoadIdAndRoadCategory(
      scope.connectionLaneVertex.laneId,
      scope.connectionLaneVertex.roadId,
      scope.connectionLaneVertex.roadCategory,
    ) as LaneItem;

    // prev lane
    const prevLaneInfo = {
      laneId: connectionLane.prevLanes[0].laneId,
      roadId: connectionLane.prevLanes[0].roadId,
      roadCategory: connectionLane.prevLanes[0].roadCategory,
    };

    const prevLane = scope.resolveLaneByLaneRoadIdAndRoadCategory(
      prevLaneInfo.laneId,
      prevLaneInfo.roadId,
      prevLaneInfo.roadCategory,
    ) as LaneItem;

    const prevLaneRoad = scope.resolveRoadByRoadIdAndRoadCategory(
      prevLaneInfo.roadId,
      prevLaneInfo.roadCategory,
    ) as RoadItem;

    const prevLaneSide = prevLane.laneSide;
    let candidatePrevLaneItems = [] as LaneItem[];

    if (prevLaneSide === LaneSide.Left) {
      candidatePrevLaneItems = prevLaneRoad.laneItems.leftLanes;
    } else {
      candidatePrevLaneItems = prevLaneRoad.laneItems.rightLanes;
    }

    candidatePrevLaneItems.forEach((laneItem: LaneItem) => {
      const innerPoints = laneItem.laneLines.innerLaneLine.seriePoints;
      const outerPoints = laneItem.laneLines.outerLaneLine.seriePoints;
      const vertexPoint = innerPoints[innerPoints.length - 1]
        .add(outerPoints[outerPoints.length - 1])
        .multiplyByFloats(0.5, 0.5, 0.5);

      scope.createPrevAndNextLaneVertex(
        vertexPoint,
        RendererConfig.mesh.roadVertexMarkerColor,
        PrevAndNextConnectionLaneCategory.PrevLane,
        {
          laneItem,
          roadItem: prevLaneRoad,
        },
      );
    });

    // next lane
    const nextLaneInfo = {
      laneId: connectionLane.nextLanes[0].laneId,
      roadId: connectionLane.nextLanes[0].roadId,
      roadCategory: connectionLane.nextLanes[0].roadCategory,
    };

    const nextLane = scope.resolveLaneByLaneRoadIdAndRoadCategory(
      nextLaneInfo.laneId,
      nextLaneInfo.roadId,
      nextLaneInfo.roadCategory,
    ) as LaneItem;

    const nextLaneRoad = scope.resolveRoadByRoadIdAndRoadCategory(
      nextLaneInfo.roadId,
      nextLaneInfo.roadCategory,
    ) as RoadItem;

    const nextLaneSide = nextLane.laneSide;
    let candidateNextLaneItems = [] as LaneItem[];

    if (nextLaneSide === LaneSide.Left) {
      candidateNextLaneItems = nextLaneRoad.laneItems.leftLanes;
    } else {
      candidateNextLaneItems = nextLaneRoad.laneItems.rightLanes;
    }

    candidateNextLaneItems.forEach((laneItem: LaneItem) => {
      const innerPoints = laneItem.laneLines.innerLaneLine.seriePoints;
      const outerPoints = laneItem.laneLines.outerLaneLine.seriePoints;
      const vertexPoint = innerPoints[0]
        .add(outerPoints[0])
        .multiplyByFloats(0.5, 0.5, 0.5);

      scope.createPrevAndNextLaneVertex(
        vertexPoint,
        RendererConfig.mesh.roadVertexMarkerColor,
        PrevAndNextConnectionLaneCategory.NextLane,
        {
          laneItem,
          roadItem: nextLaneRoad,
        },
      );
    });
  }

  editConnectionLanePrevAndNext() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);
    if (!scope.connectionLaneVertex || !scope.firstLaneVertex || !scope.secondLaneVertex) {
      scope.unpickAllPrevAndNextLaneVertices();
      return;
    }

    const connectionLaneVertex = scope.connectionLaneVertex;
    const firstLaneVertex = scope.firstLaneVertex;
    const secondLaneVertex = scope.secondLaneVertex;

    const connectionLaneVertexCategory = connectionLaneVertex.laneVertexCategory;
    const firstLaneVertexCategory = firstLaneVertex.laneVertexCategory;
    const secondLaneVertexCategory = secondLaneVertex.laneVertexCategory;

    if (
      (
        connectionLaneVertexCategory === PrevAndNextConnectionLaneCategory.ConnectionLane &&
        firstLaneVertexCategory === PrevAndNextConnectionLaneCategory.PrevLane &&
        secondLaneVertexCategory === PrevAndNextConnectionLaneCategory.NextLane
      ) || (
        connectionLaneVertexCategory === PrevAndNextConnectionLaneCategory.ConnectionLane &&
        firstLaneVertexCategory === PrevAndNextConnectionLaneCategory.NextLane &&
        secondLaneVertexCategory === PrevAndNextConnectionLaneCategory.PrevLane
      )
    ) {
      const connectionLane = scope.resolveLaneByLaneRoadIdAndRoadCategory(
        connectionLaneVertex.laneId,
        connectionLaneVertex.roadId,
        connectionLaneVertex.roadCategory,
      ) as LaneItem;
      const connectionLaneSide = connectionLane.laneSide;
      const connectionLaneId = connectionLaneVertex.laneId;
      const connectionLaneRoadId = connectionLaneVertex.roadId;
      const connectionLaneRoadCategory = connectionLaneVertex.roadCategory;

      const isPrevThenNext = firstLaneVertexCategory === PrevAndNextConnectionLaneCategory.PrevLane;

      const prevLaneId = isPrevThenNext ? firstLaneVertex.laneId : secondLaneVertex.laneId;
      const prevLaneRoadId = isPrevThenNext ? firstLaneVertex.roadId : secondLaneVertex.roadId;
      const prevLaneRoadCategory = isPrevThenNext ? firstLaneVertex.roadCategory : secondLaneVertex.roadCategory;

      const nextLaneId = !isPrevThenNext ? firstLaneVertex.laneId : secondLaneVertex.laneId;
      const nextLaneRoadId = !isPrevThenNext ? firstLaneVertex.roadId : secondLaneVertex.roadId;
      const nextLaneRoadCategory = !isPrevThenNext ? firstLaneVertex.roadCategory : secondLaneVertex.roadCategory;

      const isDuplicate = scope.isDuplicateRoadConnectionLanePrevAndNext(
        connectionLaneSide,
        connectionLaneId,
        connectionLaneRoadId,
        connectionLaneRoadCategory,
        prevLaneId,
        prevLaneRoadId,
        prevLaneRoadCategory,
        nextLaneId,
        nextLaneRoadId,
        nextLaneRoadCategory,
      );

      if (isDuplicate) {
        scope.undecoratePrevAndNextLaneVertices();
        scope.decoratePrevAndNextLaneVertices();
        
        scope.notifyFailure('已存在相同前序后序挂载方式的连接车道');
        return;
      }

      const opts = {
        scope,
        connectionLaneSide,
        connectionLaneId,
        connectionLaneRoadId,
        connectionLaneRoadCategory,
        prevLaneId,
        prevLaneRoadId,
        prevLaneRoadCategory,
        nextLaneId,
        nextLaneRoadId,
        nextLaneRoadCategory,
      };

      const transaction = scope.createTransaction(TransactionType.LanePrevNextEditConnectionRoad, opts);
      scope.commitTransaction(transaction);
    } else {
      scope.unpickAllPrevAndNextLaneVertices();
    }
  }

  onDeliverRoadConnectionLaneInnerAddCatmullPoint(pickedPoint: Vector3, belongingLaneLineItem: LaneLineItem) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);
    if (!scope.editingRoadConnectionItem || !scope.editingRoadConnectionLaneItem || !pickedPoint) return;

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
      roadId: scope.editingRoadConnectionItem.roadId,
      roadCategory: scope.editingRoadConnectionItem.category,
      laneId: scope.editingRoadConnectionLaneItem.laneId,
      laneSide: scope.editingRoadConnectionLaneItem.laneSide,
      laneLineSide: belongingLaneLineItem.laneLineSide,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullAlterLaneConnectionRoad, opts);
    scope.commitTransaction(transaction);
  }

  onDeliverRoadConnectionLaneInnerRemoveCatmullPoint(pickedPoint: Vector3, belongingLaneLineItem: LaneLineItem) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionLaneEditorPlugin);
    if (!scope.editingRoadConnectionItem || !scope.editingRoadConnectionLaneItem || !pickedPoint) return;

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
      roadId: scope.editingRoadConnectionItem.roadId,
      roadCategory: scope.editingRoadConnectionItem.category,
      laneId: scope.editingRoadConnectionLaneItem.laneId,
      laneSide: scope.editingRoadConnectionLaneItem.laneSide,
      laneLineSide: belongingLaneLineItem.laneLineSide,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullAlterLaneConnectionRoad, opts);
    scope.commitTransaction(transaction);
  }
}