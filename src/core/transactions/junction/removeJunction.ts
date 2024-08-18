import {
  Vector3,
  Color3,
  MeshBuilder,
  LinesMesh,
  Mesh,
  Curve3,
} from "@babylonjs/core";
import StandardTransaction from '../general/standard';
import {
  LineAndCurveCategory,
  LineAndCurveItem,
  LaneItem,
  RoadItem,
  RoadCategory,
  LaneSide,
  LaneLineSide,
  MarkerSide,
  LaneLineItem,
  ReferenceLineItem,
  LaneItemKeyInfo,
  RoadItemKeyInfo,
  JunctionItem,
  JunctionItemKeyInfo,
  JunctionEdgeItem,
  JunctionEdgeItemKeyInfo,
} from '../../plugins/statusManager/type';
import {
  StoreRoadEvent,
  RemoveRoadEvent,
  ReformatRoadEvent,
  StoreJunctionEvent,
  RemoveJunctionEvent,
  StoreDirtyRoadEvent,
  StoreDirtyJunctionEvent,
} from '../../plugins/statusManager/constant';
import { LineType } from '../../plugins/lineDrawer/type';
import { JunctionVertexCategory } from '../../plugins/junctionDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  AtlasRoad,
  AtlasLane,
} from '../../plugins/atlasConverter/type';
import {
  InvokeCreateConnectionRoadEvent,
  InvokeRemoveConnectionRoadEvent,
  InvokeCreateJunctionEvent,
  InvokeRemoveJunctionEvent,
} from '../event';

export default class RemoveJunctionTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;

  private junctionId: string;
  
  private junctionItem?: JunctionItem;
  private junctionItemKeyInfo?: JunctionItemKeyInfo;
  private connectionRoadItemList: Array<{
    roadId: string;
    roadCategory: RoadCategory;
    roadItem: RoadItem;
  }>;
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.junctionId = (options as unknown as { junctionId: string }).junctionId;
    this.connectionRoadItemList = [];
  }

  commit() {
    super.commit();

    this.resolveNecessaryInfo();
    this.removeJunction();

    return { junctionId: this.junctionId };
  }

  onUndo() {
    super.onUndo();
    this.createJunction();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.removeJunction();
  }

  resolveNecessaryInfo() {
    this.junctionItem = this.scope.resolveJunctionByJunctionId(this.junctionId) as JunctionItem;
    this.junctionItemKeyInfo = this.scope.resolveJunctionItemKeyInfo(this.junctionItem) as JunctionItemKeyInfo;

    this.connectionRoadItemList = this.junctionItemKeyInfo.involvedRoads.map((cRoad: {
      roadId: string;
      roadCategory: RoadCategory;
      prevJunctionVertexCategory: JunctionVertexCategory;
      nextJunctionVertexCategory: JunctionVertexCategory;
    }) => {
      const roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(cRoad.roadId, cRoad.roadCategory) as RoadItem;

      return {
        roadId: cRoad.roadId,
        roadCategory: cRoad.roadCategory,
        roadItem: roadItem,
      };
    });
  }

  createConnectionRoad(oldRoadItem: RoadItem) {
    const newRoadItem = {
      referenceLine: oldRoadItem.referenceLine,
      referenceLineEditable: oldRoadItem.referenceLineEditable,
      surfaceLines: [],
      laneItems: {
        leftLanes: [],
        rightLanes: [],
      },
      startPointNormal: oldRoadItem.startPointNormal,
      endPointNormal: oldRoadItem.endPointNormal,
      startPointTangent: oldRoadItem.startPointTangent,
      endPointTangent: oldRoadItem.endPointTangent,
      generalLeftLaneIndex: oldRoadItem.generalLeftLaneIndex,
      generalRightLaneIndex: oldRoadItem.generalRightLaneIndex,
      category: oldRoadItem.category,
      roadId: oldRoadItem.roadId,
      roadPID: oldRoadItem.roadPID,
      position: oldRoadItem.position,
      rotation: oldRoadItem.rotation,
      atlasRoadType: oldRoadItem.atlasRoadType,
      matAlpha: oldRoadItem.matAlpha,
      prevRoads: [...oldRoadItem.prevRoads],
      nextRoads: [...oldRoadItem.nextRoads],
      junctionId: oldRoadItem.junctionId,
    } as RoadItem;

    // store first
    this.scope.emitEvent(StoreRoadEvent, newRoadItem);

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: newRoadItem.roadPID,
      roadId: newRoadItem.roadId,
      roadCategory: newRoadItem.category,
    });

    this.scope.emitEvent(InvokeCreateConnectionRoadEvent, {
      roadId: newRoadItem.roadId,
    });

    // reformat then
    const roadItemKeyInfo = this.scope.resolveRoadItemKeyInfo(oldRoadItem) as RoadItemKeyInfo;

    this.scope.emitEvent(ReformatRoadEvent, {
      roadId: roadItemKeyInfo.roadId,
      roadCategory: roadItemKeyInfo.category,
      roadItemKeyInfo: roadItemKeyInfo,
      reflineKeyPoints: roadItemKeyInfo.referenceLine.points,
    });

    this.scope.attachRoadInPrevAndNext(newRoadItem);
    newRoadItem.laneItems.leftLanes.forEach((l: LaneItem) => {
      this.scope.attachLaneInPrevAndNext(l, newRoadItem);
    });
    newRoadItem.laneItems.rightLanes.forEach((l: LaneItem) => {
      this.scope.attachLaneInPrevAndNext(l, newRoadItem);
    });

    this.scope.makeSceneDirty();
  }

  removeConnectionRoad(connectionRoadItem: RoadItem) {
    this.scope.detachRoadInPrevAndNext(connectionRoadItem);
    connectionRoadItem.laneItems.leftLanes.forEach((l: LaneItem) => {
      this.scope.detachLaneInPrevAndNext(l, connectionRoadItem);
    });
    connectionRoadItem.laneItems.rightLanes.forEach((l: LaneItem) => {
      this.scope.detachLaneInPrevAndNext(l, connectionRoadItem);
    });

    this.scope.emitEvent(RemoveRoadEvent, {
      id: connectionRoadItem.roadId,
      category: connectionRoadItem.category,
    });

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: connectionRoadItem.roadPID,
      roadId: connectionRoadItem.roadId,
      roadCategory: connectionRoadItem.category,
    });

    this.scope.emitEvent(InvokeRemoveConnectionRoadEvent, {
      roadId: connectionRoadItem.roadId,
    });
  }

  createJunction() {
    const junctionItemKeyInfo = this.junctionItemKeyInfo as JunctionItemKeyInfo;
    
    this.connectionRoadItemList.forEach((c: {
      roadId: string;
      roadCategory: RoadCategory;
      roadItem: RoadItem;
    }) => {
      this.createConnectionRoad(c.roadItem);
    });

    const junctionMeshAndEdges = this.scope.reformatJunctionMeshAndEdges(junctionItemKeyInfo);

    const junctionItem = {
      junctionId: this.junctionId,
      junctionPID: junctionItemKeyInfo.junctionPID,
      junctionType: junctionItemKeyInfo.junctionType,
      allCandidateConnections: junctionItemKeyInfo.allCandidateConnections.map((r: {
        startRoadId: string;
        startRoadCategory: RoadCategory;
        startRoadVertexCategory: JunctionVertexCategory;
        endRoadId: string;
        endRoadCategory: RoadCategory;
        endRoadVertexCategory: JunctionVertexCategory;
      }) => {
        return {
          startRoadId: r.startRoadId,
          startRoadCategory: r.startRoadCategory,
          startRoadVertexCategory: r.startRoadVertexCategory,
          endRoadId: r.endRoadId,
          endRoadCategory: r.endRoadCategory,
          endRoadVertexCategory: r.endRoadVertexCategory,
        };
      }),
      involvedRoads: junctionItemKeyInfo.involvedRoads.map((c: {
        roadId: string;
        roadCategory: RoadCategory;
        prevJunctionVertexCategory: JunctionVertexCategory;
        nextJunctionVertexCategory: JunctionVertexCategory;
      }) => {
        return {
          roadId: c.roadId,
          roadCategory: c.roadCategory,
          prevJunctionVertexCategory: c.prevJunctionVertexCategory,
          nextJunctionVertexCategory: c.nextJunctionVertexCategory,
        };
      }),
      edges: junctionMeshAndEdges.edges,
      junctionMesh: junctionMeshAndEdges.junctionMesh,
    } as JunctionItem;

    junctionItem.junctionMesh.metadata = {
      belongingJunctionItem: junctionItem,
    };

    this.scope.emitEvent(StoreJunctionEvent, junctionItem);

    this.scope.emitEvent(StoreDirtyJunctionEvent, {
      junctionId: junctionItem.junctionId,
      junctionPID: junctionItem.junctionPID,
    });

    this.scope.emitEvent(InvokeCreateJunctionEvent, {
      junctionId: this.junctionId,
    });

    this.scope.makeSceneDirty();

    return junctionItem;
  }

  removeJunction() {
    const junctionItem = this.junctionItem as JunctionItem;

    junctionItem.involvedRoads.forEach((iRoad: {
      roadId: string;
      roadCategory: RoadCategory;
      prevJunctionVertexCategory: JunctionVertexCategory;
      nextJunctionVertexCategory: JunctionVertexCategory;
    }) => {
      const connectionRoadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(iRoad.roadId, iRoad.roadCategory) as RoadItem;
      
      this.removeConnectionRoad(connectionRoadItem);
    });

    this.scope.emitEvent(RemoveJunctionEvent, {
      id: junctionItem.junctionId,
    });

    this.scope.emitEvent(StoreDirtyJunctionEvent, {
      junctionId: junctionItem.junctionId,
      junctionPID: junctionItem.junctionPID,
    });

    this.scope.emitEvent(InvokeRemoveJunctionEvent, {
      junctionId: this.junctionId,
    });
  }
};