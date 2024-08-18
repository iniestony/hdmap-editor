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
  AtlasRoad,
  AtlasLane,
} from '../../plugins/atlasConverter/type';
import {
  UpdateOneSideLanesRoadEvent,
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import { LineType } from '../../plugins/lineDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  InvokeAddLaneConnectionRoadEvent,
  InvokeRemoveLaneConnectionRoadEvent,
} from '../event';


export default class RemoveLaneConnectionRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private roadId: string;
  private roadCategory: RoadCategory;
  private laneSide: LaneSide;
  private laneId: string;

  private roadItem?: RoadItem;
  private targetLaneIndex?: number;
  private oldLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private newLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private removedLaneItem?: LaneItem;

  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
    this.laneSide = (options as unknown as { laneSide: LaneSide }).laneSide;
    this.laneId = (options as unknown as { laneId: string }).laneId;
  }

  commit() {
    super.commit();

    this.preValidateRoad(this.roadId, this.roadCategory);

    this.resolveNecessaryInfo();
    this.removeLane();

    this.postValidateRoad(this.roadId, this.roadCategory);

    this.dispatchInvalidRoadEvent(this.roadId, this.roadCategory);

    return { roadId: this.roadId };
  }

  onUndo() {
    super.onUndo();

    this.addLane();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.removeLane();

    this.dispatchInvalidRoadEvent(this.roadId, this.roadCategory);
  }

  resolveNecessaryInfo() {
    this.roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;

    if (this.laneSide === LaneSide.Left) {
      this.oldLaneItemsKeyInfo = this.roadItem.laneItems.leftLanes.map((l: LaneItem) => {
        return this.scope.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
      });
    } else {
      this.oldLaneItemsKeyInfo = this.roadItem.laneItems.rightLanes.map((l: LaneItem) => {
        return this.scope.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
      });
    }

    this.targetLaneIndex = (this.oldLaneItemsKeyInfo as LaneItemKeyInfo[]).findIndex((laneItemKeyInfo: LaneItemKeyInfo) => {
      return laneItemKeyInfo.laneId === this.laneId;
    });

    this.newLaneItemsKeyInfo = this.generateNewKeyInfoFromOldKeyInfo(this.oldLaneItemsKeyInfo) as LaneItemKeyInfo[];

    const removedLaneId = (this.oldLaneItemsKeyInfo as LaneItemKeyInfo[])[this.targetLaneIndex as number].laneId;
    this.removedLaneItem = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(removedLaneId, (this.roadItem as RoadItem).roadId, (this.roadItem as RoadItem).category) as LaneItem;
  }

  generateNewKeyInfoFromOldKeyInfo(oldLaneItemsKeyInfo: LaneItemKeyInfo[]) {
    const targetLaneIndex = this.targetLaneIndex as number;

    const newLaneItemsKeyInfo = [] as LaneItemKeyInfo[];

    // generate new lanes
    oldLaneItemsKeyInfo.forEach((oldLaneItemKeyInfo: LaneItemKeyInfo, idx: number) => {
      if (idx !== targetLaneIndex) {
        // push lane itself
        newLaneItemsKeyInfo.push({
          laneSide: oldLaneItemKeyInfo.laneSide,
          laneWidthEditable: oldLaneItemKeyInfo.laneWidthEditable,
          laneId: oldLaneItemKeyInfo.laneId,
          atlasLaneSpeedLimit: oldLaneItemKeyInfo.atlasLaneSpeedLimit,
          atlasLaneType: oldLaneItemKeyInfo.atlasLaneType,
          atlasLaneTurn: oldLaneItemKeyInfo.atlasLaneTurn,
          atlasLaneDirection: oldLaneItemKeyInfo.atlasLaneDirection,
          prevLanes: [...oldLaneItemKeyInfo.prevLanes],
          nextLanes: [...oldLaneItemKeyInfo.nextLanes],
          laneLines: {
            innerLaneLine: {
              seriePoints: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints],
              category: oldLaneItemKeyInfo.laneLines.innerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.innerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.innerLaneLine.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints],
              catmullTangents: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents],
              altitudeCatmullPoints: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullPoints],
              altitudeCatmullTangents: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullTangents],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints],
              category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints],
              catmullTangents: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents],
              altitudeCatmullPoints: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullPoints],
              altitudeCatmullTangents: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullTangents],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryType,
            },
          },
          laneConnectors: {
            laneConnectorStart: {
              seriePoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.seriePoints],
              category: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.category,
              options: { ...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.options },
              laneLineSide: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.catmullPoints],
              catmullTangents: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.catmullTangents],
              altitudeCatmullPoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.altitudeCatmullPoints],
              altitudeCatmullTangents: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.altitudeCatmullTangents],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryType,
            },
            laneConnectorEnd: {
              seriePoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.seriePoints],
              category: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.category,
              options: { ...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.options },
              laneLineSide: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.catmullPoints],
              catmullTangents: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.catmullTangents],
              altitudeCatmullPoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.altitudeCatmullPoints],
              altitudeCatmullTangents: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.altitudeCatmullTangents],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.atlasLaneBoundaryType,
            },
          },
        } as LaneItemKeyInfo);
      }
    });

    return newLaneItemsKeyInfo;
  }

  removeLane() {
    const laneItemsKeyInfo = this.newLaneItemsKeyInfo as LaneItemKeyInfo[];
    const roadItem = this.roadItem as RoadItem;
    const reflineKeyPoints = [...roadItem.referenceLine.points] as Vector3[];

    const removedLaneItem = this.removedLaneItem as LaneItem;
    this.scope.detachLaneInPrevAndNext(removedLaneItem, roadItem);

    this.scope.emitEvent(UpdateOneSideLanesRoadEvent, {
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
      laneSide: this.laneSide,
      laneItemsKeyInfo: laneItemsKeyInfo,
      reflineKeyPoints: reflineKeyPoints,
    });

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRemoveLaneConnectionRoadEvent, {
      laneId: this.laneId,
    });
  }

  addLane() {
    const laneItemsKeyInfo = this.oldLaneItemsKeyInfo as LaneItemKeyInfo[];
    const roadItem = this.roadItem as RoadItem;
    const reflineKeyPoints = [...roadItem.referenceLine.points] as Vector3[];
    
    this.scope.emitEvent(UpdateOneSideLanesRoadEvent, {
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
      laneSide: this.laneSide,
      laneItemsKeyInfo: laneItemsKeyInfo,
      reflineKeyPoints: reflineKeyPoints,
    });

    const removedLaneItem = this.removedLaneItem as LaneItem;
    this.scope.attachLaneInPrevAndNext(removedLaneItem, roadItem);

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeAddLaneConnectionRoadEvent, {
      laneId: this.laneId,
    });
  }
};