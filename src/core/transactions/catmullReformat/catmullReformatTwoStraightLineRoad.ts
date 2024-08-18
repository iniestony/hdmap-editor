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
import { LineType } from '../../plugins/lineDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  InvokeReformatTwoStraightLineRoadEvent,
} from '../event';


export default class CatmullReformatTwoStraightLineRoadTransaction extends StandardTransaction {
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

    const newRefLineCatmullPoints = [...this.newRefLineCatmullPoints];
    const reflineCatmullTangents = [...this.newRefLineCatmullTangents];

    const reflineSeriePoints = this.scope.generateSeriePointsViaCatmullPoints(newRefLineCatmullPoints);
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
      catmullPoints: [...newRefLineCatmullPoints],
      catmullTangents: [...reflineCatmullTangents],
      altitudeCatmullPoints: [],
      altitudeCatmullTangents: [],
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


    const oldReflinePoints = [...oldRoadItemKeyInfo.referenceLine.seriePoints];

    // left lanes
    newKeyInfo.laneItems.leftLanes = oldRoadItemKeyInfo.laneItems.leftLanes.map((oldLaneItemKeyInfo: LaneItemKeyInfo) => {
      const oldInnerLaneLineSeriePoints = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints];
      const oldOuterLaneLineSeriePoints = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints];

      const innerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
        const oldReflinePoint = oldReflinePoints[idx];
        const oldInnerLaneLinePoint = [...oldInnerLaneLineSeriePoints].reverse()[idx];
        const distance = oldReflinePoint.subtract(oldInnerLaneLinePoint).length();

        return v.add(reflineSerieNormals[idx].multiplyByFloats(-distance, -distance, -distance));
      }).reverse();

      const outerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
        const oldReflinePoint = oldReflinePoints[idx];
        const oldOuterLaneLinePoint = [...oldOuterLaneLineSeriePoints].reverse()[idx];
        const distance = oldReflinePoint.subtract(oldOuterLaneLinePoint).length();

        return v.add(reflineSerieNormals[idx].multiplyByFloats(-distance, -distance, -distance));
      }).reverse();

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
      } as LaneItemKeyInfo;
    });

    // right lanes
    newKeyInfo.laneItems.rightLanes = oldRoadItemKeyInfo.laneItems.rightLanes.map((oldLaneItemKeyInfo: LaneItemKeyInfo) => {
      const oldInnerLaneLineSeriePoints = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints];
      const oldOuterLaneLineSeriePoints = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints];

      const innerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
        const oldReflinePoint = oldReflinePoints[idx];
        const oldInnerLaneLinePoint = [...oldInnerLaneLineSeriePoints][idx];
        const distance = oldReflinePoint.subtract(oldInnerLaneLinePoint).length();

        return v.add(reflineSerieNormals[idx].multiplyByFloats(distance, distance, distance));
      });

      const outerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
        const oldReflinePoint = oldReflinePoints[idx];
        const oldOuterLaneLinePoint = [...oldOuterLaneLineSeriePoints][idx];
        const distance = oldReflinePoint.subtract(oldOuterLaneLinePoint).length();

        return v.add(reflineSerieNormals[idx].multiplyByFloats(distance, distance, distance));
      });

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

    this.scope.emitEvent(InvokeReformatTwoStraightLineRoadEvent, {
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

    this.scope.emitEvent(InvokeReformatTwoStraightLineRoadEvent, {
      reflinePoints: reflineKeyPoints,
    });
  }
};