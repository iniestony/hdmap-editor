import {
  Vector3,
  Color3,
  Mesh,
  PointerInfo,
  PickingInfo,
  LinesMesh,
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  EnterPickingJunctionVertexEvent,
  ExitPickingJunctionVertexEvent,
  PickJunctionVertexEvent,
  CleanPickedJunctionVertexEvent,
  ConfirmPickedJunctionVertexEvent,
} from './constant';
import {
  JunctionVertexCategory,
  JunctionVertexMetadata,
} from './type';
import {
  LineAndCurveItem,
  ReferenceLineItem,
  LaneLineItem,
  LaneItem,
  RoadItem,
  RoadCategory,
} from '../statusManager/type';
import { TransactionType } from '../../transactions';
import { FetchAllRoadsEvent } from '../statusManager/constant';
import {
  RoadCollectionData,
} from '../atlasConverter/type';
import {
  JunctionEdge,
} from './type';

export default class JunctionDrawerPlugin extends LogicalPlugin {
  private junctionVertices: { [id: string]: Mesh };
  private junctionVertexIndex: number;
  private pickedJunctionVertices: Array<{
    roadId: string;
    roadCategory: RoadCategory;
    junctionVertexCategory: JunctionVertexCategory;
    point: Vector3;
    connectedPoint: Vector3;
  }>;
  private pickedJunctionVerticesConnectedLines: Array<LinesMesh>;

  constructor(options: PluginOptions) {
    super(options);

    this.junctionVertices = {};
    this.junctionVertexIndex = 0;
    this.pickedJunctionVertices = [];
    this.pickedJunctionVerticesConnectedLines = [];
  }

  activate() {
    super.activate();

    this.init();
  }

  init() {
    this.initEvent();
  }

  initEvent() {
    const scope = this as unknown as (ExtendedNamespace & JunctionDrawerPlugin);

    scope.registerEvent(EnterPickingJunctionVertexEvent);
    scope.onEvent(EnterPickingJunctionVertexEvent, (params: { payload: Object | string | number | null }) => {
      scope.undecorateJunctionVertices();
      scope.decorateJunctionVertices();
    });

    scope.registerEvent(ExitPickingJunctionVertexEvent);
    scope.onEvent(ExitPickingJunctionVertexEvent, (params: { payload: Object | string | number | null }) => {
      scope.undecorateJunctionVertices();
    });

    scope.registerEvent(PickJunctionVertexEvent);
    scope.onEvent(PickJunctionVertexEvent, (params: { payload: Object | string | number | null }) => {
      const pickedMesh = (params.payload as { pickedMesh: Mesh }).pickedMesh;
      if (!scope.isJunctionVertex(pickedMesh)) return;

      const metadata = pickedMesh.metadata as JunctionVertexMetadata;
      if (metadata.isSelected) {
        scope.notifyInfo('已经选择过该点');
        return;
      }

      scope.pickedJunctionVertices.push({
        roadId: metadata.relatedRoadId,
        roadCategory: metadata.relatedRoadCategory,
        junctionVertexCategory: metadata.category,
        point: metadata.point,
        connectedPoint: metadata.connectedPoint,
      });

      scope.pickJunctionVertex(pickedMesh);
      scope.createJunctionVerticesConnectedLine();
    });

    scope.registerEvent(CleanPickedJunctionVertexEvent);
    scope.onEvent(CleanPickedJunctionVertexEvent, (params: { payload: Object | string | number | null }) => {
      scope.unpickAllJunctionVertices();
    });

    scope.registerEvent(ConfirmPickedJunctionVertexEvent);
    scope.onEvent(ConfirmPickedJunctionVertexEvent, (params: { payload: Object | string | number | null }) => {
      scope.drawJunction();
    });
  }

  isJunctionVertex(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & JunctionDrawerPlugin);

    return !!(pickedMesh?.metadata?.isJunctionVertex);
  }

  unpickAllJunctionVertices() {
    const scope = this as unknown as (ExtendedNamespace & JunctionDrawerPlugin);

    const ids = Object.keys(scope.junctionVertices);
    ids.forEach((id: string) => {
      scope.junctionVertices[id].material = scope.createColorMaterial(RendererConfig.mesh.roadVertexMarkerColor);
      scope.junctionVertices[id].metadata.isSelected = false;
    });

    scope.pickedJunctionVertices = [];
    scope.disposeJunctionVerticesConnectedLines();

    scope.makeSceneDirty();
  }

  pickJunctionVertex(junctionVertex: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & JunctionDrawerPlugin);

    junctionVertex.material = scope.createColorMaterial(RendererConfig.mesh.pickedRoadVertexMarkerColor);
    junctionVertex.metadata.isSelected = true;
    
    scope.makeSceneDirty();
  }

  createJunctionVerticesConnectedLine() {
    const scope = this as unknown as (ExtendedNamespace & JunctionDrawerPlugin);

    if (scope.pickedJunctionVertices.length < 2) return;

    const connectStartPoint = scope.pickedJunctionVertices[scope.pickedJunctionVertices.length - 2].point;
    const connectEndPoint = scope.pickedJunctionVertices[scope.pickedJunctionVertices.length - 1].point;

    const connectedLineId = `Junction_Drawer_Junction_Vertex_Connected_Line_${new Date().getTime()}`;

    const lineMesh = scope.createSolidLine({
      points: [connectStartPoint, connectEndPoint],
      color: RendererConfig.junction.solidLineColor,
      id: connectedLineId,
    });

    this.pickedJunctionVerticesConnectedLines.push(lineMesh);
  }

  createJunctionVertex(
    point: Vector3,
    color: Color3,
    category: JunctionVertexCategory,
    extra: {
      relatedRoadId: string;
      relatedRoadCategory: RoadCategory;
      connectedPoint: Vector3;
    },
  ) {
    const scope = this as unknown as (ExtendedNamespace & JunctionDrawerPlugin);

    const id = `Junction_Drawer_Road_Connector_Vertex_${scope.junctionVertexIndex}`;
    const junctionVertex = scope.createMarker(
      point,
      color,
      id,
      RendererConfig.scene.junctionMarkerDiameter,
    ) as Mesh;

    junctionVertex.metadata = {
      isJunctionVertex: true,
      point,
      color,
      category,
      relatedRoadId: extra.relatedRoadId,
      relatedRoadCategory: extra.relatedRoadCategory,
      connectedPoint: extra.connectedPoint,
      isSelected: false,
    } as JunctionVertexMetadata;

    scope.junctionVertexIndex++;
    scope.junctionVertices[id] = junctionVertex;

    scope.makeSceneDirty();
  }

  undecorateJunctionVertices() {
    const scope = this as unknown as (ExtendedNamespace & JunctionDrawerPlugin);

    const ids = Object.keys(scope.junctionVertices);
    ids.forEach((id: string) => {
      scope.junctionVertices[id].dispose();
    });

    scope.junctionVertices = {};

    scope.pickedJunctionVertices = [];
    this.disposeJunctionVerticesConnectedLines();

    scope.makeSceneDirty();
  }

  decorateJunctionVertices() {
    const scope = this as unknown as (ExtendedNamespace & JunctionDrawerPlugin);

    scope.decorateRoadStartAndEnd();

    scope.makeSceneDirty();
  }

  decorateRoadStartAndEnd() {
    const scope = this as unknown as (ExtendedNamespace & JunctionDrawerPlugin);

    let rawRoadCollectionData = {} as RoadCollectionData;
    scope.emitEvent(FetchAllRoadsEvent, {
      callback: (roadCollectionData: RoadCollectionData) => {
        rawRoadCollectionData = roadCollectionData;
      }
    });

    rawRoadCollectionData.catmullSerieRoadCollection.forEach((roadItem: RoadItem) => {
      const roadConnectorPointsStart = scope.resolveRoadConnectorPoints({
        roadId: roadItem.roadId,
        roadCategory: roadItem.category,
        junctionVertexCategory: JunctionVertexCategory.RoadStart,
      });

      roadConnectorPointsStart.forEach((serie: { point: Vector3, connectedPoint: Vector3 }) => {
        scope.createJunctionVertex(
          serie.point,
          RendererConfig.mesh.roadVertexMarkerColor,
          JunctionVertexCategory.RoadStart,
          {
            relatedRoadId: roadItem.roadId,
            relatedRoadCategory: roadItem.category,
            connectedPoint: serie.connectedPoint,
          },
        );
      });

      const roadConnectorPointsEnd = scope.resolveRoadConnectorPoints({
        roadId: roadItem.roadId,
        roadCategory: roadItem.category,
        junctionVertexCategory: JunctionVertexCategory.RoadEnd,
      });

      roadConnectorPointsEnd.forEach((serie: { point: Vector3, connectedPoint: Vector3 }) => {
        scope.createJunctionVertex(
          serie.point,
          RendererConfig.mesh.roadVertexMarkerColor,
          JunctionVertexCategory.RoadEnd,
          {
            relatedRoadId: roadItem.roadId,
            relatedRoadCategory: roadItem.category,
            connectedPoint: serie.connectedPoint,
          },
        );
      });
    });
  }

  disposeJunctionVerticesConnectedLines() {
    const scope = this as unknown as (ExtendedNamespace & JunctionDrawerPlugin);

    scope.pickedJunctionVerticesConnectedLines.forEach((m: LinesMesh) => {
      m.dispose();
    });

    scope.pickedJunctionVerticesConnectedLines = [];
  }

  resolveConnectionStartAndEndViaVertices(
    firstVertex: {
      roadId: string;
      roadCategory: RoadCategory;
      junctionVertexCategory: JunctionVertexCategory;
    },
    secondVertex: {
      roadId: string;
      roadCategory: RoadCategory;
      junctionVertexCategory: JunctionVertexCategory;
    },
  ) {
    let startRoadId = firstVertex.roadId;
    let startRoadCategory = firstVertex.roadCategory;
    let startRoadVertexCategory = firstVertex.junctionVertexCategory;

    let endRoadId = secondVertex.roadId;
    let endRoadCategory = secondVertex.roadCategory;
    let endRoadVertexCategory = secondVertex.junctionVertexCategory;

    if (firstVertex.junctionVertexCategory === JunctionVertexCategory.RoadStart && secondVertex.junctionVertexCategory === JunctionVertexCategory.RoadStart) {
      startRoadId = firstVertex.roadId;
      startRoadCategory = firstVertex.roadCategory;
      startRoadVertexCategory = firstVertex.junctionVertexCategory;

      endRoadId = secondVertex.roadId;
      endRoadCategory = secondVertex.roadCategory;
      endRoadVertexCategory = secondVertex.junctionVertexCategory;
    } else if (firstVertex.junctionVertexCategory === JunctionVertexCategory.RoadStart && secondVertex.junctionVertexCategory === JunctionVertexCategory.RoadEnd) {
      startRoadId = secondVertex.roadId;
      startRoadCategory = secondVertex.roadCategory;
      startRoadVertexCategory = secondVertex.junctionVertexCategory;

      endRoadId = firstVertex.roadId;
      endRoadCategory = firstVertex.roadCategory;
      endRoadVertexCategory = firstVertex.junctionVertexCategory;
    } else if (firstVertex.junctionVertexCategory === JunctionVertexCategory.RoadEnd && secondVertex.junctionVertexCategory === JunctionVertexCategory.RoadStart) {
      startRoadId = firstVertex.roadId;
      startRoadCategory = firstVertex.roadCategory;
      startRoadVertexCategory = firstVertex.junctionVertexCategory;

      endRoadId = secondVertex.roadId;
      endRoadCategory = secondVertex.roadCategory;
      endRoadVertexCategory = secondVertex.junctionVertexCategory;
    } else if (firstVertex.junctionVertexCategory === JunctionVertexCategory.RoadEnd && secondVertex.junctionVertexCategory === JunctionVertexCategory.RoadEnd) {
      startRoadId = firstVertex.roadId;
      startRoadCategory = firstVertex.roadCategory;
      startRoadVertexCategory = firstVertex.junctionVertexCategory;

      endRoadId = secondVertex.roadId;
      endRoadCategory = secondVertex.roadCategory;
      endRoadVertexCategory = secondVertex.junctionVertexCategory;
    }

    return {
      startRoadId,
      startRoadCategory,
      startRoadVertexCategory,
      endRoadId,
      endRoadCategory,
      endRoadVertexCategory,
    };
  }

  drawJunction() {
    const scope = this as unknown as (ExtendedNamespace & JunctionDrawerPlugin);

    if (scope.pickedJunctionVertices.length === 0){
      scope.notifyInfo('请先点选路口控制点');

      return;
    };

    if (scope.pickedJunctionVertices.length % 2 !== 0){
      scope.notifyInfo('路口尚未形成有效闭环');

      return;
    };

    if (scope.pickedJunctionVertices.length < 6){
      scope.notifyInfo('仅有两条道路时，请使用道路连接');

      scope.exitDrawJunction();
      return;
    };

    // judge starting from same road or not
    const formattedPickedJunctionVertices = [...scope.pickedJunctionVertices];

    const first = formattedPickedJunctionVertices[0];
    const second = formattedPickedJunctionVertices[1];

    if (first.roadId === second.roadId && first.roadCategory === second.roadCategory) {
      formattedPickedJunctionVertices.shift();
      formattedPickedJunctionVertices.push(first);
    }

    // connections
    const pickedRoads = [] as Array<{
      roadId: string;
      roadCategory: RoadCategory;
      junctionVertexCategory: JunctionVertexCategory;
    }>;

    formattedPickedJunctionVertices.forEach((p: {
      roadId: string;
      roadCategory: RoadCategory;
      junctionVertexCategory: JunctionVertexCategory;
      point: Vector3;
      connectedPoint: Vector3;
    }) => {
      const exist = pickedRoads.some((r: {
        roadId: string;
        roadCategory: RoadCategory;
        junctionVertexCategory: JunctionVertexCategory;
      }) => {
        return p.roadId === r.roadId;
      });

      if (!exist) {
        pickedRoads.push({
          roadId: p.roadId,
          roadCategory: p.roadCategory,
          junctionVertexCategory: p.junctionVertexCategory,
        });
      }
    });

    const connections = [];

    for (let i = 0; i < pickedRoads.length - 1; i++) {
      for(let j = i + 1; j < pickedRoads.length; j++) {
        connections.push(scope.resolveConnectionStartAndEndViaVertices(pickedRoads[i], pickedRoads[j]));
      }
    }

    // filter turned a lot connections
    const filteredConnections = connections.filter((c: {
      startRoadId: string;
      startRoadCategory: RoadCategory;
      startRoadVertexCategory: JunctionVertexCategory;
      endRoadId: string;
      endRoadCategory: RoadCategory;
      endRoadVertexCategory: JunctionVertexCategory;
    }) => {
      const startRoadItem = scope.resolveRoadByRoadIdAndRoadCategory(c.startRoadId, c.startRoadCategory) as RoadItem;
      const endRoadItem = scope.resolveRoadByRoadIdAndRoadCategory(c.endRoadId, c.endRoadCategory) as RoadItem;

      const reflineCollection = scope.resolveConnectionRoadInitRefLineSerieCollection(
        startRoadItem,
        endRoadItem,
        c.startRoadVertexCategory,
        c.endRoadVertexCategory,
      );
  
      const serieTangents = reflineCollection.serieTangents as Vector3[];
      const turnMeasure = Vector3.Dot(serieTangents[0].normalize(), serieTangents[serieTangents.length - 1].normalize());

      return turnMeasure > RendererConfig.junction.maximumInitConnectionTurnMeasure;
    });

    // edges
    const edges = [] as Array<JunctionEdge>;

    for (let i = 0; i < formattedPickedJunctionVertices.length; i+=2) {
      const firstVertex = formattedPickedJunctionVertices[i];
      const secondVertex = formattedPickedJunctionVertices[i + 1];

      edges.push({
        roadIds: [firstVertex.roadId, secondVertex.roadId],
        roadCategories: [firstVertex.roadCategory, secondVertex.roadCategory],
        junctionVertexCategories: [firstVertex.junctionVertexCategory, secondVertex.junctionVertexCategory],
        roadVertices: [firstVertex.point, secondVertex.point],
        connectedRoadVertices: [firstVertex.connectedPoint, secondVertex.connectedPoint],
      });
    }

    const opts = {
      scope,
      junctionId: scope.resolveNextCandidateEntityId(),
      allCandidateConnections: connections,
      connections: filteredConnections,
      edges,
    };

    const transaction = scope.createTransaction(TransactionType.CreateJunction, opts);
    const junctionItem = scope.commitTransaction(transaction).entity;

    scope.enterEditJunction(junctionItem);
  }
}