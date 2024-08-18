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

export default class CatmullEditJunctionEdgeTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;

  private junctionId: string;
  private edgeId: string;
  private newEdgeCatmullPoints: Vector3[];
  private newEdgeCatmullTangents: Vector3[];

  private junctionItem?: JunctionItem;
  private oldJunctionItemKeyInfo?: JunctionItemKeyInfo;
  private newJunctionItemKeyInfo?: JunctionItemKeyInfo;

  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.junctionId = (options as unknown as { junctionId: string }).junctionId;
    this.edgeId = (options as unknown as { edgeId: string }).edgeId;
    this.newEdgeCatmullPoints = (options as unknown as { newEdgeCatmullPoints: Vector3[] }).newEdgeCatmullPoints;
    this.newEdgeCatmullTangents = (options as unknown as { newEdgeCatmullTangents: Vector3[] }).newEdgeCatmullTangents;
  }

  commit() {
    super.commit();

    this.resolveNecessaryInfo();
    this.reformatNewJunction();

    return { edgeId: this.edgeId };
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

    const targetEdgeIndex = oldJunctionEdgeItemsKeyInfo.findIndex((junctionEdgeItemKeyInfo: JunctionEdgeItemKeyInfo) => {
      return junctionEdgeItemKeyInfo.edgeId === this.edgeId;
    });
   
    const newJunctionEdgeItemsKeyInfo = oldJunctionEdgeItemsKeyInfo.map((junctionEdgeItemKeyInfo: JunctionEdgeItemKeyInfo, edgeIdx: number) => {
      if (edgeIdx === targetEdgeIndex) {
        const catmullPoints_raw = [...this.newEdgeCatmullPoints];
        const catmullTangents_raw = [...this.newEdgeCatmullTangents];

        const seriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
          catmullPoints_raw,
          catmullTangents_raw,
          junctionEdgeItemKeyInfo.seriePoints.length,
        );

        const altitudeCatmullPoints = [...junctionEdgeItemKeyInfo.altitudeCatmullPoints];
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