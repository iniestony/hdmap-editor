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
  LaneItemKeyInfo,
} from '../../plugins/statusManager/type';
import {
  UpdateOneSideLanesRoadEvent,
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  InvokeRoadTransparencyEditEvent,
} from '../event';

export default class RoadTransparencyEditTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private roadId: string;
  private roadCategory: RoadCategory;
  private matAlpha: number;

  private roadItem?: RoadItem;
  private oldMatAlpha?: number;
  private oldLeftLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private newLeftLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private oldRightLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private newRightLaneItemsKeyInfo?: LaneItemKeyInfo[];

  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
    this.matAlpha = (options as unknown as { matAlpha: number }).matAlpha;
  }

  commit() {
    super.commit();

    this.resolveNecessaryInfo();
    this.reformatNewRoad();
    return { roadId: this.roadId };
  }

  onUndo() {
    super.onUndo();

    this.reformatOldRoad();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.reformatNewRoad();
  }

  resolveNecessaryInfo() {
    this.roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;

    this.oldMatAlpha = this.roadItem.matAlpha as number;

    this.oldLeftLaneItemsKeyInfo = this.roadItem.laneItems.leftLanes.map((l: LaneItem) => {
      return this.scope.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
    });

    this.oldRightLaneItemsKeyInfo = this.roadItem.laneItems.rightLanes.map((l: LaneItem) => {
      return this.scope.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
    });

    this.newLeftLaneItemsKeyInfo = this.generateNewKeyInfoFromOldKeyInfo(this.oldLeftLaneItemsKeyInfo) as LaneItemKeyInfo[];
    this.newRightLaneItemsKeyInfo = this.generateNewKeyInfoFromOldKeyInfo(this.oldRightLaneItemsKeyInfo) as LaneItemKeyInfo[];
  }

  generateNewKeyInfoFromOldKeyInfo(oldLaneItemsKeyInfo: LaneItemKeyInfo[]) {
    const newLaneItemsKeyInfo = oldLaneItemsKeyInfo.map((oldLaneItemKeyInfo: LaneItemKeyInfo, laneIdx: number) => {
      const innerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;
      const outerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;
      const innerLaneLineCatmullPoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints;
      const outerLaneLineCatmullPoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints;

      return {
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
            seriePoints: innerLaneLineSeriePoints,
            category: oldLaneItemKeyInfo.laneLines.innerLaneLine.category,
            options: { ...oldLaneItemKeyInfo.laneLines.innerLaneLine.options },
            laneLineSide: oldLaneItemKeyInfo.laneLines.innerLaneLine.laneLineSide,
            catmullPoints: innerLaneLineCatmullPoints,
            atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
          },
          outerLaneLine: {
            seriePoints: outerLaneLineSeriePoints,
            category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
            options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
            laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
            catmullPoints: outerLaneLineCatmullPoints,
            atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryType,
          },
        },
        laneConnectors: {
          laneConnectorStart: {
            seriePoints: [innerLaneLineSeriePoints[0], outerLaneLineSeriePoints[0]],
            category: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.category,
            options: { ...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.options },
            laneLineSide: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.laneLineSide,
            catmullPoints: [innerLaneLineSeriePoints[0], outerLaneLineSeriePoints[0]],
            atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryType,
          },
          laneConnectorEnd: {
            seriePoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
            category: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.category,
            options: { ...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.options },
            laneLineSide: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.laneLineSide,
            catmullPoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
            atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.atlasLaneBoundaryType,
          },
        },
      } as LaneItemKeyInfo;
    });

    return newLaneItemsKeyInfo;
  }

  reformatNewRoad() {
    const roadItem = this.roadItem as RoadItem;
    const reflineKeyPoints = [...roadItem.referenceLine.points] as Vector3[];

    const leftLaneItemsKeyInfo = this.newLeftLaneItemsKeyInfo as LaneItemKeyInfo[];
    const rightLaneItemsKeyInfo = this.newRightLaneItemsKeyInfo as LaneItemKeyInfo[];

    roadItem.matAlpha = this.matAlpha;

    this.scope.emitEvent(UpdateOneSideLanesRoadEvent, {
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
      laneSide: LaneSide.Left,
      laneItemsKeyInfo: leftLaneItemsKeyInfo,
      reflineKeyPoints: reflineKeyPoints,
    });

    this.scope.emitEvent(UpdateOneSideLanesRoadEvent, {
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
      laneSide: LaneSide.Right,
      laneItemsKeyInfo: rightLaneItemsKeyInfo,
      reflineKeyPoints: reflineKeyPoints,
    });

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadTransparencyEditEvent, {
      roadId: this.roadId,
    });
  }

  reformatOldRoad() {
    const roadItem = this.roadItem as RoadItem;
    const reflineKeyPoints = [...roadItem.referenceLine.points] as Vector3[];

    const leftLaneItemsKeyInfo = this.oldLeftLaneItemsKeyInfo as LaneItemKeyInfo[];
    const rightLaneItemsKeyInfo = this.oldRightLaneItemsKeyInfo as LaneItemKeyInfo[];

    roadItem.matAlpha = this.oldMatAlpha as number;

    this.scope.emitEvent(UpdateOneSideLanesRoadEvent, {
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
      laneSide: LaneSide.Left,
      laneItemsKeyInfo: leftLaneItemsKeyInfo,
      reflineKeyPoints: reflineKeyPoints,
    });

    this.scope.emitEvent(UpdateOneSideLanesRoadEvent, {
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
      laneSide: LaneSide.Right,
      laneItemsKeyInfo: rightLaneItemsKeyInfo,
      reflineKeyPoints: reflineKeyPoints,
    });

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadTransparencyEditEvent, {
      roadId: this.roadId,
    });
  }
};