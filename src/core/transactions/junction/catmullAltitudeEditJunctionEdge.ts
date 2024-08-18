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
  ReformatJunctionEvent,
  StoreDirtyJunctionEvent,
} from '../../plugins/statusManager/constant';
import { JunctionVertexCategory } from '../../plugins/junctionDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  InvokeCatmullEditEdgeJunctionEvent,
} from '../event';

export default class CatmullAltitudeEditJunctionEdgeTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;

  private junctionId: string;
  private edges: Array<{
    edgeId: string;
    isStart: boolean;
    relatedRoadId: string;
    relatedRoadCategory: RoadCategory;
    isRelatedRoadStart: boolean;
    isRelatedRoadLeftMost: boolean;
  }>;

  private junctionItem?: JunctionItem;
  private oldJunctionItemKeyInfo?: JunctionItemKeyInfo;
  private newJunctionItemKeyInfo?: JunctionItemKeyInfo;

  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.junctionId = (options as unknown as { junctionId: string }).junctionId;
    this.edges = (options as unknown as { edges: Array<{
      edgeId: string;
      isStart: boolean;
      relatedRoadId: string;
      relatedRoadCategory: RoadCategory;
      isRelatedRoadStart: boolean;
      isRelatedRoadLeftMost: boolean;
    }> }).edges;
  }

  commit() {
    super.commit();

    this.resolveNecessaryInfo();
    this.reformatNewJunction();

    return { junctionId: this.junctionId };
  }

  onUndo() {
    super.onUndo();
    this.reformatOldJunction();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.reformatNewJunction();
  }

  resolveNecessaryInfo() {
    this.junctionItem = this.scope.resolveJunctionByJunctionId(this.junctionId) as JunctionItem;
    this.oldJunctionItemKeyInfo = this.scope.resolveJunctionItemKeyInfo(this.junctionItem) as JunctionItemKeyInfo;
    this.newJunctionItemKeyInfo = this.generateNewKeyInfoFromOldKeyInfo(this.oldJunctionItemKeyInfo) as JunctionItemKeyInfo;
  }

  generateNewKeyInfoFromOldKeyInfo(oldJunctionItemKeyInfo: JunctionItemKeyInfo) {
    const oldJunctionEdgeItemsKeyInfo = oldJunctionItemKeyInfo.edges as JunctionEdgeItemKeyInfo[];
   
    const newJunctionEdgeItemsKeyInfo = oldJunctionEdgeItemsKeyInfo.map((junctionEdgeItemKeyInfo: JunctionEdgeItemKeyInfo) => {
      const targetEdge = this.edges.find((edge: {
        edgeId: string;
      }) => {
        return junctionEdgeItemKeyInfo.edgeId === edge.edgeId;
      });


      if (targetEdge) {
        const catmullPoints_raw = [...junctionEdgeItemKeyInfo.catmullPoints];
        const catmullTangents_raw = [...junctionEdgeItemKeyInfo.catmullTangents];

        const seriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
          catmullPoints_raw,
          catmullTangents_raw,
          junctionEdgeItemKeyInfo.seriePoints.length,
        );

        // connector points
        const roadConnectorPoints = this.scope.resolveRoadConnectorPoints({
          roadId: targetEdge.relatedRoadId,
          roadCategory: targetEdge.relatedRoadCategory,
          junctionVertexCategory: targetEdge.isRelatedRoadStart ? JunctionVertexCategory.RoadStart : JunctionVertexCategory.RoadEnd,
        });
        
        const leftMostPoint = roadConnectorPoints[0].point as Vector3;
        const rightMostPoint = roadConnectorPoints[1].point as Vector3;

        const compAltitude = targetEdge.isRelatedRoadLeftMost ? leftMostPoint.y : rightMostPoint.y;

        const altitudeCatmullPoints = [...junctionEdgeItemKeyInfo.altitudeCatmullPoints];

        if (targetEdge.isStart) {
          const _old = altitudeCatmullPoints[0];
          altitudeCatmullPoints[0] = new Vector3(_old.x, _old.y, compAltitude);
        } else {
          const _old = altitudeCatmullPoints[altitudeCatmullPoints.length - 1];
          altitudeCatmullPoints[altitudeCatmullPoints.length - 1] = new Vector3(_old.x, _old.y, compAltitude);
        }

        const altitudeCatmullTangents = [...junctionEdgeItemKeyInfo.altitudeCatmullTangents];

        const applied = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
          catmullPoints_raw,
          seriePoints_raw,
          altitudeCatmullPoints,
          altitudeCatmullTangents,
        );
  
        const catmullPoints = applied.appliedCatmullPoints;
        const seriePoints = applied.appliedSeriePoints;
        const catmullTangents = catmullTangents_raw;

        return {
          seriePoints: [...seriePoints],
          catmullPoints: [...catmullPoints],
          catmullTangents: [...catmullTangents],
          altitudeCatmullPoints: [...altitudeCatmullPoints],
          altitudeCatmullTangents: [...altitudeCatmullTangents],
          edgeId: junctionEdgeItemKeyInfo.edgeId,
          options: {...junctionEdgeItemKeyInfo.options},
        };
      } else {
        return {
          seriePoints: [...junctionEdgeItemKeyInfo.seriePoints],
          catmullPoints: [...junctionEdgeItemKeyInfo.catmullPoints],
          catmullTangents: [...junctionEdgeItemKeyInfo.catmullTangents],
          altitudeCatmullPoints: [...junctionEdgeItemKeyInfo.altitudeCatmullPoints],
          altitudeCatmullTangents: [...junctionEdgeItemKeyInfo.altitudeCatmullTangents],
          edgeId: junctionEdgeItemKeyInfo.edgeId,
          options: {...junctionEdgeItemKeyInfo.options},
        };
      }
    }) as JunctionEdgeItemKeyInfo[];

    const newKeyInfo = {
      junctionId: oldJunctionItemKeyInfo.junctionId,
      junctionPID: oldJunctionItemKeyInfo.junctionPID,
      junctionType: oldJunctionItemKeyInfo.junctionType,
      allCandidateConnections: [...oldJunctionItemKeyInfo.allCandidateConnections],
      involvedRoads: [...oldJunctionItemKeyInfo.involvedRoads],
      edges: newJunctionEdgeItemsKeyInfo,
    } as JunctionItemKeyInfo;
    
    return newKeyInfo;
  }

  reformatNewJunction() {
    const junctionItemKeyInfo = this.newJunctionItemKeyInfo as JunctionItemKeyInfo;

    this.scope.emitEvent(ReformatJunctionEvent, {
      junctionId: junctionItemKeyInfo.junctionId,
      junctionItemKeyInfo: junctionItemKeyInfo,
    });

    this.scope.emitEvent(StoreDirtyJunctionEvent, {
      junctionId: junctionItemKeyInfo.junctionId,
      junctionPID: junctionItemKeyInfo.junctionPID,
    });

    this.scope.emitEvent(InvokeCatmullEditEdgeJunctionEvent, {
      junctionId: junctionItemKeyInfo.junctionId,
    });
  }

  reformatOldJunction() {
    const junctionItemKeyInfo = this.oldJunctionItemKeyInfo as JunctionItemKeyInfo;

    this.scope.emitEvent(ReformatJunctionEvent, {
      junctionId: junctionItemKeyInfo.junctionId,
      junctionItemKeyInfo: junctionItemKeyInfo,
    });

    this.scope.emitEvent(StoreDirtyJunctionEvent, {
      junctionId: junctionItemKeyInfo.junctionId,
      junctionPID: junctionItemKeyInfo.junctionPID,
    });

    this.scope.emitEvent(InvokeCatmullEditEdgeJunctionEvent, {
      junctionId: junctionItemKeyInfo.junctionId,
    });
  }
};