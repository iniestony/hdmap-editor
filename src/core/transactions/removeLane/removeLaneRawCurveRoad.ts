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


export default class RemoveLaneRawCurveRoadTransaction extends StandardTransaction {
  protected scope: ExtendedNamespace;
  protected roadId: string;
  protected roadCategory: RoadCategory;
  protected laneSide: LaneSide;
  protected laneId: string;

  private roadItem?: RoadItem;
  private targetLaneIndex?: number;
  private oldLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private newLaneItemsKeyInfo?: LaneItemKeyInfo[];

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

    this.resolveNecessaryInfo();
    this.removeLane();
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
  }

  generateNewKeyInfoFromOldKeyInfo(oldLaneItemsKeyInfo: LaneItemKeyInfo[]) {
    const targetLaneIndex = this.targetLaneIndex as number;
    const roadItem = this.roadItem as RoadItem;
    const reflineSeriePoints = roadItem.referenceLine.seriePoints;
    const reflineSerieNormals = roadItem.referenceLine.serieNormals;

    const removedLane = oldLaneItemsKeyInfo[targetLaneIndex];
    const removedLaneInnerSeriePoints = removedLane.laneLines.innerLaneLine.seriePoints;
    const removedLaneOuterSeriePoints = removedLane.laneLines.outerLaneLine.seriePoints;

    const newLaneItemsKeyInfo = [] as LaneItemKeyInfo[];

    // generate new lanes
    oldLaneItemsKeyInfo.forEach((oldLaneItemKeyInfo: LaneItemKeyInfo, idx: number) => {
      if (idx < targetLaneIndex) {
        // push lane itself
        const innerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;
        const outerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;

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
              seriePoints: innerLaneLineSeriePoints,
              category: oldLaneItemKeyInfo.laneLines.innerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.innerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.innerLaneLine.laneLineSide,
              catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(innerLaneLineSeriePoints),
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: outerLaneLineSeriePoints,
              category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
              catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(outerLaneLineSeriePoints),
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
        } as LaneItemKeyInfo);
      } else if (idx > targetLaneIndex) {
        let innerLaneLineSeriePoints = [] as Vector3[];
        let outerLaneLineSeriePoints = [] as Vector3[];

        if (this.laneSide === LaneSide.Left) {
          innerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, s_idx: number) => {
            const removedInnerLaneLinePoint = [...removedLaneInnerSeriePoints].reverse()[s_idx];
            const removedOuterLaneLinePoint = [...removedLaneOuterSeriePoints].reverse()[s_idx];
            const removedDistance = removedInnerLaneLinePoint.subtract(removedOuterLaneLinePoint).length();

            const oldInnerLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints].reverse()[s_idx];
            const distance = v.subtract(oldInnerLaneLinePoint).length() - removedDistance;

            return v.add(reflineSerieNormals[s_idx].multiplyByFloats(-distance, -distance, -distance));
          }).reverse();

          outerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, s_idx: number) => {
            const removedInnerLaneLinePoint = [...removedLaneInnerSeriePoints].reverse()[s_idx];
            const removedOuterLaneLinePoint = [...removedLaneOuterSeriePoints].reverse()[s_idx];
            const removedDistance = removedInnerLaneLinePoint.subtract(removedOuterLaneLinePoint).length();

            const oldOuterLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints].reverse()[s_idx];
            const distance = v.subtract(oldOuterLaneLinePoint).length() - removedDistance;

            return v.add(reflineSerieNormals[s_idx].multiplyByFloats(-distance, -distance, -distance));
          }).reverse();
        } else {
          innerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, s_idx: number) => {
            const removedInnerLaneLinePoint = [...removedLaneInnerSeriePoints][s_idx];
            const removedOuterLaneLinePoint = [...removedLaneOuterSeriePoints][s_idx];
            const removedDistance = removedInnerLaneLinePoint.subtract(removedOuterLaneLinePoint).length();

            const oldInnerLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints][s_idx];
            const distance = v.subtract(oldInnerLaneLinePoint).length() - removedDistance;

            return v.add(reflineSerieNormals[s_idx].multiplyByFloats(distance, distance, distance));
          });

          outerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, s_idx: number) => {
            const removedInnerLaneLinePoint = [...removedLaneInnerSeriePoints][s_idx];
            const removedOuterLaneLinePoint = [...removedLaneOuterSeriePoints][s_idx];
            const removedDistance = removedInnerLaneLinePoint.subtract(removedOuterLaneLinePoint).length();

            const oldOuterLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints][s_idx];
            const distance = v.subtract(oldOuterLaneLinePoint).length() - removedDistance;

            return v.add(reflineSerieNormals[s_idx].multiplyByFloats(distance, distance, distance));
          });
        }

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
              seriePoints: innerLaneLineSeriePoints,
              category: oldLaneItemKeyInfo.laneLines.innerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.innerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.innerLaneLine.laneLineSide,
              catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(innerLaneLineSeriePoints),
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: outerLaneLineSeriePoints,
              category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
              catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(outerLaneLineSeriePoints),
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
        } as LaneItemKeyInfo);
      }
    });

    return newLaneItemsKeyInfo;
  }

  removeLane() {
    const laneItemsKeyInfo = this.newLaneItemsKeyInfo as LaneItemKeyInfo[];
    const roadItem = this.roadItem as RoadItem;
    const reflineKeyPoints = [...roadItem.referenceLine.points] as Vector3[];

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

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });
  }
};