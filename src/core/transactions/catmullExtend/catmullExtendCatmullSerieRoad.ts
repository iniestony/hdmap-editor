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
  InvokeCatmullExtendCatmullSerieRoadEvent,
} from '../event';


export default class CatmullExtendCatmullSerieRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private newRefLineCatmullPoints: Vector3[];
  private roadId: string;
  private roadCategory: RoadCategory;

  private roadItem?: RoadItem;
  private oldReflinePoints?: Vector3[];
  private oldRoadItemKeyInfo?: RoadItemKeyInfo;
  private newRoadItemKeyInfo?: RoadItemKeyInfo;
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.newRefLineCatmullPoints = (options as unknown as { newRefLineCatmullPoints: Vector3[] }).newRefLineCatmullPoints;
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
    this.oldReflinePoints = [...this.roadItem.referenceLine.points] as Vector3[];
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

    const newCatmullPoint = rawReflineCatmullPoints[rawReflineCatmullPoints.length - 1];
    const lastOldCatmullPoint = rawReflineCatmullPoints[rawReflineCatmullPoints.length - 2];
    const lastNewOldDirection = newCatmullPoint.subtract(lastOldCatmullPoint);
    lastNewOldDirection.y = 0;

    const rawReflineCatmullTangents = [...oldRoadItemKeyInfo.referenceLine.catmullTangents];
    rawReflineCatmullTangents.push(lastNewOldDirection.normalize());

    const rawReflineSeriePoints = this.scope.generateHermiteSerieReflineSeriePointsViaCatmullPointsAndCatmullTangents(rawReflineCatmullPoints, rawReflineCatmullTangents);

    const reflineAltitudeCatmullPoints = [...oldRoadItemKeyInfo.referenceLine.altitudeCatmullPoints];
    const newAltitudeCatmullPointX = this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(newCatmullPoint, rawReflineCatmullPoints[0]);
    reflineAltitudeCatmullPoints.push(new Vector3(newAltitudeCatmullPointX, 0, newCatmullPoint.y));

    // edit last two altitudeCatmullTangents
    const reflineAltitudeCatmullTangents = [...oldRoadItemKeyInfo.referenceLine.altitudeCatmullTangents];

    const rawAltitudeCatmullTangents = this.scope.generateHermiteSerieLineAltitudeCatmullTangentsViaCatmullPoints(reflineAltitudeCatmullPoints);
    const lastButOneRawTangent = rawAltitudeCatmullTangents[rawAltitudeCatmullTangents.length - 2];
    const lastRawTangent = rawAltitudeCatmullTangents[rawAltitudeCatmullTangents.length - 1];
    
    reflineAltitudeCatmullTangents[reflineAltitudeCatmullTangents.length - 1] = lastButOneRawTangent;
    reflineAltitudeCatmullTangents.push(lastRawTangent);

    
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
      points: [...(this.oldReflinePoints as Vector3[])],
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

    // changed refline catmulls, effect on two nearest laneline catmull on extend direction
    const reflineCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(reflineSeriePoints, reflineCatmullPoints);
    const lastReflineCatmullIndex = reflineCatmullIndices[reflineCatmullIndices.length - 1];
    const lastButOneReflineCatmullIndex = reflineCatmullIndices[reflineCatmullIndices.length - 2];

    const oldReflineSeriePoints = [...oldRoadItemKeyInfo.referenceLine.seriePoints];
    const oldReflineLastSeriePoint = oldReflineSeriePoints[oldReflineSeriePoints.length - 1];

    // left lanes
    newKeyInfo.laneItems.leftLanes = oldRoadItemKeyInfo.laneItems.leftLanes.map((oldLaneItemKeyInfo: LaneItemKeyInfo, laneIndex: number) => {
      const oldInnerLaneLineSeriePoints = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints];
      const oldInnerLaneLineTargetSeriePoint = oldInnerLaneLineSeriePoints[0];
      const oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint = oldReflineLastSeriePoint.subtract(oldInnerLaneLineTargetSeriePoint).length();

      const oldOuterLaneLineSeriePoints = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints];
      const oldOuterLaneLineTargetSeriePoint = oldOuterLaneLineSeriePoints[0];
      const oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint = oldReflineLastSeriePoint.subtract(oldOuterLaneLineTargetSeriePoint).length();

      // inner catmull points
      const innerLaneLineAltitudeCatmullPoints = [...reflineAltitudeCatmullPoints].reverse();
      const innerLaneLineAltitudeCatmullTangents = [...reflineAltitudeCatmullTangents].reverse().map((v: Vector3) => {
        return v.multiplyByFloats(-1, -1, -1);
      });

      const innerLaneLineCatmullPoints_raw = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints];
      innerLaneLineCatmullPoints_raw[0] = reflineSeriePoints[lastButOneReflineCatmullIndex].add(reflineSerieNormals[lastButOneReflineCatmullIndex].multiplyByFloats(
        -oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        -oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        -oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
      ));
      innerLaneLineCatmullPoints_raw.unshift(reflineSeriePoints[lastReflineCatmullIndex].add(reflineSerieNormals[lastReflineCatmullIndex].multiplyByFloats(
        -oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        -oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        -oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
      )));

      // inner catmull tangents
      const innerLaneLineCatmullTangents_raw = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents];
      innerLaneLineCatmullTangents_raw[0] = reflineCatmullTangents[reflineCatmullTangents.length - 2].normalize().multiplyByFloats(-1, -1, -1);
      innerLaneLineCatmullTangents_raw.unshift(reflineCatmullTangents[reflineCatmullTangents.length - 1].normalize().multiplyByFloats(-1, -1, -1));

      // inner serie points
      const innerLaneLineSeriePoints_raw = (laneIndex === 0) ? (
        [...reflineSeriePoints].reverse()
      ) : (
        this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(innerLaneLineCatmullPoints_raw, innerLaneLineCatmullTangents_raw, reflineSeriePoints.length)
      );

      const appliedInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
        innerLaneLineCatmullPoints_raw,
        innerLaneLineSeriePoints_raw,
        innerLaneLineAltitudeCatmullPoints,
        innerLaneLineAltitudeCatmullTangents,
      );

      const innerLaneLineCatmullPoints = appliedInner.appliedCatmullPoints;
      const innerLaneLineSeriePoints = (laneIndex === 0) ? innerLaneLineSeriePoints_raw : appliedInner.appliedSeriePoints;
      const innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;
      

      // outer catmull points
      const outerLaneLineAltitudeCatmullPoints = [...reflineAltitudeCatmullPoints].reverse();
      const outerLaneLineAltitudeCatmullTangents = [...reflineAltitudeCatmullTangents].reverse().map((v: Vector3) => {
        return v.multiplyByFloats(-1, -1, -1);
      });

      const outerLaneLineCatmullPoints_raw = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints];
      outerLaneLineCatmullPoints_raw[0] = reflineSeriePoints[lastButOneReflineCatmullIndex].add(reflineSerieNormals[lastButOneReflineCatmullIndex].multiplyByFloats(
        -oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        -oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        -oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
      ));
      outerLaneLineCatmullPoints_raw.unshift(reflineSeriePoints[lastReflineCatmullIndex].add(reflineSerieNormals[lastReflineCatmullIndex].multiplyByFloats(
        -oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        -oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        -oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
      )));

      // outer catmull tangents
      const outerLaneLineCatmullTangents_raw = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents];
      outerLaneLineCatmullTangents_raw[0] = reflineCatmullTangents[reflineCatmullTangents.length - 2].normalize().multiplyByFloats(-1, -1, -1);
      outerLaneLineCatmullTangents_raw.unshift(reflineCatmullTangents[reflineCatmullTangents.length - 1].normalize().multiplyByFloats(-1, -1, -1));

      // outer serie points
      const outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(outerLaneLineCatmullPoints_raw, outerLaneLineCatmullTangents_raw, reflineSeriePoints.length);

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
            catmullPoints: [innerLaneLineSeriePoints[0], outerLaneLineSeriePoints[0]],
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
            catmullPoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
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
      const oldInnerLaneLineSeriePoints = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints];
      const oldInnerLaneLineTargetSeriePoint = oldInnerLaneLineSeriePoints[oldInnerLaneLineSeriePoints.length - 1];
      const oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint = oldReflineLastSeriePoint.subtract(oldInnerLaneLineTargetSeriePoint).length();

      const oldOuterLaneLineSeriePoints = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints];
      const oldOuterLaneLineTargetSeriePoint = oldOuterLaneLineSeriePoints[oldOuterLaneLineSeriePoints.length - 1];
      const oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint = oldReflineLastSeriePoint.subtract(oldOuterLaneLineTargetSeriePoint).length();

      // inner catmull points
      const innerLaneLineAltitudeCatmullPoints = [...reflineAltitudeCatmullPoints];
      const innerLaneLineAltitudeCatmullTangents = [...reflineAltitudeCatmullTangents];

      const innerLaneLineCatmullPoints_raw = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints];
      innerLaneLineCatmullPoints_raw[innerLaneLineCatmullPoints_raw.length - 1] = reflineSeriePoints[lastButOneReflineCatmullIndex].add(reflineSerieNormals[lastButOneReflineCatmullIndex].multiplyByFloats(
        oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
      ));
      innerLaneLineCatmullPoints_raw.push(reflineSeriePoints[lastReflineCatmullIndex].add(reflineSerieNormals[lastReflineCatmullIndex].multiplyByFloats(
        oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        oldInnerLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
      )));

      // inner catmull tangents
      const innerLaneLineCatmullTangents_raw = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents];
      innerLaneLineCatmullTangents_raw[innerLaneLineCatmullTangents_raw.length - 1] = reflineCatmullTangents[reflineCatmullTangents.length - 2].normalize();
      innerLaneLineCatmullTangents_raw.push(reflineCatmullTangents[reflineCatmullTangents.length - 1].normalize());

      // inner serie points
      const innerLaneLineSeriePoints_raw = (laneIndex === 0) ? (
        [...reflineSeriePoints]
      ) : (
        this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(innerLaneLineCatmullPoints_raw, innerLaneLineCatmullTangents_raw, reflineSeriePoints.length)
      );

      const appliedInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
        innerLaneLineCatmullPoints_raw,
        innerLaneLineSeriePoints_raw,
        innerLaneLineAltitudeCatmullPoints,
        innerLaneLineAltitudeCatmullTangents,
      );

      const innerLaneLineCatmullPoints = appliedInner.appliedCatmullPoints;
      const innerLaneLineSeriePoints = (laneIndex === 0) ? innerLaneLineSeriePoints_raw : appliedInner.appliedSeriePoints;
      const innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;


      // outer catmull points
      const outerLaneLineAltitudeCatmullPoints = [...reflineAltitudeCatmullPoints];
      const outerLaneLineAltitudeCatmullTangents = [...reflineAltitudeCatmullTangents];

      const outerLaneLineCatmullPoints_raw = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints];
      outerLaneLineCatmullPoints_raw[outerLaneLineCatmullPoints_raw.length - 1] = reflineSeriePoints[lastButOneReflineCatmullIndex].add(reflineSerieNormals[lastButOneReflineCatmullIndex].multiplyByFloats(
        oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
      ));
      outerLaneLineCatmullPoints_raw.push(reflineSeriePoints[lastReflineCatmullIndex].add(reflineSerieNormals[lastReflineCatmullIndex].multiplyByFloats(
        oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
        oldOuterLaneLineTargetSeriePointDistanceToReflineLastSeriePoint,
      )));

      // outer catmull tangents
      const outerLaneLineCatmullTangents_raw = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents];
      outerLaneLineCatmullTangents_raw[outerLaneLineCatmullTangents_raw.length - 1] = reflineCatmullTangents[reflineCatmullTangents.length - 2].normalize();
      outerLaneLineCatmullTangents_raw.push(reflineCatmullTangents[reflineCatmullTangents.length - 1].normalize());

      // outer serie points
      const outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(outerLaneLineCatmullPoints_raw, outerLaneLineCatmullTangents_raw, reflineSeriePoints.length);

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
            catmullPoints: [innerLaneLineSeriePoints[0], outerLaneLineSeriePoints[0]],
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
            catmullPoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
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
    const reflineKeyPoints = [...(this.oldReflinePoints as Vector3[])];

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

    this.scope.emitEvent(InvokeCatmullExtendCatmullSerieRoadEvent, {
      roadId: roadItemKeyInfo.roadId,
    });
  }

  reformatOldRoad() {
    const roadItemKeyInfo = this.oldRoadItemKeyInfo as RoadItemKeyInfo;
    const reflineKeyPoints = [...(this.oldReflinePoints as Vector3[])];

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

    this.scope.emitEvent(InvokeCatmullExtendCatmullSerieRoadEvent, {
      roadId: roadItemKeyInfo.roadId,
    });
  }
};