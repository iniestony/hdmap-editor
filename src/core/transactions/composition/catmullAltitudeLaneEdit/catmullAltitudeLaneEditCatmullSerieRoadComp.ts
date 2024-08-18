import {
  Vector3,
  Color3,
  MeshBuilder,
  LinesMesh,
  Mesh,
  Curve3,
} from "@babylonjs/core";
import CompositionTransaction from '../../general/composition';
import {
  LineAndCurveCategory,
  LineAndCurveItem,
  LaneItem,
  RoadItem,
  RoadCategory,
  LaneSide,
  LaneLineSide,
  MarkerSide,
  LineAndCurveItemKeyInfo,
  LaneLineItemKeyInfo,
  LaneItemKeyInfo,
  RoadItemKeyInfo,
} from '../../../plugins/statusManager/type';
import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../renderer/config';
import { TransactionType } from '../../index';


export default class CatmullAltitudeLaneEditCatmullSerieRoadCompTransaction extends CompositionTransaction {
  private scope: ExtendedNamespace;
  private laneId: string;
  private laneSide: LaneSide;
  private laneLineSide: LaneLineSide;
  private newLaneLineAltitudeCatmullPoints: Vector3[];
  private newLaneLineAltitudeCatmullTangents: Vector3[];
  private isStartCatmull: boolean;
  private isEndCatmull: boolean;
  private roadId: string;
  private roadCategory: RoadCategory;

  private compRoadLanes = [] as Array<{
    laneId: string;
    laneSide: LaneSide;
    laneLineSide: LaneLineSide;
    roadId: string;
    roadCategory: RoadCategory;
    isStart: boolean;
  }>;

  private compJunctions: Array<{
    junctionId: string;
    edges: Array<{
      edgeId: string;
      isStart: boolean;
      relatedRoadId: string;
      relatedRoadCategory: RoadCategory;
      isRelatedRoadStart: boolean;
      isRelatedRoadLeftMost: boolean;
    }>;
  }>;
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.laneId = (options as unknown as { laneId: string }).laneId;
    this.laneSide = (options as unknown as { laneSide: LaneSide }).laneSide;
    this.laneLineSide = (options as unknown as { laneLineSide: LaneLineSide }).laneLineSide;
    this.newLaneLineAltitudeCatmullPoints = (options as unknown as { newLaneLineAltitudeCatmullPoints: Vector3[] }).newLaneLineAltitudeCatmullPoints;
    this.newLaneLineAltitudeCatmullTangents = (options as unknown as { newLaneLineAltitudeCatmullTangents: Vector3[] }).newLaneLineAltitudeCatmullTangents;
    this.isStartCatmull = (options as unknown as { isStartCatmull: boolean }).isStartCatmull;
    this.isEndCatmull = (options as unknown as { isEndCatmull: boolean }).isEndCatmull;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;

    this.compRoadLanes = (options as unknown as { compRoadLanes: Array<{
      laneId: string;
      laneSide: LaneSide;
      laneLineSide: LaneLineSide;
      roadId: string;
      roadCategory: RoadCategory;
      isStart: boolean;
    }> }).compRoadLanes;

    this.compJunctions = (options as unknown as { compJunctions: Array<{
      junctionId: string;
      edges: Array<{
        edgeId: string;
        isStart: boolean;
        relatedRoadId: string;
        relatedRoadCategory: RoadCategory;
        isRelatedRoadStart: boolean;
        isRelatedRoadLeftMost: boolean;
      }>;
    }> }).compJunctions;

    this.fillSubTransactions();
  }

  commit() {
    super.commit();
    
    return { roadId: this.roadId };
  }

  onUndo() {
    super.onUndo();
  }

  onRedo() {
    super.onRedo();
  }

  fillSubTransactions() {
    // original road lane
    this.subTransactions.push(this.scope.createTransaction(TransactionType.CatmullAltitudeLaneEditCatmullSerieRoad, {
      scope: this.scope,
      laneId: this.laneId,
      laneSide: this.laneSide,
      laneLineSide: this.laneLineSide,
      newLaneLineAltitudeCatmullPoints: this.newLaneLineAltitudeCatmullPoints,
      newLaneLineAltitudeCatmullTangents: this.newLaneLineAltitudeCatmullTangents,
      isStartCatmull: this.isStartCatmull,
      isEndCatmull: this.isEndCatmull,
      roadId: this.roadId,
      roadCategory: this.roadCategory,
    }));

    // composition road lanes
    this.compRoadLanes.forEach((l: {
      laneId: string;
      laneSide: LaneSide;
      laneLineSide: LaneLineSide;
      roadId: string;
      roadCategory: RoadCategory;
      isStart: boolean;
    }) => {
      const laneItem = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(l.laneId, l.roadId, l.roadCategory) as LaneItem;

      const altitudeCatmullPoints = l.laneLineSide === LaneLineSide.Inner ? [...laneItem.laneLines.innerLaneLine.altitudeCatmullPoints] : [...laneItem.laneLines.outerLaneLine.altitudeCatmullPoints];
      const altitudeCatmullTangents = l.laneLineSide === LaneLineSide.Inner ? [...laneItem.laneLines.innerLaneLine.altitudeCatmullTangents] : [...laneItem.laneLines.outerLaneLine.altitudeCatmullTangents];

      const compAltitude = this.isStartCatmull ? this.newLaneLineAltitudeCatmullPoints[0].z : this.newLaneLineAltitudeCatmullPoints[this.newLaneLineAltitudeCatmullPoints.length - 1].z;

      if (l.isStart) {
        const _old = altitudeCatmullPoints[0];
        altitudeCatmullPoints[0] = new Vector3(_old.x, _old.y, compAltitude);
      } else {
        const _old = altitudeCatmullPoints[altitudeCatmullPoints.length - 1];
        altitudeCatmullPoints[altitudeCatmullPoints.length - 1] = new Vector3(_old.x, _old.y, compAltitude);;
      }

      if (l.roadCategory === RoadCategory.CatmullSerieRoad) {
        this.subTransactions.push(this.scope.createTransaction(TransactionType.CatmullAltitudeLaneEditCatmullSerieRoad, {
          scope: this.scope,
          laneId: l.laneId,
          laneSide: l.laneSide,
          laneLineSide: l.laneLineSide,
          newLaneLineAltitudeCatmullPoints: altitudeCatmullPoints,
          newLaneLineAltitudeCatmullTangents: altitudeCatmullTangents,
          isStartCatmull: l.isStart,
          isEndCatmull: !l.isStart,
          roadId: l.roadId,
          roadCategory: l.roadCategory,
        }));
      } else if (l.roadCategory === RoadCategory.ConnectionRoad) {
        this.subTransactions.push(this.scope.createTransaction(TransactionType.CatmullAltitudeLaneEditConnectionRoad, {
          scope: this.scope,
          laneId: l.laneId,
          laneSide: l.laneSide,
          laneLineSide: l.laneLineSide,
          newLaneLineAltitudeCatmullPoints: altitudeCatmullPoints,
          newLaneLineAltitudeCatmullTangents: altitudeCatmullTangents,
          isStartCatmull: l.isStart,
          isEndCatmull: !l.isStart,
          roadId: l.roadId,
          roadCategory: l.roadCategory,
        }));
      }
    });

    // composition junctions
    this.compJunctions.forEach((j: {
      junctionId: string;
      edges: Array<{
        edgeId: string;
        isStart: boolean;
        relatedRoadId: string;
        relatedRoadCategory: RoadCategory;
        isRelatedRoadStart: boolean;
        isRelatedRoadLeftMost: boolean;
      }>;
    }) => {
      this.subTransactions.push(this.scope.createTransaction(TransactionType.CatmullAltitudeEditJunctionEdge, {
        scope: this.scope,
        junctionId: j.junctionId,
        edges: j.edges,
      }));
    });
  }
};