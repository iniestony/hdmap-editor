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
  EnterEditingRoadConnectionItemEvent,
  ExitEditingRoadConnectionItemEvent,
  PickConnectionActionMeshEvent,
  OperateConnectionActionMeshEvent,
  UnpickConnectionActionMeshEvent,
  TriggerDecorateNewLanePrevAndNextConnectionLaneVertexEvent,
  PickNewLanePrevAndNextConnectionLaneVertexEvent,
  CleanNewLanePrevAndNextConnectionLaneVertexEvent,
  DeliverRoadConnectionInnerAddCatmullPointEvent,
  DeliverRoadConnectionInnerRemoveCatmullPointEvent,
} from './constant';
import {
  ConnectionActionMeshCategory,
  ConnectionActionMeshMetadata,
  NewLanePrevAndNextConnectionLaneCategory,
  NewLanePrevAndNextConnectionLaneVertexMetadata,
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
  InvokeRoadLaneLineSeriePointsOnlyPostInvalidEvent,
  InvokeRoadLaneLineSeriePointsPreAndPostInvalidEvent,
} from '../../transactions/event';
import {
  EnterRoadConnectionAltitudeAdaptorEvent,
  ExitRoadConnectionAltitudeAdaptorEvent,
} from '../roadConnectionAltitudeAdaptor/constant';

export default class RoadConnectionEditorPlugin extends LogicalPlugin {
  private editingRoadItem: RoadItem | null;
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
    laneVertexCategory: NewLanePrevAndNextConnectionLaneCategory;
  };
  private secondLaneVertex?: {
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
    laneVertexCategory: NewLanePrevAndNextConnectionLaneCategory;
  };
  private createLaneSide?: LaneSide;

  constructor(options: PluginOptions) {
    super(options);

    this.editingRoadItem = null;
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
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);

    scope.registerEvent(EnterEditingRoadConnectionItemEvent);
    scope.onEvent(EnterEditingRoadConnectionItemEvent, (params: { payload: Object | string | number | null }) => {
      scope.unhighlightAllRoadsAndJunctions();

      scope.undecorateEditingRoadItem();

      scope.undecorateNewLaneConnectionPrevAndNextLanes();

      scope.editingRoadItem = (params.payload as { roadItem: RoadItem }).roadItem;

      scope.highlightSingleRoad(scope.editingRoadItem.roadId, scope.editingRoadItem.category);
      
      scope.decorateEditingRoadItem();

      scope.emitEvent(EnterRoadConnectionAltitudeAdaptorEvent, { roadItem: scope.editingRoadItem });
    });

    scope.registerEvent(ExitEditingRoadConnectionItemEvent);
    scope.onEvent(ExitEditingRoadConnectionItemEvent, (params: { payload: Object | string | number | null }) => {
      scope.unhighlightAllRoadsAndJunctions();

      scope.undecorateEditingRoadItem();

      scope.undecorateNewLaneConnectionPrevAndNextLanes();

      scope.emitEvent(ExitRoadConnectionAltitudeAdaptorEvent);
    });

    scope.registerEvent(PickConnectionActionMeshEvent);
    scope.onEvent(PickConnectionActionMeshEvent, (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      const pickedMesh = (params.payload as { pickedMesh: Mesh }).pickedMesh;
      if (!scope.isActionMesh(pickedMesh)) return;

      const actionMeshMetadata = pickedMesh.metadata as ConnectionActionMeshMetadata;
      const actionMeshCategory = actionMeshMetadata.category;

      if (actionMeshCategory === ConnectionActionMeshCategory.RefLineCatmullReformat && (actionMeshMetadata.isStartCatmull || actionMeshMetadata.isEndCatmull)) {
        scope.notifyInfo('不可移动道路连接的道路关键点');
        return;
      }

      scope.currentActionMesh = pickedMesh;
      scope.currentActionMeshInitPosition = pickedMesh.position;
    });

    scope.registerEvent(OperateConnectionActionMeshEvent);
    scope.onEvent(OperateConnectionActionMeshEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem || !scope.currentActionMesh) return;

      const pointerInfo = (params.payload as { pointerInfo: PointerInfo }).pointerInfo;
      const alignAltitude = scope.currentActionMesh.position.y;

      const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
        altitude: alignAltitude,
      });

      scope.onOperateActionMesh(pickingInfo, alignAltitude);
    });

    scope.registerEvent(UnpickConnectionActionMeshEvent);
    scope.onEvent(UnpickConnectionActionMeshEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem || !scope.currentActionMesh) return;

      const pointerInfo = (params.payload as { pointerInfo: PointerInfo }).pointerInfo;
      const alignAltitude = scope.currentActionMesh.position.y;

      const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
        altitude: alignAltitude,
      });

      scope.onUnpickActionMesh(pickingInfo, alignAltitude);
    });

    scope.registerEvent(TriggerDecorateNewLanePrevAndNextConnectionLaneVertexEvent);
    scope.onEvent(TriggerDecorateNewLanePrevAndNextConnectionLaneVertexEvent, (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      const roadId = (params.payload as { roadId: string }).roadId;
      const roadCategory = (params.payload as { roadCategory: RoadCategory }).roadCategory;
      const laneSide = (params.payload as { laneSide: LaneSide }).laneSide;

      if (scope.editingRoadItem.roadId !== roadId || scope.editingRoadItem.category !== roadCategory) return;

      scope.undecorateNewLaneConnectionPrevAndNextLanes();
      scope.decorateNewLaneConnectionPrevAndNextLanes(laneSide);
    });

    scope.registerEvent(CleanNewLanePrevAndNextConnectionLaneVertexEvent);
    scope.onEvent(CleanNewLanePrevAndNextConnectionLaneVertexEvent, (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      scope.undecorateNewLaneConnectionPrevAndNextLanes();
    });

    scope.registerEvent(PickNewLanePrevAndNextConnectionLaneVertexEvent);
    scope.onEvent(PickNewLanePrevAndNextConnectionLaneVertexEvent, (params: { payload: Object | string | number | null }) => {
      const pickedMesh = (params.payload as { pickedMesh: Mesh }).pickedMesh;
      if (!scope.isNewLanePrevAndNextConnectionLaneVertex(pickedMesh)) return;

      const metadata = pickedMesh.metadata as NewLanePrevAndNextConnectionLaneVertexMetadata;

      if (scope.firstLaneVertex === undefined) {
        scope.unpickAllPrevAndNextLaneVertices();
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

        scope.createNewConnectionLane();
      }
    });

    scope.registerEvent(DeliverRoadConnectionInnerAddCatmullPointEvent);
    scope.onEvent(DeliverRoadConnectionInnerAddCatmullPointEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      // const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      // const belongingRoadItem = (params.payload as { belongingRoadItem: RoadItem }).belongingRoadItem;

      // if (scope.editingRoadItem.roadId !== belongingRoadItem.roadId || scope.editingRoadItem.category !== belongingRoadItem.category) return;
      
      // scope.onDeliverRoadConnectionInnerAddCatmullPoint(pickedPoint);
    });

    scope.registerEvent(DeliverRoadConnectionInnerRemoveCatmullPointEvent);
    scope.onEvent(DeliverRoadConnectionInnerRemoveCatmullPointEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      const belongingRoadItem = (params.payload as { belongingRoadItem: RoadItem }).belongingRoadItem;

      if (scope.editingRoadItem.roadId !== belongingRoadItem.roadId || scope.editingRoadItem.category !== belongingRoadItem.category) return;
      
      scope.onDeliverRoadConnectionInnerRemoveCatmullPoint(pickedPoint);
    });
  }

  initTransactionInvokedEvent() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);

    // exit if editing road is removed
    const clearRoadDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      const roadId = (params.payload as { roadId: string }).roadId;
      if (scope.editingRoadItem.roadId === roadId) {
        scope.exitEditRoadConnection();
      }
    };

    scope.onEvent(InvokeRemoveConnectionRoadEvent, clearRoadDecorationCallback);


    // after editing, refresh decoration
    const refreshRoadDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingRoadItem) return;

      scope.emitEvent(EnterEditingRoadConnectionItemEvent, {
        roadItem: scope.resolveRoadByRoadIdAndRoadCategory(scope.editingRoadItem.roadId, scope.editingRoadItem.category) as RoadItem,
      });
    };

    scope.onEvent(InvokeReformatConnectionRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeCatmullEditConnectionRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeCatmullAlterLaneConnectionRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeLanePrevNextEditConnectionRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeAddLaneConnectionRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeRemoveLaneConnectionRoadEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeRoadConnectionTransparencyEditEvent, refreshRoadDecorationCallback);
    scope.onEvent(InvokeRoadConnectionAttributeEditEvent, refreshRoadDecorationCallback);
    
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
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);
    if (!scope.editingRoadItem) return false;

    return !!(pickedMesh?.metadata?.isConnectionActionMesh);
  }

  createActionMesh(
    point: Vector3,
    color: Color3,
    category: ConnectionActionMeshCategory,
    extra: {
      relatedRefLine?: ReferenceLineItem;
      relatedLaneLine?: LaneLineItem;
      relatedLane?: LaneItem;
      isStartCatmull?: boolean;
      isEndCatmull?: boolean;
      catmullIndex?: number;
    },
  ) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);

    const id = `Road_Connection_Editor_Action_Mesh_${scope.actionMeshIndex}`;
    const actionMesh = scope.createMarker(point, color, id) as Mesh;
    actionMesh.metadata = {
      isConnectionActionMesh: true,
      point,
      color,
      category,
      relatedRefLine: extra.relatedRefLine,
      relatedLaneLine: extra.relatedLaneLine,
      relatedLane: extra.relatedLane,
      isStartCatmull: extra.isStartCatmull,
      isEndCatmull: extra.isEndCatmull,
      catmullIndex: extra.catmullIndex,
    } as ConnectionActionMeshMetadata;

    scope.actionMeshIndex++;
    scope.actionMeshes[id] = actionMesh;

    scope.makeSceneDirty();
  }

  updateActionMesh(id: string, point: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);

    const oldMesh = scope.actionMeshes[id];
    if (!oldMesh) return;
    const oldMetadata = oldMesh.metadata as ConnectionActionMeshMetadata;

    const actionMesh = scope.createMarker(point, oldMetadata.color, id) as Mesh;
    actionMesh.metadata = {
      isConnectionActionMesh: true,
      point,
      color: oldMetadata.color,
      category: oldMetadata.category,
      relatedRefLine: oldMetadata.relatedRefLine,
      relatedLaneLine: oldMetadata.relatedLaneLine,
      relatedLane: oldMetadata.relatedLane,
      isStartCatmull: oldMetadata.isStartCatmull,
      isEndCatmull: oldMetadata.isEndCatmull,
      catmullIndex: oldMetadata.catmullIndex,
    } as ConnectionActionMeshMetadata;

    oldMesh.dispose();

    scope.currentActionMesh = actionMesh;
    scope.actionMeshes[id] = actionMesh;

    scope.makeSceneDirty();
  }

  undecorateEditingRoadItem() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);

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
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);
    if (!scope.editingRoadItem) return;

    scope.decorateRefLineCatmullReformat();

    scope.makeSceneDirty();
  }

  decorateRefLineCatmullReformat() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);
    if (!scope.editingRoadItem) return;

    if (scope.editingRoadItem.referenceLineEditable) {
      const referenceLine = scope.editingRoadItem.referenceLine;
      const catmullPoints = referenceLine.catmullPoints;
      const numCatmullPoints = catmullPoints.length;
      
      catmullPoints.forEach((p: Vector3, catmullIndex: number) => {
        scope.createActionMesh(
          p,
          RendererConfig.mesh.reflineMarkerColor,
          ConnectionActionMeshCategory.RefLineCatmullReformat,
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
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);

    if (!pickingInfo.pickedPoint) return;
    // escape outside road edit mode & move loop
    if (!scope.editingRoadItem || !scope.currentActionMesh || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;
    pickedPoint.y = alignAltitude;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) return;

    let meshPoint = pickedPoint;

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as ConnectionActionMeshMetadata;
    const actionMeshCategory = actionMeshMetadata.category;

    if (
      actionMeshCategory === ConnectionActionMeshCategory.RefLineCatmullReformat
    ) {
      if (!actionMeshMetadata.isStartCatmull && !actionMeshMetadata.isEndCatmull) {
        meshPoint = pickedPoint;

        scope.updateActionMesh(scope.currentActionMesh.id, meshPoint);
      }
    }
  }

  onUnpickActionMesh(pickingInfo: PickingInfo, alignAltitude: number) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);

    if (!scope.editingRoadItem || !scope.currentActionMesh || !pickingInfo.pickedPoint || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;
    pickedPoint.y = alignAltitude;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) {
      scope.currentActionMesh = null;
      scope.currentActionMeshInitPosition = null;

      return;
    }

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as ConnectionActionMeshMetadata;
    const actionMeshCategory = actionMeshMetadata.category;

    if (
      actionMeshCategory === ConnectionActionMeshCategory.RefLineCatmullReformat
    ) {
      if (!actionMeshMetadata.isStartCatmull && !actionMeshMetadata.isEndCatmull) {
        const catmullPoints = (actionMeshMetadata.relatedRefLine as ReferenceLineItem).catmullPoints;
        const catmullTangents = (actionMeshMetadata.relatedRefLine as ReferenceLineItem).catmullTangents;

        const actionMeshCatmullIndex = actionMeshMetadata.catmullIndex as number;
        const newCatmullPoint = pickedPoint;

        const newRefLineCatmullPoints = [...catmullPoints];
        newRefLineCatmullPoints.splice(actionMeshCatmullIndex, 1, newCatmullPoint);

        const newRefLineCatmullTangents = [...catmullTangents];

        scope.onUnpickActionMeshRefLineCatmullReformat(actionMeshMetadata, newRefLineCatmullPoints, newRefLineCatmullTangents);
      }
    }

    // clear after one down-move-up loop, actionMesh is active only in every loop
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
  }

  onUnpickActionMeshRefLineCatmullReformat(
    actionMeshMetadata: ConnectionActionMeshMetadata,
    newRefLineCatmullPoints: Vector3[],
    newRefLineCatmullTangents: Vector3[],
  ) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);
    if (!scope.editingRoadItem) return;

    const opts = {
      scope,
      newRefLineCatmullPoints,
      newRefLineCatmullTangents,
      roadId: scope.editingRoadItem.roadId,
      roadCategory: scope.editingRoadItem.category,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullReformatConnectionRoad, opts);
    scope.commitTransaction(transaction);
  }

  isNewLanePrevAndNextConnectionLaneVertex(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);

    return !!(pickedMesh?.metadata?.isNewLanePrevAndNextConnectionLaneVertex);
  }

  unpickAllPrevAndNextLaneVertices() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);

    const ids = Object.keys(scope.laneVertices);
    ids.forEach((id: string) => {
      scope.laneVertices[id].material = scope.createColorMaterial(RendererConfig.mesh.roadVertexMarkerColor);
    });

    scope.firstLaneVertex = undefined;
    scope.secondLaneVertex = undefined;

    scope.makeSceneDirty();
  }

  pickPrevAndNextLaneVertex(roadVertex: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);

    roadVertex.material = scope.createColorMaterial(RendererConfig.mesh.pickedRoadVertexMarkerColor);

    scope.makeSceneDirty();
  }

  createPrevAndNextLaneVertex(
    point: Vector3,
    color: Color3,
    category: NewLanePrevAndNextConnectionLaneCategory,
    extra: {
      laneItem: LaneItem;
      roadItem: RoadItem;
    },
  ) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);

    const id = `Road_Connection_Editor_New_Lane_PrevAndNextLane_Vertex_${scope.laneVertexIndex}`;
    const laneVertex = scope.createMarker(point, color, id) as Mesh;
    laneVertex.metadata = {
      isNewLanePrevAndNextConnectionLaneVertex: true,
      point,
      color,
      category,
      laneItem: extra.laneItem,
      roadItem: extra.roadItem,
    } as NewLanePrevAndNextConnectionLaneVertexMetadata;

    scope.laneVertexIndex++;
    scope.laneVertices[id] = laneVertex;

    scope.makeSceneDirty();
  }

  undecorateNewLaneConnectionPrevAndNextLanes() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);

    const ids = Object.keys(scope.laneVertices);
    ids.forEach((id: string) => {
      scope.laneVertices[id].dispose();
    });

    scope.laneVertices = {};
    scope.firstLaneVertex = undefined;
    scope.secondLaneVertex = undefined;
    scope.createLaneSide = undefined;

    scope.makeSceneDirty();
  };

  decorateNewLaneConnectionPrevAndNextLanes(laneSide: LaneSide) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);
    if (!scope.editingRoadItem) return;

    scope.createLaneSide = laneSide;

    const connectionRoadItem = scope.editingRoadItem as RoadItem;
    const firstSeriePoint = connectionRoadItem.referenceLine.seriePoints[0];
    const lastSeriePoint = connectionRoadItem.referenceLine.seriePoints[connectionRoadItem.referenceLine.seriePoints.length - 1];

    const prevRoadInfo = connectionRoadItem.prevRoads[0];
    const nextRoadInfo = connectionRoadItem.nextRoads[0];

    if (!prevRoadInfo || !nextRoadInfo) return;

    const prevRoad = scope.resolveRoadByRoadIdAndRoadCategory(
      prevRoadInfo.roadId,
      prevRoadInfo.roadCategory,
    ) as RoadItem;

    const nextRoad = scope.resolveRoadByRoadIdAndRoadCategory(
      nextRoadInfo.roadId,
      nextRoadInfo.roadCategory,
    ) as RoadItem;

    if (laneSide === LaneSide.Left) {
      // prev lanes from next road
      let candidatePrevLaneItems = [] as LaneItem[];

      const distanceToFirstNextRoad = lastSeriePoint.subtract(nextRoad.referenceLine.seriePoints[0]).length();
      const distanceToLastNextRoad = lastSeriePoint.subtract(nextRoad.referenceLine.seriePoints[nextRoad.referenceLine.seriePoints.length - 1]).length();

      if (distanceToFirstNextRoad < distanceToLastNextRoad) {
        candidatePrevLaneItems = nextRoad.laneItems.leftLanes;
      } else {
        candidatePrevLaneItems = nextRoad.laneItems.rightLanes;
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
          NewLanePrevAndNextConnectionLaneCategory.PrevLane,
          {
            laneItem,
            roadItem: nextRoad,
          },
        );
      });

      // next lanes from prev road
      let candidateNextLaneItems = [] as LaneItem[];

      const distanceToFirstPrevRoad = firstSeriePoint.subtract(prevRoad.referenceLine.seriePoints[0]).length();
      const distanceToLastPrevRoad = firstSeriePoint.subtract(prevRoad.referenceLine.seriePoints[prevRoad.referenceLine.seriePoints.length - 1]).length();

      if (distanceToFirstPrevRoad > distanceToLastPrevRoad) {
        candidateNextLaneItems = prevRoad.laneItems.leftLanes;
      } else {
        candidateNextLaneItems = prevRoad.laneItems.rightLanes;
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
          NewLanePrevAndNextConnectionLaneCategory.NextLane,
          {
            laneItem,
            roadItem: prevRoad,
          },
        );
      });
    } else {
      // prev lanes from prev road
      let candidatePrevLaneItems = [] as LaneItem[];

      const distanceToFirstPrevRoad = firstSeriePoint.subtract(prevRoad.referenceLine.seriePoints[0]).length();
      const distanceToLastPrevRoad = firstSeriePoint.subtract(prevRoad.referenceLine.seriePoints[prevRoad.referenceLine.seriePoints.length - 1]).length();

      if (distanceToFirstPrevRoad < distanceToLastPrevRoad) {
        candidatePrevLaneItems = prevRoad.laneItems.leftLanes;
      } else {
        candidatePrevLaneItems = prevRoad.laneItems.rightLanes;
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
          NewLanePrevAndNextConnectionLaneCategory.PrevLane,
          {
            laneItem,
            roadItem: prevRoad,
          },
        );
      });

      // next lanes from next road
      let candidateNextLaneItems = [] as LaneItem[];

      const distanceToFirstNextRoad = lastSeriePoint.subtract(nextRoad.referenceLine.seriePoints[0]).length();
      const distanceToLastNextRoad = lastSeriePoint.subtract(nextRoad.referenceLine.seriePoints[nextRoad.referenceLine.seriePoints.length - 1]).length();

      if (distanceToFirstNextRoad > distanceToLastNextRoad) {
        candidateNextLaneItems = nextRoad.laneItems.leftLanes;
      } else {
        candidateNextLaneItems = nextRoad.laneItems.rightLanes;
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
          NewLanePrevAndNextConnectionLaneCategory.NextLane,
          {
            laneItem,
            roadItem: nextRoad,
          },
        );
      });
    }

    scope.makeSceneDirty();
  };

  createNewConnectionLane() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);
    if (!scope.editingRoadItem) return;

    if (!scope.firstLaneVertex || !scope.secondLaneVertex) {
      scope.unpickAllPrevAndNextLaneVertices();
      return;
    }

    const firstLaneVertex = scope.firstLaneVertex;
    const secondLaneVertex = scope.secondLaneVertex;

    const firstLaneVertexCategory = firstLaneVertex.laneVertexCategory;
    const secondLaneVertexCategory = secondLaneVertex.laneVertexCategory;

    if (
      (
        firstLaneVertexCategory === NewLanePrevAndNextConnectionLaneCategory.PrevLane &&
        secondLaneVertexCategory === NewLanePrevAndNextConnectionLaneCategory.NextLane
      ) || (
        firstLaneVertexCategory === NewLanePrevAndNextConnectionLaneCategory.NextLane &&
        secondLaneVertexCategory === NewLanePrevAndNextConnectionLaneCategory.PrevLane
      )
    ) {
      const isPrevThenNext = firstLaneVertexCategory === NewLanePrevAndNextConnectionLaneCategory.PrevLane;

      const prevLaneId = isPrevThenNext ? firstLaneVertex.laneId : secondLaneVertex.laneId;
      const prevLaneRoadId = isPrevThenNext ? firstLaneVertex.roadId : secondLaneVertex.roadId;
      const prevLaneRoadCategory = isPrevThenNext ? firstLaneVertex.roadCategory : secondLaneVertex.roadCategory;

      const nextLaneId = !isPrevThenNext ? firstLaneVertex.laneId : secondLaneVertex.laneId;
      const nextLaneRoadId = !isPrevThenNext ? firstLaneVertex.roadId : secondLaneVertex.roadId;
      const nextLaneRoadCategory = !isPrevThenNext ? firstLaneVertex.roadCategory : secondLaneVertex.roadCategory;

      const isValid = scope.isValidNewRoadConnectionLanePrevAndNext(
        scope.editingRoadItem.roadId,
        scope.editingRoadItem.category,
        prevLaneId,
        prevLaneRoadId,
        prevLaneRoadCategory,
        nextLaneId,
        nextLaneRoadId,
        nextLaneRoadCategory,
      );

      if (!isValid) {
        scope.unpickAllPrevAndNextLaneVertices();
        
        scope.notifyFailure('已存在相同前序后序挂载方式的连接车道');
        return;
      }

      const opts = {
        scope,
        connectionLaneRoadId: scope.editingRoadItem.roadId,
        connectionLaneRoadCategory: scope.editingRoadItem.category,
        connectionLaneSide: scope.createLaneSide as LaneSide,
        prevLaneId,
        prevLaneRoadId,
        prevLaneRoadCategory,
        nextLaneId,
        nextLaneRoadId,
        nextLaneRoadCategory,
      };

      const transaction = scope.createTransaction(TransactionType.AddLaneConnectionRoad, opts);
      scope.commitTransaction(transaction);
    } else {
      scope.unpickAllPrevAndNextLaneVertices();
    }
  }

  onDeliverRoadConnectionInnerAddCatmullPoint(pickedPoint: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);
    if (!scope.editingRoadItem || !pickedPoint) return;

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
      roadId: scope.editingRoadItem.roadId,
      roadCategory: scope.editingRoadItem.category,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullReformatConnectionRoad, opts);
    scope.commitTransaction(transaction);
  }

  onDeliverRoadConnectionInnerRemoveCatmullPoint(pickedPoint: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionEditorPlugin);
    if (!scope.editingRoadItem || !pickedPoint) return;

    const oldCatmullPoints = scope.editingRoadItem.referenceLine.catmullPoints;
    // at least two catmull points
    if (oldCatmullPoints.length <= 2) return;

    const oldCatmullTangents = scope.editingRoadItem.referenceLine.catmullTangents;

    const sameCatmullPointIdx = oldCatmullPoints.findIndex((v: Vector3) => {
      return v.subtract(pickedPoint).length() <= RendererConfig.scene.maximumSameCatmullPointDistance;
    });
    if (sameCatmullPointIdx < 0) return;

    // not first nor last
    if (sameCatmullPointIdx === 0) return;
    if (sameCatmullPointIdx === oldCatmullPoints.length - 1) return;

    const newRefLineCatmullPoints = [...oldCatmullPoints];
    newRefLineCatmullPoints.splice(sameCatmullPointIdx, 1);

    const newRefLineCatmullTangents = [...oldCatmullTangents];
    newRefLineCatmullTangents.splice(sameCatmullPointIdx, 1);

    const opts = {
      scope,
      newRefLineCatmullPoints,
      newRefLineCatmullTangents,
      roadId: scope.editingRoadItem.roadId,
      roadCategory: scope.editingRoadItem.category,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullReformatConnectionRoad, opts);
    scope.commitTransaction(transaction);
  }
};