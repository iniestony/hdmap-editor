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
  LaneItemKeyInfo,
} from '../../plugins/statusManager/type';
import {
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  InvokeCatmullAlterLaneCatmullSerieRoadEvent,
} from '../event';

export default class CatmullAlterLaneCatmullSerieRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private laneId: string;
  private laneSide: LaneSide;
  private laneLineSide: LaneLineSide;
  private newLaneLineCatmullPoints: Vector3[];
  private newLaneLineCatmullTangents: Vector3[];
  private roadId: string;
  private roadCategory: RoadCategory;

  private oldLaneLineCatmullPoints?: Vector3[];
  private oldLaneLineCatmullTangents?: Vector3[];
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
   
    this.laneId = (options as unknown as { laneId: string }).laneId;
    this.laneSide = (options as unknown as { laneSide: LaneSide }).laneSide;
    this.laneLineSide = (options as unknown as { laneLineSide: LaneLineSide }).laneLineSide;
    this.newLaneLineCatmullPoints = (options as unknown as { newLaneLineCatmullPoints: Vector3[] }).newLaneLineCatmullPoints;
    this.newLaneLineCatmullTangents = (options as unknown as { newLaneLineCatmullTangents: Vector3[] }).newLaneLineCatmullTangents;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
  }

  commit() {
    super.commit();

    this.resolveNecessaryInfo();
    this.editNewRoadLaneCatmull();

    return { laneId: this.laneId };
  }

  onUndo() {
    super.onUndo();

    this.editOldRoadLaneCatmull();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.editNewRoadLaneCatmull();
  }

  resolveNecessaryInfo() {
    const laneItem = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(this.laneId, this.roadId, this.roadCategory) as LaneItem;

    if (this.laneLineSide === LaneLineSide.Inner) {
      this.oldLaneLineCatmullPoints = [...laneItem.laneLines.innerLaneLine.catmullPoints];
      this.oldLaneLineCatmullTangents = [...laneItem.laneLines.innerLaneLine.catmullTangents];
    } else {
      this.oldLaneLineCatmullPoints = [...laneItem.laneLines.outerLaneLine.catmullPoints];
      this.oldLaneLineCatmullTangents = [...laneItem.laneLines.outerLaneLine.catmullTangents];
    }
  }

  editNewRoadLaneCatmull() {
    const roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;
    const laneItem = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(this.laneId, this.roadId, this.roadCategory) as LaneItem;

    if (this.laneLineSide === LaneLineSide.Inner) {
      laneItem.laneLines.innerLaneLine.catmullPoints = [...this.newLaneLineCatmullPoints];
      laneItem.laneLines.innerLaneLine.catmullTangents = [...this.newLaneLineCatmullTangents];
    } else {
      laneItem.laneLines.outerLaneLine.catmullPoints = [...this.newLaneLineCatmullPoints];
      laneItem.laneLines.outerLaneLine.catmullTangents = [...this.newLaneLineCatmullTangents];
    }

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeCatmullAlterLaneCatmullSerieRoadEvent, {
      laneId: this.laneId,
    });
  }

  editOldRoadLaneCatmull() {
    const roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;
    const laneItem = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(this.laneId, this.roadId, this.roadCategory) as LaneItem;

    const oldLaneLineCatmullPoints = this.oldLaneLineCatmullPoints as Vector3[];
    const oldLaneLineCatmullTangents = this.oldLaneLineCatmullTangents as Vector3[];

    if (this.laneLineSide === LaneLineSide.Inner) {
      laneItem.laneLines.innerLaneLine.catmullPoints = [...oldLaneLineCatmullPoints];
      laneItem.laneLines.innerLaneLine.catmullTangents = [...oldLaneLineCatmullTangents];
    } else {
      laneItem.laneLines.outerLaneLine.catmullPoints = [...oldLaneLineCatmullPoints];
      laneItem.laneLines.outerLaneLine.catmullTangents = [...oldLaneLineCatmullTangents];
    }

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeCatmullAlterLaneCatmullSerieRoadEvent, {
      laneId: this.laneId,
    });
  }
};