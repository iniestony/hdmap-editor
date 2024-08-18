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
  EnterPickingRoadVertexEvent,
  ExitPickingRoadVertexEvent,
  PickRoadVertexEvent,
  CleanPickedRoadVertexEvent,
} from './constant';
import {
  RoadVertexCategory,
  RoadVertexMetadata,
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
import { FetchAllRoadsEvent } from '../statusManager/constant';
import {
  RoadCollectionData,
} from '../atlasConverter/type';


export default class RoadConnectionDrawerPlugin extends LogicalPlugin {
  private roadVertices: { [id: string]: Mesh };
  private roadVertexIndex: number;
  private firstRoadVertex?: {
    roadId: string;
    roadCategory: RoadCategory;
    roadVertexCategory: RoadVertexCategory;
  };
  private secondRoadVertex?: {
    roadId: string;
    roadCategory: RoadCategory;
    roadVertexCategory: RoadVertexCategory;
  };

  constructor(options: PluginOptions) {
    super(options);

    this.roadVertices = {};
    this.roadVertexIndex = 0;
  }

  activate() {
    super.activate();
    
    this.init();
  }

  init() {
    this.initEvent();
  }

  initEvent() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionDrawerPlugin);

    scope.registerEvent(EnterPickingRoadVertexEvent);
    scope.onEvent(EnterPickingRoadVertexEvent, (params: { payload: Object | string | number | null }) => {
      scope.undecorateRoadVertices();
      scope.decorateRoadVertices();
    });

    scope.registerEvent(ExitPickingRoadVertexEvent);
    scope.onEvent(ExitPickingRoadVertexEvent, (params: { payload: Object | string | number | null }) => {
      scope.undecorateRoadVertices();
    });

    scope.registerEvent(PickRoadVertexEvent);
    scope.onEvent(PickRoadVertexEvent, (params: { payload: Object | string | number | null }) => {
      const pickedMesh = (params.payload as { pickedMesh: Mesh }).pickedMesh;

      if (!scope.isRoadVertex(pickedMesh)) return;
      if (scope.isDuplicatedPickedRoadVertex(pickedMesh)) return;

      const metadata = pickedMesh.metadata as RoadVertexMetadata;

      if (scope.firstRoadVertex === undefined) {
        scope.unpickAllRoadVertices();
        scope.pickRoadVertex(pickedMesh);

        scope.firstRoadVertex = {
          roadId: metadata.relatedRoadId,
          roadCategory: metadata.relatedRoadCategory,
          roadVertexCategory: metadata.category,
        };
      } else if (scope.secondRoadVertex === undefined) {
        scope.pickRoadVertex(pickedMesh);

        scope.secondRoadVertex = {
          roadId: metadata.relatedRoadId,
          roadCategory: metadata.relatedRoadCategory,
          roadVertexCategory: metadata.category,
        };
        
        scope.drawRoadConnection();
      }
    });

    scope.registerEvent(CleanPickedRoadVertexEvent);
    scope.onEvent(CleanPickedRoadVertexEvent, (params: { payload: Object | string | number | null }) => {
      scope.unpickAllRoadVertices();
    });
  }

  isRoadVertex(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionDrawerPlugin);

    return !!(pickedMesh?.metadata?.isRoadVertex);
  }

  isDuplicatedPickedRoadVertex(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionDrawerPlugin);

    const metadata = pickedMesh.metadata as RoadVertexMetadata;

    if (scope.firstRoadVertex) {
      if (scope.firstRoadVertex.roadId === metadata.relatedRoadId && scope.firstRoadVertex.roadCategory === metadata.relatedRoadCategory) return true;
    }

    if (scope.secondRoadVertex) {
      if (scope.secondRoadVertex.roadId === metadata.relatedRoadId && scope.secondRoadVertex.roadCategory === metadata.relatedRoadCategory) return true;
    }

    return false;
  }

  unpickAllRoadVertices() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionDrawerPlugin);

    const ids = Object.keys(scope.roadVertices);
    ids.forEach((id: string) => {
      scope.roadVertices[id].material = scope.createColorMaterial(RendererConfig.mesh.roadVertexMarkerColor);
    });

    scope.firstRoadVertex = undefined;
    scope.secondRoadVertex = undefined;

    scope.makeSceneDirty();
  }

  pickRoadVertex(roadVertex: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionDrawerPlugin);

    roadVertex.material = scope.createColorMaterial(RendererConfig.mesh.pickedRoadVertexMarkerColor);

    scope.makeSceneDirty();
  }

  createRoadVertex(
    point: Vector3,
    color: Color3,
    category: RoadVertexCategory,
    extra: {
      relatedRoadId: string;
      relatedRoadCategory: RoadCategory;
    },
  ) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionDrawerPlugin);

    const id = `Road_Connection_Drawer_Road_Vertex_${scope.roadVertexIndex}`;
    const roadVertex = scope.createMarker(point, color, id) as Mesh;
    roadVertex.metadata = {
      isRoadVertex: true,
      point,
      color,
      category,
      relatedRoadId: extra.relatedRoadId,
      relatedRoadCategory: extra.relatedRoadCategory,
    } as RoadVertexMetadata;

    scope.roadVertexIndex++;
    scope.roadVertices[id] = roadVertex;

    scope.makeSceneDirty();
  }

  undecorateRoadVertices() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionDrawerPlugin);

    const ids = Object.keys(scope.roadVertices);
    ids.forEach((id: string) => {
      scope.roadVertices[id].dispose();
    });
    
    scope.roadVertices = {};
    scope.firstRoadVertex = undefined;
    scope.secondRoadVertex = undefined;

    scope.makeSceneDirty();
  }

  decorateRoadVertices() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionDrawerPlugin);
    
    scope.decorateRoadStartAndEnd();

    scope.makeSceneDirty();
  }

  decorateRoadStartAndEnd() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionDrawerPlugin);

    let rawRoadCollectionData = {} as RoadCollectionData;
    scope.emitEvent(FetchAllRoadsEvent, {
      callback: (roadCollectionData: RoadCollectionData) => {
        rawRoadCollectionData = roadCollectionData;
      }
    });

    rawRoadCollectionData.catmullSerieRoadCollection.forEach((roadItem: RoadItem) => {
      const referenceLineSeriePoints = roadItem.referenceLine.seriePoints;

      scope.createRoadVertex(
        referenceLineSeriePoints[0],
        RendererConfig.mesh.roadVertexMarkerColor,
        RoadVertexCategory.RoadStart,
        {
          relatedRoadId: roadItem.roadId,
          relatedRoadCategory: roadItem.category,
        },
      );

      scope.createRoadVertex(
        referenceLineSeriePoints[referenceLineSeriePoints.length - 1],
        RendererConfig.mesh.roadVertexMarkerColor,
        RoadVertexCategory.RoadEnd,
        {
          relatedRoadId: roadItem.roadId,
          relatedRoadCategory: roadItem.category,
        },
      );
    });
  }

  drawRoadConnection() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionDrawerPlugin);

    if (!scope.firstRoadVertex || !scope.secondRoadVertex) return;

    let startRoadId = scope.firstRoadVertex.roadId;
    let startRoadCategory = scope.firstRoadVertex.roadCategory;
    let startRoadVertexCategory = scope.firstRoadVertex.roadVertexCategory;

    let endRoadId = scope.secondRoadVertex.roadId;
    let endRoadCategory = scope.secondRoadVertex.roadCategory;
    let endRoadVertexCategory = scope.secondRoadVertex.roadVertexCategory;

    if (scope.firstRoadVertex.roadVertexCategory === RoadVertexCategory.RoadStart && scope.secondRoadVertex.roadVertexCategory === RoadVertexCategory.RoadStart) {
      startRoadId = scope.firstRoadVertex.roadId;
      startRoadCategory = scope.firstRoadVertex.roadCategory;
      startRoadVertexCategory = scope.firstRoadVertex.roadVertexCategory;
  
      endRoadId = scope.secondRoadVertex.roadId;
      endRoadCategory = scope.secondRoadVertex.roadCategory;
      endRoadVertexCategory = scope.secondRoadVertex.roadVertexCategory;
    } else if (scope.firstRoadVertex.roadVertexCategory === RoadVertexCategory.RoadStart && scope.secondRoadVertex.roadVertexCategory === RoadVertexCategory.RoadEnd) {
      startRoadId = scope.secondRoadVertex.roadId;
      startRoadCategory = scope.secondRoadVertex.roadCategory;
      startRoadVertexCategory = scope.secondRoadVertex.roadVertexCategory;
  
      endRoadId = scope.firstRoadVertex.roadId;
      endRoadCategory = scope.firstRoadVertex.roadCategory;
      endRoadVertexCategory = scope.firstRoadVertex.roadVertexCategory;
    } else if (scope.firstRoadVertex.roadVertexCategory === RoadVertexCategory.RoadEnd && scope.secondRoadVertex.roadVertexCategory === RoadVertexCategory.RoadStart) {
      startRoadId = scope.firstRoadVertex.roadId;
      startRoadCategory = scope.firstRoadVertex.roadCategory;
      startRoadVertexCategory = scope.firstRoadVertex.roadVertexCategory;
  
      endRoadId = scope.secondRoadVertex.roadId;
      endRoadCategory = scope.secondRoadVertex.roadCategory;
      endRoadVertexCategory = scope.secondRoadVertex.roadVertexCategory;
    } else if (scope.firstRoadVertex.roadVertexCategory === RoadVertexCategory.RoadEnd && scope.secondRoadVertex.roadVertexCategory === RoadVertexCategory.RoadEnd) {
      startRoadId = scope.firstRoadVertex.roadId;
      startRoadCategory = scope.firstRoadVertex.roadCategory;
      startRoadVertexCategory = scope.firstRoadVertex.roadVertexCategory;
  
      endRoadId = scope.secondRoadVertex.roadId;
      endRoadCategory = scope.secondRoadVertex.roadCategory;
      endRoadVertexCategory = scope.secondRoadVertex.roadVertexCategory;
    }

    const opts = {
      scope,
      id: scope.resolveNextCandidateEntityId(),
      startRoadId,
      startRoadCategory,
      startRoadVertexCategory,
      endRoadId,
      endRoadCategory,
      endRoadVertexCategory,
    };

    const transaction = scope.createTransaction(TransactionType.CreateConnectionRoad, opts);
    const roadItem = scope.commitTransaction(transaction).entity;
    
    scope.enterEditRoadConnection(roadItem);
  }
}