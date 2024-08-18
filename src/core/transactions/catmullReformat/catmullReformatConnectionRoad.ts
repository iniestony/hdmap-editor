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
  LineAndCurveItemKeyInfo,
  LaneLineItemKeyInfo,
  LaneItemKeyInfo,
  RoadItemKeyInfo,
} from '../../plugins/statusManager/type';
import {
  ReformatRoadEvent,
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  InvokeReformatConnectionRoadEvent,
} from '../event';


export default class CatmullReformatConnectionRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private newRefLineCatmullPoints: Vector3[];
  private newRefLineCatmullTangents: Vector3[];
  private roadId: string;
  private roadCategory: RoadCategory;

  private roadItem?: RoadItem;
  private reflinePoints?: Vector3[];
  private oldRoadItemKeyInfo?: RoadItemKeyInfo;
  private newRoadItemKeyInfo?: RoadItemKeyInfo;
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.newRefLineCatmullPoints = (options as unknown as { newRefLineCatmullPoints: Vector3[] }).newRefLineCatmullPoints;
    this.newRefLineCatmullTangents = (options as unknown as { newRefLineCatmullTangents: Vector3[] }).newRefLineCatmullTangents;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
  }

  commit() {
    super.commit();

    this.preValidateRoad(this.roadId, this.roadCategory);

    this.resolveNecessaryInfo();
    this.reformatNewRoad();

    this.postValidateRoad(this.roadId, this.roadCategory);

    this.dispatchInvalidRoadEvent(this.roadId, this.roadCategory);

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

    this.dispatchInvalidRoadEvent(this.roadId, this.roadCategory);
  }

  resolveNecessaryInfo() {
    this.roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;
    this.reflinePoints = [...this.roadItem.referenceLine.points] as Vector3[];
    this.oldRoadItemKeyInfo = this.scope.resolveRoadItemKeyInfo(this.roadItem) as RoadItemKeyInfo;
    this.newRoadItemKeyInfo = this.generateNewKeyInfoFromOldKeyInfo(this.oldRoadItemKeyInfo) as RoadItemKeyInfo;
  }

  generateNewKeyInfoFromOldKeyInfo(oldRoadItemKeyInfo: RoadItemKeyInfo) {
    const newKeyInfo = {
      referenceLineEditable: oldRoadItemKeyInfo.referenceLineEditable,
      generalLeftLaneIndex: oldRoadItemKeyInfo.generalLeftLaneIndex,
      generalRightLaneIndex: oldRoadItemKeyInfo.generalRightLaneIndex,
      category: oldRoadItemKeyInfo.category,
      roadId: oldRoadItemKeyInfo.roadId,
      roadPID: oldRoadItemKeyInfo.roadPID,
      position: oldRoadItemKeyInfo.position,
      rotation: oldRoadItemKeyInfo.rotation,
      atlasRoadType: oldRoadItemKeyInfo.atlasRoadType,
      matAlpha: oldRoadItemKeyInfo.matAlpha,
      prevRoads: [...oldRoadItemKeyInfo.prevRoads],
      nextRoads: [...oldRoadItemKeyInfo.nextRoads],
      junctionId: oldRoadItemKeyInfo.junctionId,
    } as RoadItemKeyInfo;

    const rawReflineCatmullPoints = [...this.newRefLineCatmullPoints];
    const rawReflineCatmullTangents = [...this.newRefLineCatmullTangents];

    const rawReflineSeriePoints = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(rawReflineCatmullPoints, rawReflineCatmullTangents, oldRoadItemKeyInfo.referenceLine.seriePoints.length);

    const reflineAltitudeCatmullPoints = [...oldRoadItemKeyInfo.referenceLine.altitudeCatmullPoints];
    const reflineAltitudeCatmullTangents = [...oldRoadItemKeyInfo.referenceLine.altitudeCatmullTangents];

    const applied = this.scope.applyAltitudeToHermiteSerieRefLineCatmullPointsAndSeriePoints(
      rawReflineCatmullPoints,
      rawReflineSeriePoints,
      reflineAltitudeCatmullPoints,
      reflineAltitudeCatmullTangents,
    );

    const reflineCatmullPoints = applied.appliedCatmullPoints;
    const reflineSeriePoints = applied.appliedSeriePoints;
    const reflineCatmullTangents = rawReflineCatmullTangents;

    const resolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(reflineSeriePoints);
    const reflineSerieNormals = resolved.serieNormals;
    const reflineSerieTangents = resolved.serieTangents;

    newKeyInfo.referenceLine = {
      points: [...(this.reflinePoints as Vector3[])],
      seriePoints: [...reflineSeriePoints],
      serieNormals:[...reflineSerieNormals],
      serieTangents: [...reflineSerieTangents],
      category: oldRoadItemKeyInfo.referenceLine.category,
      options: { ...oldRoadItemKeyInfo.referenceLine.options },
      catmullPoints: [...reflineCatmullPoints],
      catmullTangents: [...reflineCatmullTangents],
      altitudeCatmullPoints: [...reflineAltitudeCatmullPoints],
      altitudeCatmullTangents: [...reflineAltitudeCatmullTangents],
    };

    newKeyInfo.surfaceLines = oldRoadItemKeyInfo.surfaceLines.map((l: LineAndCurveItemKeyInfo) => {
      return {
        seriePoints: [...l.seriePoints],
        category: l.category,
        options: { ...l.options },
      };
    });

    newKeyInfo.laneItems = {
      leftLanes: [],
      rightLanes: [],
    };

    // left lanes
    newKeyInfo.laneItems.leftLanes = oldRoadItemKeyInfo.laneItems.leftLanes.map((oldLaneItemKeyInfo: LaneItemKeyInfo, laneIndex: number) => {
      // inner
      const innerLaneLineAltitudeCatmullPoints = [...reflineAltitudeCatmullPoints].reverse();
      const innerLaneLineAltitudeCatmullTangents = [...reflineAltitudeCatmullTangents].reverse().map((v: Vector3) => {
        return v.multiplyByFloats(-1, -1, -1);
      });

      const innerLaneLineCatmullPoints_raw = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints];
      const innerLaneLineCatmullTangents_raw = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents];

      const innerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
        innerLaneLineCatmullPoints_raw,
        innerLaneLineCatmullTangents_raw,
        reflineSeriePoints.length,
      );

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
      const outerLaneLineAltitudeCatmullPoints = [...reflineAltitudeCatmullPoints].reverse();
      const outerLaneLineAltitudeCatmullTangents = [...reflineAltitudeCatmullTangents].reverse().map((v: Vector3) => {
        return v.multiplyByFloats(-1, -1, -1);
      });

      const outerLaneLineCatmullPoints_raw = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints];
      const outerLaneLineCatmullTangents_raw = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents];

      const outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
        outerLaneLineCatmullPoints_raw,
        outerLaneLineCatmullTangents_raw,
        reflineSeriePoints.length,
      );

      const appliedOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
        outerLaneLineCatmullPoints_raw,
        outerLaneLineSeriePoints_raw,
        outerLaneLineAltitudeCatmullPoints,
        outerLaneLineAltitudeCatmullTangents,
      );

      const outerLaneLineCatmullPoints = appliedOuter.appliedCatmullPoints;
      const outerLaneLineSeriePoints = appliedOuter.appliedSeriePoints;
      const outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;


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
      } as LaneItemKeyInfo;
    });

    // right lanes
    newKeyInfo.laneItems.rightLanes = oldRoadItemKeyInfo.laneItems.rightLanes.map((oldLaneItemKeyInfo: LaneItemKeyInfo, laneIndex: number) => {
      // inner
      const innerLaneLineAltitudeCatmullPoints = [...reflineAltitudeCatmullPoints];
      const innerLaneLineAltitudeCatmullTangents = [...reflineAltitudeCatmullTangents];

      const innerLaneLineCatmullPoints_raw = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints];
      const innerLaneLineCatmullTangents_raw = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents];

      const innerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
        innerLaneLineCatmullPoints_raw,
        innerLaneLineCatmullTangents_raw,
        reflineSeriePoints.length,
      );

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
      const outerLaneLineAltitudeCatmullPoints = [...reflineAltitudeCatmullPoints];
      const outerLaneLineAltitudeCatmullTangents = [...reflineAltitudeCatmullTangents];

      const outerLaneLineCatmullPoints_raw = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints];
      const outerLaneLineCatmullTangents_raw = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents];

      const outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
        outerLaneLineCatmullPoints_raw,
        outerLaneLineCatmullTangents_raw,
        reflineSeriePoints.length,
      );

      const appliedOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
        outerLaneLineCatmullPoints_raw,
        outerLaneLineSeriePoints_raw,
        outerLaneLineAltitudeCatmullPoints,
        outerLaneLineAltitudeCatmullTangents,
      );

      const outerLaneLineCatmullPoints = appliedOuter.appliedCatmullPoints;
      const outerLaneLineSeriePoints = appliedOuter.appliedSeriePoints;
      const outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;


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
      } as LaneItemKeyInfo;
    });

    return newKeyInfo;
  }

  reformatNewRoad() {
    const roadItemKeyInfo = this.newRoadItemKeyInfo as RoadItemKeyInfo;
    const reflineKeyPoints = [...(this.reflinePoints as Vector3[])];

    this.scope.emitEvent(ReformatRoadEvent, {
      roadId: roadItemKeyInfo.roadId,
      roadCategory: roadItemKeyInfo.category,
      roadItemKeyInfo: roadItemKeyInfo,
      reflineKeyPoints: reflineKeyPoints,
    });

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItemKeyInfo.roadPID,
      roadId: roadItemKeyInfo.roadId,
      roadCategory: roadItemKeyInfo.category,
    });

    this.scope.emitEvent(InvokeReformatConnectionRoadEvent, {
      reflinePoints: reflineKeyPoints,
    });
  }

  reformatOldRoad() {
    const roadItemKeyInfo = this.oldRoadItemKeyInfo as RoadItemKeyInfo;
    const reflineKeyPoints = [...(this.reflinePoints as Vector3[])];

    this.scope.emitEvent(ReformatRoadEvent, {
      roadId: roadItemKeyInfo.roadId,
      roadCategory: roadItemKeyInfo.category,
      roadItemKeyInfo: roadItemKeyInfo,
      reflineKeyPoints: reflineKeyPoints,
    });

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItemKeyInfo.roadPID,
      roadId: roadItemKeyInfo.roadId,
      roadCategory: roadItemKeyInfo.category,
    });

    this.scope.emitEvent(InvokeReformatConnectionRoadEvent, {
      reflinePoints: reflineKeyPoints,
    });
  }
};