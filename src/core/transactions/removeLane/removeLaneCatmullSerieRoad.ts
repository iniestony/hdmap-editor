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
  InvokeAddLaneCatmullSerieRoadEvent,
  InvokeRemoveLaneCatmullSerieRoadEvent,
} from '../event';


export default class RemoveLaneCatmullSerieRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private roadId: string;
  private roadCategory: RoadCategory;
  private laneSide: LaneSide;
  private laneId: string;

  private roadItem?: RoadItem;
  private targetLaneIndex?: number;
  private targetLaneMinWidth?: number;
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

    const targetLaneInnerLaneLineSeriePoints = (this.oldLaneItemsKeyInfo as LaneItemKeyInfo[])[this.targetLaneIndex].laneLines.innerLaneLine.seriePoints;
    const targetLaneOuterLaneLineSeriePoints = (this.oldLaneItemsKeyInfo as LaneItemKeyInfo[])[this.targetLaneIndex].laneLines.outerLaneLine.seriePoints;

    const targetLanePairWidth = targetLaneInnerLaneLineSeriePoints.map((v: Vector3, idx: number) => {
      return v.subtract(targetLaneOuterLaneLineSeriePoints[idx]).length();
    });

    this.targetLaneMinWidth = Math.min(...targetLanePairWidth);

    this.newLaneItemsKeyInfo = this.generateNewKeyInfoFromOldKeyInfo(this.oldLaneItemsKeyInfo) as LaneItemKeyInfo[];

    const removedLaneId = (this.oldLaneItemsKeyInfo as LaneItemKeyInfo[])[this.targetLaneIndex as number].laneId;
    this.removedLaneItem = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(removedLaneId, (this.roadItem as RoadItem).roadId, (this.roadItem as RoadItem).category) as LaneItem;
  }

  generateNewKeyInfoFromOldKeyInfo(oldLaneItemsKeyInfo: LaneItemKeyInfo[]) {
    const targetLaneIndex = this.targetLaneIndex as number;
    const targetLaneMinWidth = this.targetLaneMinWidth as number;
    const roadItem = this.roadItem as RoadItem;
    const refLineSeriePoints = roadItem.referenceLine.seriePoints;
    const refLineSerieNormals = roadItem.referenceLine.serieNormals;
    const refLineCatmullPoints = roadItem.referenceLine.catmullPoints;
    const refLineCatmullTangents = roadItem.referenceLine.catmullTangents;
    const refLineAltitudeCatmullPoints = roadItem.referenceLine.altitudeCatmullPoints;
    const refLineAltitudeCatmullTangents = roadItem.referenceLine.altitudeCatmullTangents;

    const removedLane = oldLaneItemsKeyInfo[targetLaneIndex];
    const removedLaneInnerCatmullPoints = removedLane.laneLines.innerLaneLine.catmullPoints;
    const removedLaneInnerCatmullTangents = removedLane.laneLines.innerLaneLine.catmullTangents;
    const removedLaneInnerAltitudeCatmullPoints = removedLane.laneLines.innerLaneLine.altitudeCatmullPoints;
    const removedLaneInnerAltitudeCatmullTangents = removedLane.laneLines.innerLaneLine.altitudeCatmullTangents;

    const newLaneItemsKeyInfo = [] as LaneItemKeyInfo[];

    // generate new lanes
    oldLaneItemsKeyInfo.forEach((oldLaneItemKeyInfo: LaneItemKeyInfo, idx: number) => {
      if (idx < targetLaneIndex) {
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
      } else if (idx === targetLaneIndex + 1) {
        let innerLaneLineCatmullPoints_raw: Vector3[] = [];
        let innerLaneLineCatmullTangents_raw: Vector3[] = [];
        let innerLaneLineSeriePoints_raw: Vector3[] = [];
        let innerLaneLineAltitudeCatmullPoints: Vector3[] = [];
        let innerLaneLineAltitudeCatmullTangents: Vector3[] = [];

        let outerLaneLineCatmullPoints_raw: Vector3[] = [];
        let outerLaneLineCatmullTangents_raw: Vector3[] = [];
        let outerLaneLineSeriePoints_raw: Vector3[] = [];
        let outerLaneLineAltitudeCatmullPoints: Vector3[] = [];
        let outerLaneLineAltitudeCatmullTangents: Vector3[] = [];

        if (this.laneSide === LaneSide.Left) {
          // inner
          if (targetLaneIndex === 0) {
            innerLaneLineCatmullPoints_raw = [...refLineCatmullPoints].reverse();
            innerLaneLineCatmullTangents_raw = [...refLineCatmullTangents].map((tan: Vector3) => {
              return tan.normalize().multiplyByFloats(-1, -1, -1);
            }).reverse();

            innerLaneLineAltitudeCatmullPoints = [...refLineAltitudeCatmullPoints].reverse();
            innerLaneLineAltitudeCatmullTangents = [...refLineAltitudeCatmullTangents].map((tan: Vector3) => {
              return tan.normalize().multiplyByFloats(-1, -1, -1);
            }).reverse();

            innerLaneLineSeriePoints_raw = [...refLineSeriePoints].reverse();
          } else {
            innerLaneLineCatmullPoints_raw = [...removedLaneInnerCatmullPoints];
            innerLaneLineCatmullTangents_raw = [...removedLaneInnerCatmullTangents];

            innerLaneLineAltitudeCatmullPoints = [...removedLaneInnerAltitudeCatmullPoints];
            innerLaneLineAltitudeCatmullTangents = [...removedLaneInnerAltitudeCatmullTangents];

            innerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(innerLaneLineCatmullPoints_raw, innerLaneLineCatmullTangents_raw, refLineSeriePoints.length);
          }

          // outer
          const originalOuterLaneLine = oldLaneItemKeyInfo.laneLines.outerLaneLine;
          const originalOuterLaneLineCatmullPoints = originalOuterLaneLine.catmullPoints;
          const originalOuterLaneLineCatmullTangents = originalOuterLaneLine.catmullTangents;
          const originalOuterLaneLineAltitudeCatmullPoints = originalOuterLaneLine.altitudeCatmullPoints;
          const originalOuterLaneLineAltitudeCatmullTangents = originalOuterLaneLine.altitudeCatmullTangents;
          const originalOuterLaneLineSeriePoints = originalOuterLaneLine.seriePoints;

          const outerResolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(originalOuterLaneLineSeriePoints);
          const originalOuterLaneLineSerieNormals = outerResolved.serieNormals;
          // fix start and end to refline
          originalOuterLaneLineSerieNormals[0] = refLineSerieNormals[refLineSerieNormals.length - 1].multiplyByFloats(-1, -1, -1);
          originalOuterLaneLineSerieNormals[originalOuterLaneLineSerieNormals.length - 1] = refLineSerieNormals[0].multiplyByFloats(-1, -1, -1);

          const selfOuterCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(originalOuterLaneLineSeriePoints, originalOuterLaneLineCatmullPoints);

          outerLaneLineCatmullPoints_raw = originalOuterLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
            return v.add(originalOuterLaneLineSerieNormals[selfOuterCatmullIndices[idx]].multiplyByFloats(-targetLaneMinWidth, -targetLaneMinWidth, -targetLaneMinWidth));
          });
          outerLaneLineCatmullTangents_raw = [...originalOuterLaneLineCatmullTangents];

          outerLaneLineAltitudeCatmullPoints = [...originalOuterLaneLineAltitudeCatmullPoints];
          outerLaneLineAltitudeCatmullTangents = [...originalOuterLaneLineAltitudeCatmullTangents];

          outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(outerLaneLineCatmullPoints_raw, outerLaneLineCatmullTangents_raw, refLineSeriePoints.length);
        } else {
          // inner
          if (targetLaneIndex === 0) {
            innerLaneLineCatmullPoints_raw = [...refLineCatmullPoints];
            innerLaneLineCatmullTangents_raw = [...refLineCatmullTangents].map((tan: Vector3) => {
              return tan.normalize();
            });

            innerLaneLineAltitudeCatmullPoints = [...refLineAltitudeCatmullPoints];
            innerLaneLineAltitudeCatmullTangents = [...refLineAltitudeCatmullTangents].map((tan: Vector3) => {
              return tan.normalize();
            });

            innerLaneLineSeriePoints_raw = [...refLineSeriePoints];
          } else {
            innerLaneLineCatmullPoints_raw = [...removedLaneInnerCatmullPoints];
            innerLaneLineCatmullTangents_raw = [...removedLaneInnerCatmullTangents];

            innerLaneLineAltitudeCatmullPoints = [...removedLaneInnerAltitudeCatmullPoints];
            innerLaneLineAltitudeCatmullTangents = [...removedLaneInnerAltitudeCatmullTangents];

            innerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(innerLaneLineCatmullPoints_raw, innerLaneLineCatmullTangents_raw, refLineSeriePoints.length);
          }

          // outer
          const originalOuterLaneLine = oldLaneItemKeyInfo.laneLines.outerLaneLine;
          const originalOuterLaneLineCatmullPoints = originalOuterLaneLine.catmullPoints;
          const originalOuterLaneLineCatmullTangents = originalOuterLaneLine.catmullTangents;
          const originalOuterLaneLineAltitudeCatmullPoints = originalOuterLaneLine.altitudeCatmullPoints;
          const originalOuterLaneLineAltitudeCatmullTangents = originalOuterLaneLine.altitudeCatmullTangents;
          const originalOuterLaneLineSeriePoints = originalOuterLaneLine.seriePoints;

          const outerResolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(originalOuterLaneLineSeriePoints);
          const originalOuterLaneLineSerieNormals = outerResolved.serieNormals;
          // fix start and end to refline
          originalOuterLaneLineSerieNormals[0] = refLineSerieNormals[0];
          originalOuterLaneLineSerieNormals[originalOuterLaneLineSerieNormals.length - 1] = refLineSerieNormals[refLineSerieNormals.length - 1];

          const selfOuterCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(originalOuterLaneLineSeriePoints, originalOuterLaneLineCatmullPoints);

          outerLaneLineCatmullPoints_raw = originalOuterLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
            return v.add(originalOuterLaneLineSerieNormals[selfOuterCatmullIndices[idx]].multiplyByFloats(-targetLaneMinWidth, -targetLaneMinWidth, -targetLaneMinWidth));
          });
          outerLaneLineCatmullTangents_raw = [...originalOuterLaneLineCatmullTangents];

          outerLaneLineAltitudeCatmullPoints = [...originalOuterLaneLineAltitudeCatmullPoints];
          outerLaneLineAltitudeCatmullTangents = [...originalOuterLaneLineAltitudeCatmullTangents];

          outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(outerLaneLineCatmullPoints_raw, outerLaneLineCatmullTangents_raw, refLineSeriePoints.length);
        }

        // inner
        const appliedInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
          innerLaneLineCatmullPoints_raw,
          innerLaneLineSeriePoints_raw,
          innerLaneLineAltitudeCatmullPoints,
          innerLaneLineAltitudeCatmullTangents,
        );
  
        const innerLaneLineCatmullPoints = appliedInner.appliedCatmullPoints;
        const innerLaneLineSeriePoints = (targetLaneIndex === 0) ? innerLaneLineSeriePoints_raw : appliedInner.appliedSeriePoints;
        const innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;

        // outer
        const appliedOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
          outerLaneLineCatmullPoints_raw,
          outerLaneLineSeriePoints_raw,
          outerLaneLineAltitudeCatmullPoints,
          outerLaneLineAltitudeCatmullTangents,
        );
  
        const outerLaneLineCatmullPoints = appliedOuter.appliedCatmullPoints;
        const outerLaneLineSeriePoints = appliedOuter.appliedSeriePoints;
        const outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;


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
              catmullPoints: innerLaneLineCatmullPoints,
              catmullTangents: innerLaneLineCatmullTangents,
              altitudeCatmullPoints: innerLaneLineAltitudeCatmullPoints,
              altitudeCatmullTangents: innerLaneLineAltitudeCatmullTangents,
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: outerLaneLineSeriePoints,
              category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
              catmullPoints: outerLaneLineCatmullPoints,
              catmullTangents: outerLaneLineCatmullTangents,
              altitudeCatmullPoints: outerLaneLineAltitudeCatmullPoints,
              altitudeCatmullTangents: outerLaneLineAltitudeCatmullTangents,
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
              catmullPoints: [innerLaneLineCatmullPoints[0], outerLaneLineCatmullPoints[0]],
              catmullTangents: [innerLaneLineCatmullTangents[0], outerLaneLineCatmullTangents[0]],
              altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[0], outerLaneLineAltitudeCatmullPoints[0]],
              altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[0], outerLaneLineAltitudeCatmullTangents[0]],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryType,
            },
            laneConnectorEnd: {
              seriePoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
              category: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.category,
              options: { ...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.options },
              laneLineSide: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.laneLineSide,
              catmullPoints: [innerLaneLineCatmullPoints[innerLaneLineCatmullPoints.length - 1], outerLaneLineCatmullPoints[outerLaneLineCatmullPoints.length - 1]],
              catmullTangents: [innerLaneLineCatmullTangents[innerLaneLineCatmullTangents.length - 1], outerLaneLineCatmullTangents[outerLaneLineCatmullTangents.length - 1]],
              altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[innerLaneLineAltitudeCatmullPoints.length - 1], outerLaneLineAltitudeCatmullPoints[outerLaneLineAltitudeCatmullPoints.length - 1]],
              altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[innerLaneLineAltitudeCatmullTangents.length - 1], outerLaneLineAltitudeCatmullTangents[outerLaneLineAltitudeCatmullTangents.length - 1]],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.atlasLaneBoundaryType,
            },
          },
        } as LaneItemKeyInfo);
      } else if (idx > targetLaneIndex) {
        let innerLaneLineCatmullPoints_raw: Vector3[] = [];
        let innerLaneLineCatmullTangents_raw: Vector3[] = [];
        let innerLaneLineSeriePoints_raw: Vector3[] = [];
        let innerLaneLineAltitudeCatmullPoints: Vector3[] = [];
        let innerLaneLineAltitudeCatmullTangents: Vector3[] = [];

        let outerLaneLineCatmullPoints_raw: Vector3[] = [];
        let outerLaneLineCatmullTangents_raw: Vector3[] = [];
        let outerLaneLineSeriePoints_raw: Vector3[] = [];
        let outerLaneLineAltitudeCatmullPoints: Vector3[] = [];
        let outerLaneLineAltitudeCatmullTangents: Vector3[] = [];
        
        if (this.laneSide === LaneSide.Left) {
          // inner
          const originalInnerLaneLine = oldLaneItemKeyInfo.laneLines.innerLaneLine;
          const originalInnerLaneLineCatmullPoints = originalInnerLaneLine.catmullPoints;
          const originalInnerLaneLineCatmullTangents = originalInnerLaneLine.catmullTangents;
          const originalInnerLaneLineAltitudeCatmullPoints = originalInnerLaneLine.altitudeCatmullPoints;
          const originalInnerLaneLineAltitudeCatmullTangents = originalInnerLaneLine.altitudeCatmullTangents;
          const originalInnerLaneLineSeriePoints = originalInnerLaneLine.seriePoints;

          const innerResolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(originalInnerLaneLineSeriePoints);
          const originalInnerLaneLineSerieNormals = innerResolved.serieNormals;
          // fix start and end to refline
          originalInnerLaneLineSerieNormals[0] = refLineSerieNormals[refLineSerieNormals.length - 1].multiplyByFloats(-1, -1, -1);
          originalInnerLaneLineSerieNormals[originalInnerLaneLineSerieNormals.length - 1] = refLineSerieNormals[0].multiplyByFloats(-1, -1, -1);

          const selfInnerCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(originalInnerLaneLineSeriePoints, originalInnerLaneLineCatmullPoints);

          innerLaneLineCatmullPoints_raw = originalInnerLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
            return v.add(originalInnerLaneLineSerieNormals[selfInnerCatmullIndices[idx]].multiplyByFloats(-targetLaneMinWidth, -targetLaneMinWidth, -targetLaneMinWidth));
          });
          innerLaneLineCatmullTangents_raw = [...originalInnerLaneLineCatmullTangents];

          innerLaneLineAltitudeCatmullPoints = [...originalInnerLaneLineAltitudeCatmullPoints];
          innerLaneLineAltitudeCatmullTangents = [...originalInnerLaneLineAltitudeCatmullTangents];

          // outer
          const originalOuterLaneLine = oldLaneItemKeyInfo.laneLines.outerLaneLine;
          const originalOuterLaneLineCatmullPoints = originalOuterLaneLine.catmullPoints;
          const originalOuterLaneLineCatmullTangents = originalOuterLaneLine.catmullTangents;
          const originalOuterLaneLineAltitudeCatmullPoints = originalOuterLaneLine.altitudeCatmullPoints;
          const originalOuterLaneLineAltitudeCatmullTangents = originalOuterLaneLine.altitudeCatmullTangents;
          const originalOuterLaneLineSeriePoints = originalOuterLaneLine.seriePoints;

          const outerResolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(originalOuterLaneLineSeriePoints);
          const originalOuterLaneLineSerieNormals = outerResolved.serieNormals;
          // fix start and end to refline
          originalOuterLaneLineSerieNormals[0] = refLineSerieNormals[refLineSerieNormals.length - 1].multiplyByFloats(-1, -1, -1);
          originalOuterLaneLineSerieNormals[originalOuterLaneLineSerieNormals.length - 1] = refLineSerieNormals[0].multiplyByFloats(-1, -1, -1);

          const selfOuterCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(originalOuterLaneLineSeriePoints, originalOuterLaneLineCatmullPoints);

          outerLaneLineCatmullPoints_raw = originalOuterLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
            return v.add(originalOuterLaneLineSerieNormals[selfOuterCatmullIndices[idx]].multiplyByFloats(-targetLaneMinWidth, -targetLaneMinWidth, -targetLaneMinWidth));
          });
          outerLaneLineCatmullTangents_raw = [...originalOuterLaneLineCatmullTangents];

          outerLaneLineAltitudeCatmullPoints = [...originalOuterLaneLineAltitudeCatmullPoints];
          outerLaneLineAltitudeCatmullTangents = [...originalOuterLaneLineAltitudeCatmullTangents];
        } else {
          // inner
          const originalInnerLaneLine = oldLaneItemKeyInfo.laneLines.innerLaneLine;
          const originalInnerLaneLineCatmullPoints = originalInnerLaneLine.catmullPoints;
          const originalInnerLaneLineCatmullTangents = originalInnerLaneLine.catmullTangents;
          const originalInnerLaneLineAltitudeCatmullPoints = originalInnerLaneLine.altitudeCatmullPoints;
          const originalInnerLaneLineAltitudeCatmullTangents = originalInnerLaneLine.altitudeCatmullTangents;
          const originalInnerLaneLineSeriePoints = originalInnerLaneLine.seriePoints;

          const innerResolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(originalInnerLaneLineSeriePoints);
          const originalInnerLaneLineSerieNormals = innerResolved.serieNormals;
          // fix start and end to refline
          originalInnerLaneLineSerieNormals[0] = refLineSerieNormals[0];
          originalInnerLaneLineSerieNormals[originalInnerLaneLineSerieNormals.length - 1] = refLineSerieNormals[refLineSerieNormals.length - 1];

          const selfInnerCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(originalInnerLaneLineSeriePoints, originalInnerLaneLineCatmullPoints);

          innerLaneLineCatmullPoints_raw = originalInnerLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
            return v.add(originalInnerLaneLineSerieNormals[selfInnerCatmullIndices[idx]].multiplyByFloats(-targetLaneMinWidth, -targetLaneMinWidth, -targetLaneMinWidth));
          });
          innerLaneLineCatmullTangents_raw = [...originalInnerLaneLineCatmullTangents];

          innerLaneLineAltitudeCatmullPoints = [...originalInnerLaneLineAltitudeCatmullPoints];
          innerLaneLineAltitudeCatmullTangents = [...originalInnerLaneLineAltitudeCatmullTangents];

          // outer
          const originalOuterLaneLine = oldLaneItemKeyInfo.laneLines.outerLaneLine;
          const originalOuterLaneLineCatmullPoints = originalOuterLaneLine.catmullPoints;
          const originalOuterLaneLineCatmullTangents = originalOuterLaneLine.catmullTangents;
          const originalOuterLaneLineAltitudeCatmullPoints = originalOuterLaneLine.altitudeCatmullPoints;
          const originalOuterLaneLineAltitudeCatmullTangents = originalOuterLaneLine.altitudeCatmullTangents;
          const originalOuterLaneLineSeriePoints = originalOuterLaneLine.seriePoints;

          const outerResolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(originalOuterLaneLineSeriePoints);
          const originalOuterLaneLineSerieNormals = outerResolved.serieNormals;
          // fix start and end to refline
          originalOuterLaneLineSerieNormals[0] = refLineSerieNormals[0];
          originalOuterLaneLineSerieNormals[originalOuterLaneLineSerieNormals.length - 1] = refLineSerieNormals[refLineSerieNormals.length - 1];

          const selfOuterCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(originalOuterLaneLineSeriePoints, originalOuterLaneLineCatmullPoints);

          outerLaneLineCatmullPoints_raw = originalOuterLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
            return v.add(originalOuterLaneLineSerieNormals[selfOuterCatmullIndices[idx]].multiplyByFloats(-targetLaneMinWidth, -targetLaneMinWidth, -targetLaneMinWidth));
          });
          outerLaneLineCatmullTangents_raw = [...originalOuterLaneLineCatmullTangents];

          outerLaneLineAltitudeCatmullPoints = [...originalOuterLaneLineAltitudeCatmullPoints];
          outerLaneLineAltitudeCatmullTangents = [...originalOuterLaneLineAltitudeCatmullTangents];
        }

        // inner
        innerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(innerLaneLineCatmullPoints_raw, innerLaneLineCatmullTangents_raw, refLineSeriePoints.length);

        const appliedInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
          innerLaneLineCatmullPoints_raw,
          innerLaneLineSeriePoints_raw,
          innerLaneLineAltitudeCatmullPoints,
          innerLaneLineAltitudeCatmullTangents,
        );
  
        const innerLaneLineCatmullPoints = appliedInner.appliedCatmullPoints;
        const innerLaneLineSeriePoints = appliedInner.appliedSeriePoints;
        const innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;

        // outer
        outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(outerLaneLineCatmullPoints_raw, outerLaneLineCatmullTangents_raw, refLineSeriePoints.length);

        const appliedOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
          outerLaneLineCatmullPoints_raw,
          outerLaneLineSeriePoints_raw,
          outerLaneLineAltitudeCatmullPoints,
          outerLaneLineAltitudeCatmullTangents,
        );
  
        const outerLaneLineCatmullPoints = appliedOuter.appliedCatmullPoints;
        const outerLaneLineSeriePoints = appliedOuter.appliedSeriePoints;
        const outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;


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
              catmullPoints: innerLaneLineCatmullPoints,
              catmullTangents: innerLaneLineCatmullTangents,
              altitudeCatmullPoints: innerLaneLineAltitudeCatmullPoints,
              altitudeCatmullTangents: innerLaneLineAltitudeCatmullTangents,
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: outerLaneLineSeriePoints,
              category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
              catmullPoints: outerLaneLineCatmullPoints,
              catmullTangents: outerLaneLineCatmullTangents,
              altitudeCatmullPoints: outerLaneLineAltitudeCatmullPoints,
              altitudeCatmullTangents: outerLaneLineAltitudeCatmullTangents,
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
              catmullPoints: [innerLaneLineCatmullPoints[0], outerLaneLineCatmullPoints[0]],
              catmullTangents: [innerLaneLineCatmullTangents[0], outerLaneLineCatmullTangents[0]],
              altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[0], outerLaneLineAltitudeCatmullPoints[0]],
              altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[0], outerLaneLineAltitudeCatmullTangents[0]],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryType,
            },
            laneConnectorEnd: {
              seriePoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
              category: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.category,
              options: { ...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.options },
              laneLineSide: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.laneLineSide,
              catmullPoints: [innerLaneLineCatmullPoints[innerLaneLineCatmullPoints.length - 1], outerLaneLineCatmullPoints[outerLaneLineCatmullPoints.length - 1]],
              catmullTangents: [innerLaneLineCatmullTangents[innerLaneLineCatmullTangents.length - 1], outerLaneLineCatmullTangents[outerLaneLineCatmullTangents.length - 1]],
              altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[innerLaneLineAltitudeCatmullPoints.length - 1], outerLaneLineAltitudeCatmullPoints[outerLaneLineAltitudeCatmullPoints.length - 1]],
              altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[innerLaneLineAltitudeCatmullTangents.length - 1], outerLaneLineAltitudeCatmullTangents[outerLaneLineAltitudeCatmullTangents.length - 1]],
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

    this.scope.emitEvent(InvokeRemoveLaneCatmullSerieRoadEvent, {
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

    this.scope.emitEvent(InvokeAddLaneCatmullSerieRoadEvent, {
      laneId: this.laneId,
    });
  }
};