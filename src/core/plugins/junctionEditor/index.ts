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
  EnterEditingJunctionItemEvent,
  ExitEditingJunctionItemEvent,
  PickJunctionActionMeshEvent,
  OperateJunctionActionMeshEvent,
  UnpickJunctionActionMeshEvent,
  TriggerDecorateNewRoadPrevAndNextConnectionRoadVertexEvent,
  PickNewRoadPrevAndNextConnectionRoadVertexEvent,
  CleanNewRoadPrevAndNextConnectionRoadVertexEvent,
  DeliverJunctionAddEdgePointEvent,
  DeliverJunctionRemoveEdgePointEvent,
} from './constant';
import {
  JunctionActionMeshCategory,
  JunctionActionMeshMetadata,
  NewRoadPrevAndNextConnectionRoadVertexMetadata,
} from './type';
import {
  JunctionVertexCategory,
} from '../junctionDrawer/type';
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
  JunctionEdgeItem,
  JunctionItem,
} from '../statusManager/type';
import { TransactionType } from '../../transactions';
import {
  InvokeRemoveJunctionEvent,
  InvokeCatmullEditEdgeJunctionEvent,
  InvokeJunctionAttributeEditEvent,
  InvokeCreateConnectionRoadEvent,
  InvokeRemoveConnectionRoadEvent,
  InvokeReformatConnectionRoadEvent,
} from '../../transactions/event';

export default class JunctionEditorPlugin extends LogicalPlugin {
  private editingJunctionItem: JunctionItem | null;
  private currentActionMesh: Mesh | null;
  private currentActionMeshInitPosition: Vector3 | null;
  private actionMeshes: { [id: string]: Mesh };
  private actionMeshIndex: number;

  private roadVertices: { [id: string]: Mesh };
  private roadVertexIndex: number;
  private firstRoadVertex?: {
    roadId: string;
    roadCategory: RoadCategory;
    roadVertexCategory: JunctionVertexCategory;
  };
  private secondRoadVertex?: {
    roadId: string;
    roadCategory: RoadCategory;
    roadVertexCategory: JunctionVertexCategory;
  };

  constructor(options: PluginOptions) {
    super(options);

    this.editingJunctionItem = null;
    this.currentActionMesh = null;
    this.currentActionMeshInitPosition = null;
    this.actionMeshes = {};
    this.actionMeshIndex = 0;

    this.roadVertices = {};
    this.roadVertexIndex = 0;
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
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);

    scope.registerEvent(EnterEditingJunctionItemEvent);
    scope.onEvent(EnterEditingJunctionItemEvent, (params: { payload: Object | string | number | null }) => {
      scope.unhighlightAllRoadsAndJunctions();

      scope.undecorateEditingJunctionItem();

      scope.undecorateNewRoadConnectionPrevAndNextRoads();

      scope.editingJunctionItem = (params.payload as { junctionItem: JunctionItem }).junctionItem;

      scope.highlightSingleJunction(scope.editingJunctionItem.junctionId);

      scope.decorateEditingJunctionItem();
    });

    scope.registerEvent(ExitEditingJunctionItemEvent);
    scope.onEvent(ExitEditingJunctionItemEvent, (params: { payload: Object | string | number | null }) => {
      scope.unhighlightAllRoadsAndJunctions();

      scope.undecorateEditingJunctionItem();

      scope.undecorateNewRoadConnectionPrevAndNextRoads();
    });

    scope.registerEvent(PickJunctionActionMeshEvent);
    scope.onEvent(PickJunctionActionMeshEvent, (params: { payload: Object | string | number | null }) => {
      const pickedMesh = (params.payload as { pickedMesh: Mesh }).pickedMesh;
      if (!scope.isActionMesh(pickedMesh)) return;

      scope.currentActionMesh = pickedMesh;
      scope.currentActionMeshInitPosition = pickedMesh.position;
    });

    scope.registerEvent(OperateJunctionActionMeshEvent);
    scope.onEvent(OperateJunctionActionMeshEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingJunctionItem || !scope.currentActionMesh) return;

      const pointerInfo = (params.payload as { pointerInfo: PointerInfo }).pointerInfo;
      const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
        altitude: scope.currentActionMesh.position.y,
      });

      scope.onOperateActionMesh(pickingInfo);
    });

    scope.registerEvent(UnpickJunctionActionMeshEvent);
    scope.onEvent(UnpickJunctionActionMeshEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingJunctionItem || !scope.currentActionMesh) return;

      const pointerInfo = (params.payload as { pointerInfo: PointerInfo }).pointerInfo;
      const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
        altitude: scope.currentActionMesh.position.y,
      });

      scope.onUnpickActionMesh(pickingInfo);
    });

    scope.registerEvent(TriggerDecorateNewRoadPrevAndNextConnectionRoadVertexEvent);
    scope.onEvent(TriggerDecorateNewRoadPrevAndNextConnectionRoadVertexEvent, (params: { payload: Object | string | number | null }) => {
      if (!scope.editingJunctionItem) return;

      const junctionId = (params.payload as { junctionId: string }).junctionId;

      if (scope.editingJunctionItem.junctionId !== junctionId) return;

      scope.undecorateNewRoadConnectionPrevAndNextRoads();
      scope.decorateNewRoadConnectionPrevAndNextRoads();
    });

    scope.registerEvent(CleanNewRoadPrevAndNextConnectionRoadVertexEvent);
    scope.onEvent(CleanNewRoadPrevAndNextConnectionRoadVertexEvent, (params: { payload: Object | string | number | null }) => {
      if (!scope.editingJunctionItem) return;

      scope.undecorateNewRoadConnectionPrevAndNextRoads();
    });

    scope.registerEvent(PickNewRoadPrevAndNextConnectionRoadVertexEvent);
    scope.onEvent(PickNewRoadPrevAndNextConnectionRoadVertexEvent, (params: { payload: Object | string | number | null }) => {
      const pickedMesh = (params.payload as { pickedMesh: Mesh }).pickedMesh;
      if (!scope.isNewRoadPrevAndNextConnectionRoadVertex(pickedMesh)) return;

      const metadata = pickedMesh.metadata as NewRoadPrevAndNextConnectionRoadVertexMetadata;
      if (metadata.isSelected) {
        scope.notifyInfo('已经选择过该点');
        return;
      }

      if (scope.firstRoadVertex === undefined) {
        scope.unpickAllPrevAndNextRoadVertices();
        scope.pickPrevAndNextRoadVertex(pickedMesh);

        scope.firstRoadVertex = {
          roadId: metadata.roadItem.roadId,
          roadCategory: metadata.roadItem.category,
          roadVertexCategory: metadata.category,
        };
      } else if (scope.secondRoadVertex === undefined) {
        scope.pickPrevAndNextRoadVertex(pickedMesh);

        scope.secondRoadVertex = {
          roadId: metadata.roadItem.roadId,
          roadCategory: metadata.roadItem.category,
          roadVertexCategory: metadata.category,
        };

        scope.createNewConnectionRoadInJunction();
      }
    });

    scope.registerEvent(DeliverJunctionAddEdgePointEvent);
    scope.onEvent(DeliverJunctionAddEdgePointEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingJunctionItem) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      const belongingJunctionEdgeItem = (params.payload as { belongingJunctionEdgeItem: JunctionEdgeItem }).belongingJunctionEdgeItem;

      let isExist = false;

      scope.editingJunctionItem.edges.forEach((m: JunctionEdgeItem) => {
        if (m.edgeId === belongingJunctionEdgeItem.edgeId) {
          isExist = true;
          return;
        }
      });
      if (!isExist) return;

      scope.onDeliverJunctionAddEdgePoint(pickedPoint, belongingJunctionEdgeItem);
    });


    scope.registerEvent(DeliverJunctionRemoveEdgePointEvent);
    scope.onEvent(DeliverJunctionRemoveEdgePointEvent, async (params: { payload: Object | string | number | null }) => {
      if (!scope.editingJunctionItem) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      const belongingJunctionEdgeItem = (params.payload as { belongingJunctionEdgeItem: JunctionEdgeItem }).belongingJunctionEdgeItem;

      let isExist = false;

      scope.editingJunctionItem.edges.forEach((m: JunctionEdgeItem) => {
        if (m.edgeId === belongingJunctionEdgeItem.edgeId) {
          isExist = true;
          return;
        }
      });
      if (!isExist) return;
  
      scope.onDeliverJunctionRemoveEdgePoint(pickedPoint, belongingJunctionEdgeItem);
    });

  }

  initTransactionInvokedEvent() {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);

    // exit if editing road is removed
    const clearJunctionDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingJunctionItem) return;

      const junctionId = (params.payload as { junctionId: string }).junctionId;
      if (scope.editingJunctionItem.junctionId === junctionId) {
        scope.exitEditJunction();
      }
    };

    scope.onEvent(InvokeRemoveJunctionEvent, clearJunctionDecorationCallback);


    // after editing, refresh decoration
    const refreshJunctionDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingJunctionItem) return;

      scope.emitEvent(EnterEditingJunctionItemEvent, {
        junctionItem: scope.resolveJunctionByJunctionId(scope.editingJunctionItem.junctionId) as JunctionItem,
      });
    };

    scope.onEvent(InvokeCatmullEditEdgeJunctionEvent, refreshJunctionDecorationCallback);
    scope.onEvent(InvokeJunctionAttributeEditEvent, refreshJunctionDecorationCallback);
    scope.onEvent(InvokeCreateConnectionRoadEvent, refreshJunctionDecorationCallback);
    scope.onEvent(InvokeRemoveConnectionRoadEvent, refreshJunctionDecorationCallback);
    scope.onEvent(InvokeReformatConnectionRoadEvent, refreshJunctionDecorationCallback);
  }

  isActionMesh(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);
    if (!scope.editingJunctionItem) return false;

    return !!(pickedMesh?.metadata?.isJunctionActionMesh);
  }

  createActionMesh(
    point: Vector3,
    color: Color3,
    category: JunctionActionMeshCategory,
    extra: {
      relatedJunctionEdge?: JunctionEdgeItem;
      relatedJunction?: JunctionItem;
      isStartCatmull?: boolean;
      isEndCatmull?: boolean;
      catmullIndex?: number;
    },
  ) {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);

    const id = `Junction_Editor_Action_Mesh_${scope.actionMeshIndex}`;
    const actionMesh = scope.createMarker(point, color, id) as Mesh;
    actionMesh.metadata = {
      isJunctionActionMesh: true,
      point,
      color,
      category,
      relatedJunctionEdge: extra.relatedJunctionEdge,
      relatedJunction: extra.relatedJunction,
      isStartCatmull: extra.isStartCatmull,
      isEndCatmull: extra.isEndCatmull,
      catmullIndex: extra.catmullIndex,
    } as JunctionActionMeshMetadata;

    scope.actionMeshIndex++;
    scope.actionMeshes[id] = actionMesh;

    scope.makeSceneDirty();
  }

  updateActionMesh(id: string, point: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);

    const oldMesh = scope.actionMeshes[id];
    if (!oldMesh) return;
    const oldMetadata = oldMesh.metadata as JunctionActionMeshMetadata;

    const actionMesh = scope.createMarker(point, oldMetadata.color, id) as Mesh;
    actionMesh.metadata = {
      isJunctionActionMesh: true,
      point,
      color: oldMetadata.color,
      category: oldMetadata.category,
      relatedJunctionEdge: oldMetadata.relatedJunctionEdge,
      relatedJunction: oldMetadata.relatedJunction,
      isStartCatmull: oldMetadata.isStartCatmull,
      isEndCatmull: oldMetadata.isEndCatmull,
      catmullIndex: oldMetadata.catmullIndex,
    } as JunctionActionMeshMetadata;

    oldMesh.dispose();

    scope.currentActionMesh = actionMesh;
    scope.actionMeshes[id] = actionMesh;

    scope.makeSceneDirty();
  }

  undecorateEditingJunctionItem() {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);

    const ids = Object.keys(scope.actionMeshes);
    ids.forEach((id: string) => {
      scope.actionMeshes[id].dispose();
    });

    scope.editingJunctionItem = null;
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
    scope.actionMeshes = {};

    scope.makeSceneDirty();
  }

  decorateEditingJunctionItem() {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);
    if (!scope.editingJunctionItem) return;

    scope.decorateJunctionEdgeCatmullEdit();

    scope.makeSceneDirty();
  }

  decorateJunctionEdgeCatmullEdit() {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);
    if (!scope.editingJunctionItem) return;

    const junctionItem = scope.editingJunctionItem;

    // catmull points on outerLaneLine for each lane line
    junctionItem.edges.forEach((junctionEdgeItem: JunctionEdgeItem) => {
      const catmullPoints = junctionEdgeItem.catmullPoints;
      const numCatmullPoints = catmullPoints.length;

      catmullPoints.forEach((p: Vector3, catmullIndex: number) => {
        // exclude start/end catmull
        if ((catmullIndex !== 0) && (catmullIndex !== numCatmullPoints - 1)) {
          scope.createActionMesh(
            p,
            RendererConfig.junction.edgeCatmullMarkerColor,
            JunctionActionMeshCategory.EdgeCatmullEdit,
            {
              relatedJunctionEdge: junctionEdgeItem,
              relatedJunction: junctionItem,
              isStartCatmull: false,
              isEndCatmull: false,
              catmullIndex: catmullIndex,
            },
          );
        }
      });
    });
  }

  onOperateActionMesh(pickingInfo: PickingInfo) {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);

    if (!pickingInfo.pickedPoint) return;
    // escape outside road edit mode & move loop
    if (!scope.editingJunctionItem || !scope.currentActionMesh || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) return;

    let meshPoint = pickedPoint;

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as JunctionActionMeshMetadata;
    const actionMeshCategory = actionMeshMetadata.category;

    if (
      actionMeshCategory === JunctionActionMeshCategory.EdgeCatmullEdit
    ) {
      meshPoint = pickedPoint;
    }

    scope.updateActionMesh(scope.currentActionMesh.id, meshPoint);
  }

  onUnpickActionMesh(pickingInfo: PickingInfo) {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);
    const pickedPoint = pickingInfo.pickedPoint;
    if (!scope.editingJunctionItem || !scope.currentActionMesh || !pickedPoint || !scope.currentActionMeshInitPosition) return;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) {
      scope.currentActionMesh = null;
      scope.currentActionMeshInitPosition = null;

      return;
    }

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as JunctionActionMeshMetadata;
    const actionMeshCategory = actionMeshMetadata.category;

    if (
      actionMeshCategory === JunctionActionMeshCategory.EdgeCatmullEdit
    ) {

      const catmullPoints = (actionMeshMetadata.relatedJunctionEdge as JunctionEdgeItem).catmullPoints;
      const catmullTangents = (actionMeshMetadata.relatedJunctionEdge as JunctionEdgeItem).catmullTangents;
      const catmullAltitude = catmullPoints[0].y;


      const actionMeshCatmullIndex = actionMeshMetadata.catmullIndex as number;
      const newCatmullPoint = pickedPoint;

      newCatmullPoint.y = catmullAltitude;

      const newEdgeCatmullPoints = [...catmullPoints];
      newEdgeCatmullPoints.splice(actionMeshCatmullIndex, 1, newCatmullPoint);

      const newEdgeCatmullTangents = [...catmullTangents];

      scope.onUnpickActionMeshEdgeCatmullEdit(actionMeshMetadata, newEdgeCatmullPoints, newEdgeCatmullTangents);
    }

    // clear after one down-move-up loop, actionMesh is active only in every loop
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
  }

  onUnpickActionMeshEdgeCatmullEdit(
    actionMeshMetadata: JunctionActionMeshMetadata,
    newEdgeCatmullPoints: Vector3[],
    newEdgeCatmullTangents: Vector3[],
  ) {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);
    if (!scope.editingJunctionItem) return;

    const junctionEdgeItem = actionMeshMetadata.relatedJunctionEdge as JunctionEdgeItem;
    const edgeId = junctionEdgeItem.edgeId;

    const opts = {
      scope,
      newEdgeCatmullPoints,
      newEdgeCatmullTangents,
      junctionId: scope.editingJunctionItem.junctionId,
      edgeId: edgeId,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullEditJunctionEdge, opts);
    scope.commitTransaction(transaction);
  }

  isNewRoadPrevAndNextConnectionRoadVertex(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);

    return !!(pickedMesh?.metadata?.isNewRoadPrevAndNextConnectionRoadVertex);
  }

  unpickAllPrevAndNextRoadVertices() {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);

    const ids = Object.keys(scope.roadVertices);
    ids.forEach((id: string) => {
      scope.roadVertices[id].material = scope.createColorMaterial(RendererConfig.mesh.roadVertexMarkerColor);
    });

    scope.firstRoadVertex = undefined;
    scope.secondRoadVertex = undefined;

    scope.makeSceneDirty();
  }

  pickPrevAndNextRoadVertex(roadVertex: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);

    roadVertex.material = scope.createColorMaterial(RendererConfig.mesh.pickedRoadVertexMarkerColor);

    scope.makeSceneDirty();
  }

  createPrevAndNextRoadVertex(
    point: Vector3,
    color: Color3,
    category: JunctionVertexCategory,
    extra: {
      roadItem: RoadItem;
    },
  ) {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);

    const id = `Junction_Editor_New_Road_PrevAndNextRoad_Vertex_${scope.roadVertexIndex}`;
    const roadVertex = scope.createMarker(point, color, id) as Mesh;
    roadVertex.metadata = {
      isNewRoadPrevAndNextConnectionRoadVertex: true,
      point,
      color,
      category,
      roadItem: extra.roadItem,
      isSelected: false,
    } as NewRoadPrevAndNextConnectionRoadVertexMetadata;

    scope.roadVertexIndex++;
    scope.roadVertices[id] = roadVertex;

    scope.makeSceneDirty();
  }

  undecorateNewRoadConnectionPrevAndNextRoads() {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);

    const ids = Object.keys(scope.roadVertices);
    ids.forEach((id: string) => {
      scope.roadVertices[id].dispose();
    });

    scope.roadVertices = {};
    scope.firstRoadVertex = undefined;
    scope.secondRoadVertex = undefined;

    scope.makeSceneDirty();
  };

  decorateNewRoadConnectionPrevAndNextRoads() {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);
    if (!scope.editingJunctionItem) return;

    const junctionItem = scope.editingJunctionItem as JunctionItem;
    const allCandidateConnections = junctionItem.allCandidateConnections;

    const nonDuplicate = allCandidateConnections.reduce((
      prev: Array<{
        roadId: string;
        roadCategory: RoadCategory;
        roadVertexCategory: JunctionVertexCategory;
      }>,
      next: {
        startRoadId: string;
        startRoadCategory: RoadCategory;
        startRoadVertexCategory: JunctionVertexCategory;
        endRoadId: string;
        endRoadCategory: RoadCategory;
        endRoadVertexCategory: JunctionVertexCategory;
      },
    ) => {
      const existStart = prev.find((item: {
        roadId: string;
        roadCategory: RoadCategory;
        roadVertexCategory: JunctionVertexCategory;
      }) => {
        return item.roadId === next.startRoadId;
      });

      if (!existStart) {
        prev.push({
          roadId: next.startRoadId,
          roadCategory: next.startRoadCategory,
          roadVertexCategory: next.startRoadVertexCategory
        });
      }

      const existEnd = prev.find((item: {
        roadId: string;
        roadCategory: RoadCategory;
        roadVertexCategory: JunctionVertexCategory;
      }) => {
        return item.roadId === next.endRoadId;
      });

      if (!existEnd) {
        prev.push({
          roadId: next.endRoadId,
          roadCategory: next.endRoadCategory,
          roadVertexCategory: next.endRoadVertexCategory
        });
      }

      return prev;
    }, []);

    nonDuplicate.forEach((r: {
      roadId: string;
      roadCategory: RoadCategory;
      roadVertexCategory: JunctionVertexCategory;
    }) => {
      const roadItem = scope.resolveRoadByRoadIdAndRoadCategory(
        r.roadId,
        r.roadCategory,
      ) as RoadItem;
      const reflineSeriePoints = roadItem.referenceLine.seriePoints;

      if (r.roadVertexCategory === JunctionVertexCategory.RoadStart) {
        scope.createPrevAndNextRoadVertex(
          reflineSeriePoints[0],
          RendererConfig.mesh.roadVertexMarkerColor,
          JunctionVertexCategory.RoadStart,
          {
            roadItem,
          },
        );
      } else if (r.roadVertexCategory === JunctionVertexCategory.RoadEnd) {
        scope.createPrevAndNextRoadVertex(
          reflineSeriePoints[reflineSeriePoints.length - 1],
          RendererConfig.mesh.roadVertexMarkerColor,
          JunctionVertexCategory.RoadEnd,
          {
            roadItem,
          },
        );
      }
    });

    scope.makeSceneDirty();
  };

  createNewConnectionRoadInJunction() {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);
    if (!scope.editingJunctionItem) return;

    if (!scope.firstRoadVertex || !scope.secondRoadVertex) {
      scope.unpickAllPrevAndNextRoadVertices();
      return;
    }

    const junctionItem = scope.editingJunctionItem as JunctionItem;
    const allCandidateConnections = junctionItem.allCandidateConnections;

    const firstRoadVertex = scope.firstRoadVertex;
    const secondRoadVertex = scope.secondRoadVertex;

    // match candidate
    const candidate = allCandidateConnections.find((c: {
      startRoadId: string;
      startRoadCategory: RoadCategory;
      startRoadVertexCategory: JunctionVertexCategory;
      endRoadId: string;
      endRoadCategory: RoadCategory;
      endRoadVertexCategory: JunctionVertexCategory;
    }) => {
      return (c.startRoadId === firstRoadVertex.roadId && c.endRoadId === secondRoadVertex.roadId) || (c.startRoadId === secondRoadVertex.roadId && c.endRoadId === firstRoadVertex.roadId);
    });

    if (!candidate) return;

    // if exist
    const involvedRoads = junctionItem.involvedRoads;

    const existInvolvedRoads = involvedRoads.find((r: {
      roadId: string;
      roadCategory: RoadCategory;
      prevJunctionVertexCategory: JunctionVertexCategory;
      nextJunctionVertexCategory: JunctionVertexCategory;
    }) => {
      const connectionRoadItem = scope.resolveRoadByRoadIdAndRoadCategory(r.roadId, r.roadCategory) as RoadItem;
      const prevRoadId = connectionRoadItem.prevRoads[0]?.roadId;
      const nextRoadId = connectionRoadItem.nextRoads[0]?.roadId;

      return candidate.startRoadId === prevRoadId && candidate.endRoadId === nextRoadId;
    });

    if (existInvolvedRoads) {
      scope.notifyInfo('已存在相同前序后序挂载方式的道路连接');
      scope.unpickAllPrevAndNextRoadVertices();
      return;
    }

    const opts = {
      scope,
      junctionId: junctionItem.junctionId,
      id: scope.resolveNextCandidateEntityId(),
      startRoadId: candidate.startRoadId,
      startRoadCategory: candidate.startRoadCategory,
      startRoadVertexCategory: candidate.startRoadVertexCategory,
      endRoadId: candidate.endRoadId,
      endRoadCategory: candidate.endRoadCategory,
      endRoadVertexCategory: candidate.endRoadVertexCategory,
    };

    const transaction = scope.createTransaction(TransactionType.CreateJunctionConnectionRoad, opts);
    const roadItem = scope.commitTransaction(transaction).entity;
    
    scope.exitEditJunction();
    scope.enterEditRoadConnection(roadItem);
  }

  onDeliverJunctionAddEdgePoint(pickedPoint: Vector3, belongingJunctionEdgeItem: JunctionEdgeItem) {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);
    if (!scope.editingJunctionItem || !pickedPoint) return;

    const oldSeriePoints = belongingJunctionEdgeItem.seriePoints;
    const virtualPointPostion = scope.resolveNearestVirtualPointPositionViaLineSeriePoints(oldSeriePoints, pickedPoint);
    const virtualPoint = scope.resolveNearestVirtualPointViaLineSeriePoints(oldSeriePoints, pickedPoint);

    const oldCatmullPoints = belongingJunctionEdgeItem.catmullPoints;
    const oldCatmullPointsPosition = oldCatmullPoints.map((v: Vector3) => {
      return scope.resolveNearestVirtualPointPositionViaLineSeriePoints(oldSeriePoints, v);
    });

    // fix y
    virtualPoint.y = oldCatmullPoints[0].y;

    const oldCatmullTangents = belongingJunctionEdgeItem.catmullTangents;

    const sameCatmullPointIdx = oldCatmullPointsPosition.findIndex((v: number) => {
      return Math.abs(v - virtualPointPostion) <= RendererConfig.scene.minimumGeoPositionDiffAmount;
    });
    if (sameCatmullPointIdx > 0) return;

    const nextCatmullPointIdx = oldCatmullPointsPosition.findIndex((v: number) => {
      return v > virtualPointPostion;
    });
    if (nextCatmullPointIdx <= 0) return;

    const newEdgeCatmullPoints = [...oldCatmullPoints];
    newEdgeCatmullPoints.splice(nextCatmullPointIdx, 0, virtualPoint);

    const generatedRawCatmullTangents = scope.generateHermiteSerieLineCatmullTangentsViaCatmullPoints(newEdgeCatmullPoints);
    const targetTangent = generatedRawCatmullTangents[nextCatmullPointIdx];

    const newEdgeCatmullTangents = [...oldCatmullTangents];
    newEdgeCatmullTangents.splice(nextCatmullPointIdx, 0, targetTangent);

    const opts = {
      scope,
      newEdgeCatmullPoints,
      newEdgeCatmullTangents,
      junctionId: scope.editingJunctionItem.junctionId,
      edgeId: belongingJunctionEdgeItem.edgeId,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullAlterJunctionEdgeCatmullSerieJunction, opts);
    scope.commitTransaction(transaction);

  }

  onDeliverJunctionRemoveEdgePoint(pickedPoint: Vector3, belongingJunctionEdgeItem: JunctionEdgeItem) {
    const scope = this as unknown as (ExtendedNamespace & JunctionEditorPlugin);
    if (!scope.editingJunctionItem || !pickedPoint) return;

    const oldSeriePoints = belongingJunctionEdgeItem.seriePoints; 

    const oldCatmullPoints = belongingJunctionEdgeItem.catmullPoints;
    // at least two catmull points
    if (oldCatmullPoints.length <= 2) return;

    const oldCatmullTangents = belongingJunctionEdgeItem.catmullTangents;

    const sameCatmullPointIdx = oldCatmullPoints.findIndex((v: Vector3) => {
      return v.subtract(pickedPoint).length() <= RendererConfig.scene.maximumSameCatmullPointDistance;
    });
    if (sameCatmullPointIdx < 0) return;

    // not first nor last
    if (sameCatmullPointIdx === 0) return;
    if (sameCatmullPointIdx === oldCatmullPoints.length - 1) return;

    const newEdgeCatmullPoints = [...oldCatmullPoints];
    newEdgeCatmullPoints.splice(sameCatmullPointIdx, 1);

    const newEdgeCatmullTangents = [...oldCatmullTangents];
    newEdgeCatmullTangents.splice(sameCatmullPointIdx, 1);


    const opts = {
      scope,
      newEdgeCatmullPoints,
      newEdgeCatmullTangents,
      junctionId: scope.editingJunctionItem.junctionId,
      edgeId: belongingJunctionEdgeItem.edgeId,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullAlterJunctionEdgeCatmullSerieJunction, opts);
    scope.commitTransaction(transaction);
  }
};