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
  LaneLineItem,
  ReferenceLineItem,
  LaneItemKeyInfo,
  RoadItemKeyInfo,
} from '../../plugins/statusManager/type';
import {
  StoreRoadEvent,
  RemoveRoadEvent,
  ReformatRoadEvent,
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import { LineType } from '../../plugins/lineDrawer/type';
import { RoadVertexCategory } from '../../plugins/roadConnectionDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  AtlasRoad,
  AtlasLane,
  AtlasLaneBoundaryType,
} from '../../plugins/atlasConverter/type';
import {
  InvokeCreateConnectionRoadEvent,
  InvokeRemoveConnectionRoadEvent,
  InvokeReformatConnectionRoadEvent,
} from '../event';

export default class CreateConnectionRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;

  private connectionRoadId: string;
  private startRoadId: string;
  private startRoadCategory: RoadCategory;
  private startRoadVertexCategory: RoadVertexCategory;
  private endRoadId: string;
  private endRoadCategory: RoadCategory;
  private endRoadVertexCategory: RoadVertexCategory;

  private startRoadItem?: RoadItem;
  private endRoadItem?: RoadItem;

  private createdRoadItem?: RoadItem;

  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.connectionRoadId = (options as unknown as { id: string }).id;
    this.startRoadId = (options as unknown as { startRoadId: string }).startRoadId;
    this.startRoadCategory = (options as unknown as { startRoadCategory: RoadCategory }).startRoadCategory;
    this.startRoadVertexCategory = (options as unknown as { startRoadVertexCategory: RoadVertexCategory }).startRoadVertexCategory;
    this.endRoadId = (options as unknown as { endRoadId: string }).endRoadId;
    this.endRoadCategory = (options as unknown as { endRoadCategory: RoadCategory }).endRoadCategory;
    this.endRoadVertexCategory = (options as unknown as { endRoadVertexCategory: RoadVertexCategory }).endRoadVertexCategory;
  }

  commit() {
    super.commit();

    this.resolveNecessaryInfo();
    const entity = this.createRoad();
    return { entity };
  }

  onUndo() {
    super.onUndo();
    this.removeRoad();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.createRoad();
  }

  resolveNecessaryInfo() {
    this.startRoadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.startRoadId, this.startRoadCategory) as RoadItem;
    this.endRoadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.endRoadId, this.endRoadCategory) as RoadItem;
  }

  createInitReferenceLine() {
    const startRoadItem = this.startRoadItem as RoadItem;
    const endRoadItem = this.endRoadItem as RoadItem;

    // refline is always from start road to end road
    const reflineCollection = this.scope.resolveConnectionRoadInitRefLineSerieCollection(
      startRoadItem,
      endRoadItem,
      this.startRoadVertexCategory,
      this.endRoadVertexCategory,
    );

    const seriePoints = reflineCollection.seriePoints;
    const serieTangents = reflineCollection.serieTangents;
    const serieNormals = reflineCollection.serieNormals;
    const catmullPoints = reflineCollection.catmullPoints;
    const catmullTangents = reflineCollection.catmullTangents;
    const altitudeCatmullPoints = reflineCollection.altitudeCatmullPoints;
    const altitudeCatmullTangents = reflineCollection.altitudeCatmullTangents;

    const drawingPoints = [...seriePoints];

    const lineId = `${this.connectionRoadId}_ReferenceLine`;
    const line = this.scope.createPureRefererenceLine({
      points: [...seriePoints],
      id: lineId,
    });

    const referenceLineItem = {
      points: [],
      pointsMesh: [],
      lineAndCurveMesh: line,
      markerDisposed: true,
      category: LineAndCurveCategory.TwoStraightLine,
      drawingPoints,
      seriePoints,
      serieNormals,
      serieTangents,
      options: {
        lineType: LineType.Solid,
        lineColor: RendererConfig.connection.solidLineColor,
        lineId,
      },
      catmullPoints,
      catmullTangents,
      altitudeCatmullPoints,
      altitudeCatmullTangents,
    } as ReferenceLineItem;

    (line as LinesMesh).metadata = {
      lineAndCurveItem: referenceLineItem,
    };

    this.scope.makeSceneDirty();

    return referenceLineItem;
  }

  generateNewKeyInfo(newRoadItem: RoadItem) {
    const startRoadItem = this.startRoadItem as RoadItem;
    const endRoadItem = this.endRoadItem as RoadItem;

    const newKeyInfo = {
      referenceLineEditable: newRoadItem.referenceLineEditable,
      generalLeftLaneIndex: newRoadItem.generalLeftLaneIndex,
      generalRightLaneIndex: newRoadItem.generalRightLaneIndex,
      category: newRoadItem.category,
      roadId: newRoadItem.roadId,
      roadPID: newRoadItem.roadPID,
      position: newRoadItem.position,
      rotation: newRoadItem.rotation,
      atlasRoadType: newRoadItem.atlasRoadType,
      matAlpha: newRoadItem.matAlpha,
      prevRoads: [...newRoadItem.prevRoads],
      nextRoads: [...newRoadItem.nextRoads],
      junctionId: newRoadItem.junctionId,
    } as RoadItemKeyInfo;

    // refline is always from start road to end road
    const reflineCollection = this.scope.resolveConnectionRoadInitRefLineSerieCollection(
      startRoadItem,
      endRoadItem,
      this.startRoadVertexCategory,
      this.endRoadVertexCategory,
    );

    const reflineSeriePoints = reflineCollection.seriePoints;
    const reflineSerieTangents = reflineCollection.serieTangents;
    const reflineSerieNormals = reflineCollection.serieNormals;
    const reflineCatmullPoints = reflineCollection.catmullPoints;
    const reflineCatmullTangents = reflineCollection.catmullTangents;
    const altitudeCatmullPoints = reflineCollection.altitudeCatmullPoints;
    const altitudeCatmullTangents = reflineCollection.altitudeCatmullTangents;

    newKeyInfo.referenceLine = {
      points: [...newRoadItem.referenceLine.points],
      seriePoints: [...reflineSeriePoints],
      serieNormals: [...reflineSerieNormals],
      serieTangents: [...reflineSerieTangents],
      category: newRoadItem.referenceLine.category,
      options: { ...newRoadItem.referenceLine.options },
      catmullPoints: [...reflineCatmullPoints],
      catmullTangents: [...reflineCatmullTangents],
      altitudeCatmullPoints,
      altitudeCatmullTangents,
    };

    newKeyInfo.surfaceLines = [];

    newKeyInfo.laneItems = {
      leftLanes: [],
      rightLanes: [],
    };

    // resolve correlated lanes
    let correlatedLanesInStartRoadForLeftLanes = [] as LaneItem[];
    let correlatedLanesInEndRoadForLeftLanes = [] as LaneItem[];
    let correlatedLanesInStartRoadForRightLanes = [] as LaneItem[];
    let correlatedLanesInEndRoadForRightLanes = [] as LaneItem[];

    if (this.startRoadVertexCategory === RoadVertexCategory.RoadStart && this.endRoadVertexCategory === RoadVertexCategory.RoadStart) {
      correlatedLanesInStartRoadForLeftLanes = startRoadItem.laneItems.rightLanes;
      correlatedLanesInEndRoadForLeftLanes = endRoadItem.laneItems.leftLanes;
      correlatedLanesInStartRoadForRightLanes = startRoadItem.laneItems.leftLanes;
      correlatedLanesInEndRoadForRightLanes = endRoadItem.laneItems.rightLanes;
    } else if (
      (this.startRoadVertexCategory === RoadVertexCategory.RoadStart && this.endRoadVertexCategory === RoadVertexCategory.RoadEnd) ||
      (this.startRoadVertexCategory === RoadVertexCategory.RoadEnd && this.endRoadVertexCategory === RoadVertexCategory.RoadStart)
    ) {
      correlatedLanesInStartRoadForLeftLanes = startRoadItem.laneItems.leftLanes;
      correlatedLanesInEndRoadForLeftLanes = endRoadItem.laneItems.leftLanes;
      correlatedLanesInStartRoadForRightLanes = startRoadItem.laneItems.rightLanes;
      correlatedLanesInEndRoadForRightLanes = endRoadItem.laneItems.rightLanes;
    } else if (this.startRoadVertexCategory === RoadVertexCategory.RoadEnd && this.endRoadVertexCategory === RoadVertexCategory.RoadEnd) {
      correlatedLanesInStartRoadForLeftLanes = startRoadItem.laneItems.leftLanes;
      correlatedLanesInEndRoadForLeftLanes = endRoadItem.laneItems.rightLanes;
      correlatedLanesInStartRoadForRightLanes = startRoadItem.laneItems.rightLanes;
      correlatedLanesInEndRoadForRightLanes = endRoadItem.laneItems.leftLanes;
    }

    // left lanes
    if (correlatedLanesInStartRoadForLeftLanes.length === 0 || correlatedLanesInEndRoadForLeftLanes.length === 0) {
      newKeyInfo.laneItems.leftLanes = [];
    } else {
      const reflineItemKeyInfo = this.scope.resolveReferenceLineItemKeyInfo(newRoadItem.referenceLine);

      const startRoadLanesCount = correlatedLanesInStartRoadForLeftLanes.length;
      const endRoadLanesCount = correlatedLanesInEndRoadForLeftLanes.length;

      const newLanesCount = Math.max(startRoadLanesCount, endRoadLanesCount);
      const newLanes = [] as LaneItemKeyInfo[];

      for (let i = 0; i < newLanesCount; i++) {
        const startRoadLane = (i < startRoadLanesCount) ? correlatedLanesInStartRoadForLeftLanes[i] : correlatedLanesInStartRoadForLeftLanes[startRoadLanesCount - 1];
        const endRoadLane = (i < endRoadLanesCount) ? correlatedLanesInEndRoadForLeftLanes[i] : correlatedLanesInEndRoadForLeftLanes[endRoadLanesCount - 1];

        // inner
        const rawInnerStartCatmullPoint = endRoadLane.laneLines.innerLaneLine.catmullPoints[endRoadLane.laneLines.innerLaneLine.catmullPoints.length - 1];
        const rawInnerEndCatmullPoint = startRoadLane.laneLines.innerLaneLine.catmullPoints[0];
        const innerLaneLineCatmullPoints_raw = [
          rawInnerStartCatmullPoint,
          rawInnerEndCatmullPoint,
        ];

        const innerLaneLineCatmullTangents_raw = [
          endRoadLane.laneLines.innerLaneLine.catmullTangents[endRoadLane.laneLines.innerLaneLine.catmullTangents.length - 1],
          startRoadLane.laneLines.innerLaneLine.catmullTangents[0],
        ];

        const innerLaneLineSeriePoints_raw = (i === 0) ? (
          [...reflineSeriePoints].reverse()
        ) : (
          this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
            innerLaneLineCatmullPoints_raw,
            innerLaneLineCatmullTangents_raw,
            reflineItemKeyInfo.seriePoints.length,
          )
        );

        const rawInnerStartAltitudeCatmullPoint = endRoadLane.laneLines.innerLaneLine.altitudeCatmullPoints[endRoadLane.laneLines.innerLaneLine.altitudeCatmullPoints.length - 1];
        const rawInnerEndAltitudeCatmullPoint = startRoadLane.laneLines.innerLaneLine.altitudeCatmullPoints[0];
        const innerLaneLineAltitudeCatmullPoints = [
          new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawInnerStartCatmullPoint, rawInnerStartCatmullPoint), 0, rawInnerStartAltitudeCatmullPoint.z),
          new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawInnerEndCatmullPoint, rawInnerStartCatmullPoint), 0, rawInnerEndAltitudeCatmullPoint.z),
        ];

        const innerLaneLineAltitudeCatmullTangents = [
          endRoadLane.laneLines.innerLaneLine.altitudeCatmullTangents[endRoadLane.laneLines.innerLaneLine.altitudeCatmullTangents.length - 1],
          startRoadLane.laneLines.innerLaneLine.altitudeCatmullTangents[0],
        ];

        const appliedInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
          innerLaneLineCatmullPoints_raw,
          innerLaneLineSeriePoints_raw,
          innerLaneLineAltitudeCatmullPoints,
          innerLaneLineAltitudeCatmullTangents,
        );

        const innerLaneLineCatmullPoints = appliedInner.appliedCatmullPoints;
        const innerLaneLineSeriePoints = (i === 0) ? innerLaneLineSeriePoints_raw : appliedInner.appliedSeriePoints;
        const innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;


        // outer
        const rawOuterStartCatmullPoint = endRoadLane.laneLines.outerLaneLine.catmullPoints[endRoadLane.laneLines.outerLaneLine.catmullPoints.length - 1];
        const rawOuterEndCatmullPoint = startRoadLane.laneLines.outerLaneLine.catmullPoints[0];
        const outerLaneLineCatmullPoints_raw = [
          rawOuterStartCatmullPoint,
          rawOuterEndCatmullPoint,
        ];

        const outerLaneLineCatmullTangents_raw = [
          endRoadLane.laneLines.outerLaneLine.catmullTangents[endRoadLane.laneLines.outerLaneLine.catmullTangents.length - 1],
          startRoadLane.laneLines.outerLaneLine.catmullTangents[0],
        ];

        const outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
          outerLaneLineCatmullPoints_raw,
          outerLaneLineCatmullTangents_raw,
          reflineItemKeyInfo.seriePoints.length,
        );

        const rawOuterStartAltitudeCatmullPoint = endRoadLane.laneLines.outerLaneLine.altitudeCatmullPoints[endRoadLane.laneLines.outerLaneLine.altitudeCatmullPoints.length - 1];
        const rawOuterEndAltitudeCatmullPoint = startRoadLane.laneLines.outerLaneLine.altitudeCatmullPoints[0];
        const outerLaneLineAltitudeCatmullPoints = [
          new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawOuterStartCatmullPoint, rawOuterStartCatmullPoint), 0, rawOuterStartAltitudeCatmullPoint.z),
          new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawOuterEndCatmullPoint, rawOuterStartCatmullPoint), 0, rawOuterEndAltitudeCatmullPoint.z),
        ];

        const outerLaneLineAltitudeCatmullTangents = [
          endRoadLane.laneLines.outerLaneLine.altitudeCatmullTangents[endRoadLane.laneLines.outerLaneLine.altitudeCatmullTangents.length - 1],
          startRoadLane.laneLines.outerLaneLine.altitudeCatmullTangents[0],
        ];

        const appliedOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
          outerLaneLineCatmullPoints_raw,
          outerLaneLineSeriePoints_raw,
          outerLaneLineAltitudeCatmullPoints,
          outerLaneLineAltitudeCatmullTangents,
        );
  
        const outerLaneLineCatmullPoints = appliedOuter.appliedCatmullPoints;
        const outerLaneLineSeriePoints = appliedOuter.appliedSeriePoints;
        const outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;


        const laneId = `${newRoadItem.roadId}_0_${newRoadItem.generalLeftLaneIndex}`;

        newLanes.push({
          laneSide: LaneSide.Left,
          laneWidthEditable: false,
          laneId: `${laneId}`,
          atlasLaneSpeedLimit: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneSpeedLimit,
          atlasLaneType: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneType,
          atlasLaneTurn: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneTurn,
          atlasLaneDirection: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneDirection,
          prevLanes: [{
            laneId: endRoadLane.laneId,
            roadId: endRoadItem.roadId,
            roadCategory: endRoadItem.category,
          }],
          nextLanes: [{
            laneId: startRoadLane.laneId,
            roadId: startRoadItem.roadId,
            roadCategory: startRoadItem.category,
          }],
          laneLines: {
            innerLaneLine: {
              seriePoints: innerLaneLineSeriePoints,
              category: reflineItemKeyInfo.category,
              options: {
                ...reflineItemKeyInfo.options,
                lineId: `${laneId}_Inner_Line`,
              },
              laneLineSide: LaneLineSide.Inner,
              catmullPoints: innerLaneLineCatmullPoints,
              catmullTangents: innerLaneLineCatmullTangents,
              altitudeCatmullPoints: innerLaneLineAltitudeCatmullPoints,
              altitudeCatmullTangents: innerLaneLineAltitudeCatmullTangents,
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: outerLaneLineSeriePoints,
              category: reflineItemKeyInfo.category,
              options: {
                ...reflineItemKeyInfo.options,
                lineId: `${laneId}_Outer_Line`,
              },
              laneLineSide: LaneLineSide.Outer,
              catmullPoints: outerLaneLineCatmullPoints,
              catmullTangents: outerLaneLineCatmullTangents,
              altitudeCatmullPoints: outerLaneLineAltitudeCatmullPoints,
              altitudeCatmullTangents: outerLaneLineAltitudeCatmullTangents,
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
            },
          },
          laneConnectors: {
            laneConnectorStart: {
              seriePoints: [innerLaneLineSeriePoints[0], outerLaneLineSeriePoints[0]],
              category: LineAndCurveCategory.TwoStraightLine,
              options: {
                lineType: LineType.Solid,
                lineColor: RendererConfig.mesh.solidLineColor,
                lineId: `${laneId}_ConnectorStart`,
              },
              laneLineSide: LaneLineSide.ConnectorStart,
              catmullPoints: [innerLaneLineCatmullPoints[0], outerLaneLineCatmullPoints[0]],
              catmullTangents: [innerLaneLineCatmullTangents[0], outerLaneLineCatmullTangents[0]],
              altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[0], outerLaneLineAltitudeCatmullPoints[0]],
              altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[0], outerLaneLineAltitudeCatmullTangents[0]],
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
            },
            laneConnectorEnd: {
              seriePoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
              category: LineAndCurveCategory.TwoStraightLine,
              options: {
                lineType: LineType.Solid,
                lineColor: RendererConfig.mesh.solidLineColor,
                lineId: `${laneId}__ConnectorEnd`,
              },
              laneLineSide: LaneLineSide.ConnectorEnd,
              catmullPoints: [innerLaneLineCatmullPoints[innerLaneLineCatmullPoints.length - 1], outerLaneLineCatmullPoints[outerLaneLineCatmullPoints.length - 1]],
              catmullTangents: [innerLaneLineCatmullTangents[innerLaneLineCatmullTangents.length - 1], outerLaneLineCatmullTangents[outerLaneLineCatmullTangents.length - 1]],
              altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[innerLaneLineAltitudeCatmullPoints.length - 1], outerLaneLineAltitudeCatmullPoints[outerLaneLineAltitudeCatmullPoints.length - 1]],
              altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[innerLaneLineAltitudeCatmullTangents.length - 1], outerLaneLineAltitudeCatmullTangents[outerLaneLineAltitudeCatmullTangents.length - 1]],
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
            },
          },
        });

        newRoadItem.generalLeftLaneIndex++;
      }

      newKeyInfo.laneItems.leftLanes = newLanes;
    }

    // right lanes
    if (correlatedLanesInStartRoadForRightLanes.length === 0 || correlatedLanesInEndRoadForRightLanes.length === 0) {
      newKeyInfo.laneItems.rightLanes = [];
    } else {
      const reflineItemKeyInfo = this.scope.resolveReferenceLineItemKeyInfo(newRoadItem.referenceLine);

      const startRoadLanesCount = correlatedLanesInStartRoadForRightLanes.length;
      const endRoadLanesCount = correlatedLanesInEndRoadForRightLanes.length;

      const newLanesCount = Math.max(startRoadLanesCount, endRoadLanesCount);
      const newLanes = [] as LaneItemKeyInfo[];

      for (let i = 0; i < newLanesCount; i++) {
        const startRoadLane = (i < startRoadLanesCount) ? correlatedLanesInStartRoadForRightLanes[i] : correlatedLanesInStartRoadForRightLanes[startRoadLanesCount - 1];
        const endRoadLane = (i < endRoadLanesCount) ? correlatedLanesInEndRoadForRightLanes[i] : correlatedLanesInEndRoadForRightLanes[endRoadLanesCount - 1];

        // inner
        const rawInnerStartCatmullPoint = startRoadLane.laneLines.innerLaneLine.catmullPoints[startRoadLane.laneLines.innerLaneLine.catmullPoints.length - 1];
        const rawInnerEndCatmullPoint = endRoadLane.laneLines.innerLaneLine.catmullPoints[0];
        const innerLaneLineCatmullPoints_raw = [
          rawInnerStartCatmullPoint,
          rawInnerEndCatmullPoint,
        ];

        const innerLaneLineCatmullTangents_raw = [
          startRoadLane.laneLines.innerLaneLine.catmullTangents[startRoadLane.laneLines.innerLaneLine.catmullTangents.length - 1],
          endRoadLane.laneLines.innerLaneLine.catmullTangents[0],
        ];

        const innerLaneLineSeriePoints_raw = (i === 0) ? (
          [...reflineSeriePoints]
        ) : (
          this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
            innerLaneLineCatmullPoints_raw,
            innerLaneLineCatmullTangents_raw,
            reflineItemKeyInfo.seriePoints.length,
          )
        );

        const rawInnerStartAltitudeCatmullPoint = startRoadLane.laneLines.innerLaneLine.altitudeCatmullPoints[startRoadLane.laneLines.innerLaneLine.altitudeCatmullPoints.length - 1];
        const rawInnerEndAltitudeCatmullPoint = endRoadLane.laneLines.innerLaneLine.altitudeCatmullPoints[0];
        const innerLaneLineAltitudeCatmullPoints = [
          new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawInnerStartCatmullPoint, rawInnerStartCatmullPoint), 0, rawInnerStartAltitudeCatmullPoint.z),
          new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawInnerEndCatmullPoint, rawInnerStartCatmullPoint), 0, rawInnerEndAltitudeCatmullPoint.z),
        ];
        
        const innerLaneLineAltitudeCatmullTangents = [
          startRoadLane.laneLines.innerLaneLine.altitudeCatmullTangents[startRoadLane.laneLines.innerLaneLine.altitudeCatmullTangents.length - 1],
          endRoadLane.laneLines.innerLaneLine.altitudeCatmullTangents[0],
        ];

        const appliedInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
          innerLaneLineCatmullPoints_raw,
          innerLaneLineSeriePoints_raw,
          innerLaneLineAltitudeCatmullPoints,
          innerLaneLineAltitudeCatmullTangents,
        );

        const innerLaneLineCatmullPoints = appliedInner.appliedCatmullPoints;
        const innerLaneLineSeriePoints = (i === 0) ? innerLaneLineSeriePoints_raw : appliedInner.appliedSeriePoints;
        const innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;


        // outer
        const rawOuterStartCatmullPoint = startRoadLane.laneLines.outerLaneLine.catmullPoints[startRoadLane.laneLines.outerLaneLine.catmullPoints.length - 1];
        const rawOuterEndCatmullPoint = endRoadLane.laneLines.outerLaneLine.catmullPoints[0];
        const outerLaneLineCatmullPoints_raw = [
          rawOuterStartCatmullPoint,
          rawOuterEndCatmullPoint,
        ];

        const outerLaneLineCatmullTangents_raw = [
          startRoadLane.laneLines.outerLaneLine.catmullTangents[startRoadLane.laneLines.outerLaneLine.catmullTangents.length - 1],
          endRoadLane.laneLines.outerLaneLine.catmullTangents[0],
        ];

        const outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
          outerLaneLineCatmullPoints_raw,
          outerLaneLineCatmullTangents_raw,
          reflineItemKeyInfo.seriePoints.length,
        );
        
        const rawOuterStartAltitudeCatmullPoint = startRoadLane.laneLines.outerLaneLine.altitudeCatmullPoints[startRoadLane.laneLines.outerLaneLine.altitudeCatmullPoints.length - 1];
        const rawOuterEndAltitudeCatmullPoint = endRoadLane.laneLines.outerLaneLine.altitudeCatmullPoints[0];
        const outerLaneLineAltitudeCatmullPoints = [
          new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawOuterStartCatmullPoint, rawOuterStartCatmullPoint), 0, rawOuterStartAltitudeCatmullPoint.z),
          new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawOuterEndCatmullPoint, rawOuterStartCatmullPoint), 0, rawOuterEndAltitudeCatmullPoint.z),
        ];
        
        const outerLaneLineAltitudeCatmullTangents = [
          startRoadLane.laneLines.outerLaneLine.altitudeCatmullTangents[startRoadLane.laneLines.outerLaneLine.altitudeCatmullTangents.length - 1],
          endRoadLane.laneLines.outerLaneLine.altitudeCatmullTangents[0],
        ];

        const appliedOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
          outerLaneLineCatmullPoints_raw,
          outerLaneLineSeriePoints_raw,
          outerLaneLineAltitudeCatmullPoints,
          outerLaneLineAltitudeCatmullTangents,
        );
  
        const outerLaneLineCatmullPoints = appliedOuter.appliedCatmullPoints;
        const outerLaneLineSeriePoints = appliedOuter.appliedSeriePoints;
        const outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;


        const laneId = `${newRoadItem.roadId}_0_${-newRoadItem.generalRightLaneIndex}`;

        newLanes.push({
          laneSide: LaneSide.Right,
          laneWidthEditable: false,
          laneId: `${laneId}`,
          atlasLaneSpeedLimit: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneSpeedLimit,
          atlasLaneType: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneType,
          atlasLaneTurn: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneTurn,
          atlasLaneDirection: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneDirection,
          prevLanes: [{
            laneId: startRoadLane.laneId,
            roadId: startRoadItem.roadId,
            roadCategory: startRoadItem.category,
          }],
          nextLanes: [{
            laneId: endRoadLane.laneId,
            roadId: endRoadItem.roadId,
            roadCategory: endRoadItem.category,
          }],
          laneLines: {
            innerLaneLine: {
              seriePoints: innerLaneLineSeriePoints,
              category: reflineItemKeyInfo.category,
              options: {
                ...reflineItemKeyInfo.options,
                lineId: `${laneId}_Inner_Line`,
              },
              laneLineSide: LaneLineSide.Inner,
              catmullPoints: innerLaneLineCatmullPoints,
              catmullTangents: innerLaneLineCatmullTangents,
              altitudeCatmullPoints: innerLaneLineAltitudeCatmullPoints,
              altitudeCatmullTangents: innerLaneLineAltitudeCatmullTangents,
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: outerLaneLineSeriePoints,
              category: reflineItemKeyInfo.category,
              options: {
                ...reflineItemKeyInfo.options,
                lineId: `${laneId}_Outer_Line`,
              },
              laneLineSide: LaneLineSide.Outer,
              catmullPoints: outerLaneLineCatmullPoints,
              catmullTangents: outerLaneLineCatmullTangents,
              altitudeCatmullPoints: outerLaneLineAltitudeCatmullPoints,
              altitudeCatmullTangents: outerLaneLineAltitudeCatmullTangents,
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
            },
          },
          laneConnectors: {
            laneConnectorStart: {
              seriePoints: [innerLaneLineSeriePoints[0], outerLaneLineSeriePoints[0]],
              category: LineAndCurveCategory.TwoStraightLine,
              options: {
                lineType: LineType.Solid,
                lineColor: RendererConfig.mesh.solidLineColor,
                lineId: `${laneId}_ConnectorStart`,
              },
              laneLineSide: LaneLineSide.ConnectorStart,
              catmullPoints: [innerLaneLineCatmullPoints[0], outerLaneLineCatmullPoints[0]],
              catmullTangents: [innerLaneLineCatmullTangents[0], outerLaneLineCatmullTangents[0]],
              altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[0], outerLaneLineAltitudeCatmullPoints[0]],
              altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[0], outerLaneLineAltitudeCatmullTangents[0]],
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
            },
            laneConnectorEnd: {
              seriePoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
              category: LineAndCurveCategory.TwoStraightLine,
              options: {
                lineType: LineType.Solid,
                lineColor: RendererConfig.mesh.solidLineColor,
                lineId: `${laneId}__ConnectorEnd`,
              },
              laneLineSide: LaneLineSide.ConnectorEnd,
              catmullPoints: [innerLaneLineCatmullPoints[innerLaneLineCatmullPoints.length - 1], outerLaneLineCatmullPoints[outerLaneLineCatmullPoints.length - 1]],
              catmullTangents: [innerLaneLineCatmullTangents[innerLaneLineCatmullTangents.length - 1], outerLaneLineCatmullTangents[outerLaneLineCatmullTangents.length - 1]],
              altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[innerLaneLineAltitudeCatmullPoints.length - 1], outerLaneLineAltitudeCatmullPoints[outerLaneLineAltitudeCatmullPoints.length - 1]],
              altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[innerLaneLineAltitudeCatmullTangents.length - 1], outerLaneLineAltitudeCatmullTangents[outerLaneLineAltitudeCatmullTangents.length - 1]],
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
            },
          },
        });

        newRoadItem.generalRightLaneIndex++;
      }

      newKeyInfo.laneItems.rightLanes = newLanes;
    }

    return newKeyInfo;
  }

  createRoad() {
    const referenceLine = this.createInitReferenceLine();

    const refLineSerieNormals = referenceLine.serieNormals;
    const refLineSerieTangents = referenceLine.serieTangents;

    const startPointNormal = refLineSerieNormals[0];
    const endPointNormal = refLineSerieNormals[refLineSerieNormals.length - 1];
    const startPointTangent = refLineSerieTangents[0];
    const endPointTangent = refLineSerieTangents[refLineSerieTangents.length - 1];

    const roadItem = {
      referenceLine: referenceLine,
      referenceLineEditable: true,
      surfaceLines: [],
      laneItems: {
        leftLanes: [],
        rightLanes: [],
      },
      startPointNormal,
      endPointNormal,
      startPointTangent,
      endPointTangent,
      generalLeftLaneIndex: 1,
      generalRightLaneIndex: 1,
      category: RoadCategory.ConnectionRoad,
      roadId: this.connectionRoadId,
      roadPID: this.scope.generatePersistenceID() as string,
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      atlasRoadType: AtlasRoad.Type.CITY_ROAD,
      matAlpha: RendererConfig.scene.defaultRoadMatAlpha,
      prevRoads: [{
        roadId: this.startRoadId,
        roadCategory: this.startRoadCategory,
      }],
      nextRoads: [{
        roadId: this.endRoadId,
        roadCategory: this.endRoadCategory,
      }],
      junctionId: undefined,
    } as RoadItem;
    this.createdRoadItem = roadItem;

    // store first
    this.scope.emitEvent(StoreRoadEvent, roadItem);

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeCreateConnectionRoadEvent, {
      roadId: this.connectionRoadId,
    });

    // reformat then
    const roadItemKeyInfo = this.generateNewKeyInfo(roadItem) as RoadItemKeyInfo;
    const reflineKeyPoints = [...roadItemKeyInfo.referenceLine.points];

    this.scope.emitEvent(ReformatRoadEvent, {
      roadId: roadItemKeyInfo.roadId,
      roadCategory: roadItemKeyInfo.category,
      roadItemKeyInfo: roadItemKeyInfo,
      reflineKeyPoints: roadItemKeyInfo.referenceLine.points,
    });

    this.scope.attachRoadInPrevAndNext(roadItem);
    roadItem.laneItems.leftLanes.forEach((l: LaneItem) => {
      this.scope.attachLaneInPrevAndNext(l, roadItem);
    });
    roadItem.laneItems.rightLanes.forEach((l: LaneItem) => {
      this.scope.attachLaneInPrevAndNext(l, roadItem);
    });

    this.scope.emitEvent(InvokeReformatConnectionRoadEvent, {
      reflinePoints: reflineKeyPoints,
    });

    this.scope.makeSceneDirty();

    return roadItem;
  }

  removeRoad() {
    const createdRoadItem = this.createdRoadItem as RoadItem;

    this.scope.detachRoadInPrevAndNext(createdRoadItem);
    createdRoadItem.laneItems.leftLanes.forEach((l: LaneItem) => {
      this.scope.detachLaneInPrevAndNext(l, createdRoadItem);
    });
    createdRoadItem.laneItems.rightLanes.forEach((l: LaneItem) => {
      this.scope.detachLaneInPrevAndNext(l, createdRoadItem);
    });

    this.scope.emitEvent(RemoveRoadEvent, {
      id: createdRoadItem.roadId,
      category: createdRoadItem.category,
    });

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: createdRoadItem.roadPID,
      roadId: createdRoadItem.roadId,
      roadCategory: createdRoadItem.category,
    });

    this.scope.emitEvent(InvokeRemoveConnectionRoadEvent, {
      roadId: this.connectionRoadId,
    });
  }
};