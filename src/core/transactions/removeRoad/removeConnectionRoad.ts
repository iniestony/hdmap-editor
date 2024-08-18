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
  RoadItemKeyInfo,
  JunctionItem,
} from '../../plugins/statusManager/type';
import {
  StoreRoadEvent,
  RemoveRoadEvent,
  ReformatRoadEvent,
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import { LineType } from '../../plugins/lineDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  AtlasRoad,
  AtlasLane,
} from '../../plugins/atlasConverter/type';
import {
  InvokeCreateConnectionRoadEvent,
  InvokeRemoveConnectionRoadEvent,
  InvokeReformatConnectionRoadEvent,
} from '../event';
import {
  JunctionVertexCategory,
} from "../../plugins/junctionDrawer/type";

export default class RemoveConnectionRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private roadId: string;
  private roadCategory: RoadCategory;

  private roadItem?: RoadItem;
  private oldReflinePoints?: Vector3[];
  private oldRoadItemKeyInfo?: RoadItemKeyInfo;
  private involvedInfoInJunction?: {
    roadId: string;
    roadCategory: RoadCategory;
    prevJunctionVertexCategory: JunctionVertexCategory;
    nextJunctionVertexCategory: JunctionVertexCategory;
  };
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
  }

  commit() {
    super.commit();

    this.resolveNecessaryInfo();
    this.removeRoad();

    return { roadId: this.roadId };
  }

  onUndo() {
    super.onUndo();

    this.addRoad();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.removeRoad();
  }

  resolveNecessaryInfo() {
    this.roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;
    
    this.oldReflinePoints = [...this.roadItem.referenceLine.points] as Vector3[];
    this.oldRoadItemKeyInfo = this.scope.resolveRoadItemKeyInfo(this.roadItem) as RoadItemKeyInfo;

    if (this.roadItem.junctionId) {
      const junctionItem = this.scope.resolveJunctionByJunctionId(this.roadItem.junctionId) as JunctionItem;
      const junctionInvolvedRoads = junctionItem.involvedRoads;

      this.involvedInfoInJunction = junctionInvolvedRoads.find((iRoad: {
        roadId: string;
        roadCategory: RoadCategory;
        prevJunctionVertexCategory: JunctionVertexCategory;
        nextJunctionVertexCategory: JunctionVertexCategory;
      }) => {
        return iRoad.roadId === this.roadItem?.roadId && iRoad.roadCategory === this.roadItem?.category;
      });
    }
  }

  removeRoad() {
    const roadItem = this.roadItem as RoadItem;
    
    this.scope.detachRoadInPrevAndNext(roadItem);
    roadItem.laneItems.leftLanes.forEach((l: LaneItem) => {
      this.scope.detachLaneInPrevAndNext(l, roadItem);
    });
    roadItem.laneItems.rightLanes.forEach((l: LaneItem) => {
      this.scope.detachLaneInPrevAndNext(l, roadItem);
    });

    this.scope.detachConnectionRoadFromJunction(roadItem, this.involvedInfoInJunction);

    this.scope.emitEvent(RemoveRoadEvent, {
      id: roadItem.roadId,
      category: roadItem.category,
    });

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRemoveConnectionRoadEvent, {
      roadId: this.roadId,
    });
  }

  addRoad() {
    const oldRoadItem = this.roadItem as RoadItem;

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
      roadId: this.roadId,
    });

    // reformat then
    const roadItemKeyInfo = this.oldRoadItemKeyInfo as RoadItemKeyInfo;
    const reflineKeyPoints = [...(this.oldReflinePoints as Vector3[])];

    this.scope.emitEvent(ReformatRoadEvent, {
      roadId: roadItemKeyInfo.roadId,
      roadCategory: roadItemKeyInfo.category,
      roadItemKeyInfo: roadItemKeyInfo,
      reflineKeyPoints: reflineKeyPoints,
    });

    this.scope.attachRoadInPrevAndNext(newRoadItem);
    newRoadItem.laneItems.leftLanes.forEach((l: LaneItem) => {
      this.scope.attachLaneInPrevAndNext(l, newRoadItem);
    });
    newRoadItem.laneItems.rightLanes.forEach((l: LaneItem) => {
      this.scope.attachLaneInPrevAndNext(l, newRoadItem);
    });

    this.scope.attachConnectionRoadFromJunction(newRoadItem, this.involvedInfoInJunction);

    this.scope.emitEvent(InvokeReformatConnectionRoadEvent, {
      reflinePoints: reflineKeyPoints,
    });
  }
};