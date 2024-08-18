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


export default class CatmullAltitudeReformatConnectionRoadCompTransaction extends CompositionTransaction {
  private scope: ExtendedNamespace;
  private newRefLineAltitudeCatmullPoints: Vector3[];
  private newRefLineAltitudeCatmullTangents: Vector3[];
  private isStartCatmull: boolean;
  private isEndCatmull: boolean;
  private roadId: string;
  private roadCategory: RoadCategory;
  private compRoads: Array<{
    roadId: string;
    roadCategory: RoadCategory;
    isStart: boolean;
  }>;
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.newRefLineAltitudeCatmullPoints = (options as unknown as { newRefLineAltitudeCatmullPoints: Vector3[] }).newRefLineAltitudeCatmullPoints;
    this.newRefLineAltitudeCatmullTangents = (options as unknown as { newRefLineAltitudeCatmullTangents: Vector3[] }).newRefLineAltitudeCatmullTangents;
    this.isStartCatmull = (options as unknown as { isStartCatmull: boolean }).isStartCatmull;
    this.isEndCatmull = (options as unknown as { isEndCatmull: boolean }).isEndCatmull;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
    this.compRoads = (options as unknown as { compRoads: Array<{
      roadId: string;
      roadCategory: RoadCategory;
      isStart: boolean;
    }> }).compRoads;

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
    // original road
    this.subTransactions.push(this.scope.createTransaction(TransactionType.CatmullAltitudeReformatConnectionRoad, {
      scope: this.scope,
      newRefLineAltitudeCatmullPoints: this.newRefLineAltitudeCatmullPoints,
      newRefLineAltitudeCatmullTangents: this.newRefLineAltitudeCatmullTangents,
      isStartCatmull: this.isStartCatmull,
      isEndCatmull: this.isEndCatmull,
      roadId: this.roadId,
      roadCategory: this.roadCategory,
    }));

    // composition roads
    this.compRoads.forEach((r: {
      roadId: string;
      roadCategory: RoadCategory;
      isStart: boolean;
    }) => {
      const roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(r.roadId, r.roadCategory) as RoadItem;
      const altitudeCatmullPoints = [...roadItem.referenceLine.altitudeCatmullPoints];
      const altitudeCatmullTangents = [...roadItem.referenceLine.altitudeCatmullTangents];

      const compAltitude = this.isStartCatmull ? this.newRefLineAltitudeCatmullPoints[0].z : this.newRefLineAltitudeCatmullPoints[this.newRefLineAltitudeCatmullPoints.length - 1].z;

      if (r.isStart) {
        const _old = altitudeCatmullPoints[0];
        altitudeCatmullPoints[0] = new Vector3(_old.x, _old.y, compAltitude);
      } else {
        const _old = altitudeCatmullPoints[altitudeCatmullPoints.length - 1];
        altitudeCatmullPoints[altitudeCatmullPoints.length - 1] = new Vector3(_old.x, _old.y, compAltitude);;
      }

      if (r.roadCategory === RoadCategory.CatmullSerieRoad) {
        this.subTransactions.push(this.scope.createTransaction(TransactionType.CatmullAltitudeReformatCatmullSerieRoad, {
          scope: this.scope,
          newRefLineAltitudeCatmullPoints: altitudeCatmullPoints,
          newRefLineAltitudeCatmullTangents: altitudeCatmullTangents,
          isStartCatmull: r.isStart,
          isEndCatmull: !r.isStart,
          roadId: r.roadId,
          roadCategory: r.roadCategory,
        }));
      } else if (r.roadCategory === RoadCategory.ConnectionRoad) {
        this.subTransactions.push(this.scope.createTransaction(TransactionType.CatmullAltitudeReformatConnectionRoad, {
          scope: this.scope,
          newRefLineAltitudeCatmullPoints: altitudeCatmullPoints,
          newRefLineAltitudeCatmullTangents: altitudeCatmullTangents,
          isStartCatmull: r.isStart,
          isEndCatmull: !r.isStart,
          roadId: r.roadId,
          roadCategory: r.roadCategory,
        }));
      }
    });
  }
};