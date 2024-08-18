import {
  Vector3,
  Color3,
  MeshBuilder,
  LinesMesh,
  Mesh,
  Curve3,
  Path3D,
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
  JunctionItem,
  JunctionItemKeyInfo,
  JunctionEdgeItem,
  JunctionEdgeItemKeyInfo,
} from '../../plugins/statusManager/type';
import {
  StoreRoadEvent,
  RemoveRoadEvent,
  ReformatRoadEvent,
  StoreJunctionEvent,
  RemoveJunctionEvent,
  StoreDirtyRoadEvent,
  StoreDirtyJunctionEvent,
} from '../../plugins/statusManager/constant';
import { LineType } from '../../plugins/lineDrawer/type';
import { JunctionVertexCategory } from '../../plugins/junctionDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  AtlasRoad,
  AtlasLane,
  AtlasJunction,
} from '../../plugins/atlasConverter/type';
import {
  JunctionEdge,
} from '../../plugins/junctionDrawer/type';
import {
  RoadVertexCategory,
} from '../../plugins/roadConnectionDrawer/type';

import {
  InvokeCreateConnectionRoadEvent,
  InvokeRemoveConnectionRoadEvent,
  InvokeCreateJunctionEvent,
  InvokeRemoveJunctionEvent,
} from '../event';

interface ConnectionItem {
  startRoadId: string;
  startRoadCategory: RoadCategory;
  startRoadVertexCategory: JunctionVertexCategory;
  endRoadId: string;
  endRoadCategory: RoadCategory;
  endRoadVertexCategory: JunctionVertexCategory;
  connectionRoadId: string;
  startRoadItem?: RoadItem;
  endRoadItem?: RoadItem;
  createdRoadItem?: RoadItem;
};

export default class CreateJunctionTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;

  private junctionId: string;
  private allCandidateConnections: Array<{
    startRoadId: string;
    startRoadCategory: RoadCategory;
    startRoadVertexCategory: JunctionVertexCategory;
    endRoadId: string;
    endRoadCategory: RoadCategory;
    endRoadVertexCategory: JunctionVertexCategory;
  }>;
  private connections: Array<ConnectionItem>;
  private pickedOuterRoadsEdges: Array<JunctionEdge>;

  private createdJunctionItem?: JunctionItem;

  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.junctionId = (options as unknown as { junctionId: string }).junctionId;

    this.allCandidateConnections = (options as unknown as {
      allCandidateConnections: Array<{
        startRoadId: string;
        startRoadCategory: RoadCategory;
        startRoadVertexCategory: JunctionVertexCategory;
        endRoadId: string;
        endRoadCategory: RoadCategory;
        endRoadVertexCategory: JunctionVertexCategory;
      }>
    }).allCandidateConnections;

    const connections = (options as unknown as {
      connections: Array<{
        startRoadId: string;
        startRoadCategory: RoadCategory;
        startRoadVertexCategory: JunctionVertexCategory;
        endRoadId: string;
        endRoadCategory: RoadCategory;
        endRoadVertexCategory: JunctionVertexCategory;
      }>
    }).connections;

    const nextCandidateRoadId = Number(this.junctionId) + 1;

    this.connections = connections.map((c: {
      startRoadId: string;
      startRoadCategory: RoadCategory;
      startRoadVertexCategory: JunctionVertexCategory;
      endRoadId: string;
      endRoadCategory: RoadCategory;
      endRoadVertexCategory: JunctionVertexCategory;
    }, idx: number) => {
      return {
        ...c,
        connectionRoadId: `${Number(nextCandidateRoadId) + idx}`,
        startRoadItem: undefined,
        endRoadItem: undefined,
        createdRoadItem: undefined,
      };
    });

    this.pickedOuterRoadsEdges = (options as unknown as {
      edges: Array<JunctionEdge>
    }).edges;
  }

  commit() {
    super.commit();

    this.resolveNecessaryInfo();
    const entity = this.createJunction();

    return { entity };
  }

  onUndo() {
    super.onUndo();
    this.removeJunction();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.createJunction();
  }

  resolveNecessaryInfo() {
    this.connections.forEach((c: ConnectionItem) => {
      c.startRoadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(c.startRoadId, c.startRoadCategory) as RoadItem;
      c.endRoadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(c.endRoadId, c.endRoadCategory) as RoadItem;
    });
  }

  createConnectionInitReferenceLine(c: ConnectionItem) {
    const startRoadItem = c.startRoadItem as RoadItem;
    const endRoadItem = c.endRoadItem as RoadItem;

    // refline is always from start road to end road
    const reflineCollection = this.scope.resolveConnectionRoadInitRefLineSerieCollection(
      startRoadItem,
      endRoadItem,
      c.startRoadVertexCategory,
      c.endRoadVertexCategory,
    );

    const seriePoints = reflineCollection.seriePoints;
    const serieTangents = reflineCollection.serieTangents;
    const serieNormals = reflineCollection.serieNormals;
    const catmullPoints = reflineCollection.catmullPoints;
    const catmullTangents = reflineCollection.catmullTangents;
    const altitudeCatmullPoints = reflineCollection.altitudeCatmullPoints;
    const altitudeCatmullTangents = reflineCollection.altitudeCatmullTangents;

    const drawingPoints = [...seriePoints];


    const lineId = `${c.connectionRoadId}_ReferenceLine`;
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

  generateNewKeyInfoForConnection(c: ConnectionItem) {
    const newRoadItem = c.createdRoadItem as RoadItem
    const startRoadItem = c.startRoadItem as RoadItem;
    const endRoadItem = c.endRoadItem as RoadItem;

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
      c.startRoadVertexCategory,
      c.endRoadVertexCategory,
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

    if (c.startRoadVertexCategory === JunctionVertexCategory.RoadStart && c.endRoadVertexCategory === JunctionVertexCategory.RoadStart) {
      correlatedLanesInStartRoadForLeftLanes = startRoadItem.laneItems.rightLanes;
      correlatedLanesInEndRoadForLeftLanes = endRoadItem.laneItems.leftLanes;
      correlatedLanesInStartRoadForRightLanes = startRoadItem.laneItems.leftLanes;
      correlatedLanesInEndRoadForRightLanes = endRoadItem.laneItems.rightLanes;
    } else if (
      (c.startRoadVertexCategory === JunctionVertexCategory.RoadStart && c.endRoadVertexCategory === JunctionVertexCategory.RoadEnd) ||
      (c.startRoadVertexCategory === JunctionVertexCategory.RoadEnd && c.endRoadVertexCategory === JunctionVertexCategory.RoadStart)
    ) {
      correlatedLanesInStartRoadForLeftLanes = startRoadItem.laneItems.leftLanes;
      correlatedLanesInEndRoadForLeftLanes = endRoadItem.laneItems.leftLanes;
      correlatedLanesInStartRoadForRightLanes = startRoadItem.laneItems.rightLanes;
      correlatedLanesInEndRoadForRightLanes = endRoadItem.laneItems.rightLanes;
    } else if (c.startRoadVertexCategory === JunctionVertexCategory.RoadEnd && c.endRoadVertexCategory === JunctionVertexCategory.RoadEnd) {
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
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryType,
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
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryType,
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
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryType,
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
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryType,
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
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryType,
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
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryType,
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
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryType,
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
              atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryType,
            },
          },
        });

        newRoadItem.generalRightLaneIndex++;
      }

      newKeyInfo.laneItems.rightLanes = newLanes;
    }

    return newKeyInfo;
  }

  createConnectionRoad(c: ConnectionItem) {
    const referenceLine = this.createConnectionInitReferenceLine(c);

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
      roadId: c.connectionRoadId,
      roadPID: this.scope.generatePersistenceID() as string,
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      atlasRoadType: AtlasRoad.Type.CITY_ROAD,
      matAlpha: RendererConfig.scene.defaultRoadMatAlpha,
      prevRoads: [{
        roadId: c.startRoadId,
        roadCategory: c.startRoadCategory,
      }],
      nextRoads: [{
        roadId: c.endRoadId,
        roadCategory: c.endRoadCategory,
      }],
      junctionId: this.junctionId,
    } as RoadItem;

    c.createdRoadItem = roadItem;

    // store first
    this.scope.emitEvent(StoreRoadEvent, roadItem);

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeCreateConnectionRoadEvent, {
      roadId: roadItem.roadId,
    });

    // reformat then
    const roadItemKeyInfo = this.generateNewKeyInfoForConnection(c) as RoadItemKeyInfo;

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

    this.scope.makeSceneDirty();

    return roadItem;
  }

  removeConnectionRoad(c: ConnectionItem) {
    const createdRoadItem = c.createdRoadItem as RoadItem;

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
      roadId: c.connectionRoadId,
    });
  }

  resolveMostOuterLaneLineForEdge(edge: JunctionEdge) {
    const firstRoadVertex = {
      roadId: edge.roadIds[0],
      roadCategory: edge.roadCategories[0],
      junctionVertexCategory: edge.junctionVertexCategories[0],
      roadVertex: edge.roadVertices[0],
    };

    const secondRoadVertex = {
      roadId: edge.roadIds[1],
      roadCategory: edge.roadCategories[1],
      junctionVertexCategory: edge.junctionVertexCategories[1],
      roadVertex: edge.roadVertices[1],
    };

    const candidate = this.allCandidateConnections.find((c: {
      startRoadId: string;
      startRoadCategory: RoadCategory;
      startRoadVertexCategory: JunctionVertexCategory;
      endRoadId: string;
      endRoadCategory: RoadCategory;
      endRoadVertexCategory: JunctionVertexCategory;
    }) => {
      return (c.startRoadId === firstRoadVertex.roadId && c.endRoadId === secondRoadVertex.roadId) || (c.startRoadId === secondRoadVertex.roadId && c.endRoadId === firstRoadVertex.roadId);
    });

    if (!candidate) return;

    const startRoadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(candidate.startRoadId, candidate.startRoadCategory) as RoadItem;
    const endRoadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(candidate.endRoadId, candidate.endRoadCategory) as RoadItem;

    // refline
    const reflineCollection = this.scope.resolveConnectionRoadInitRefLineSerieCollection(
      startRoadItem,
      endRoadItem,
      candidate.startRoadVertexCategory,
      candidate.endRoadVertexCategory,
    );

    const r_seriePoints = reflineCollection.seriePoints;
    const r_serieTangents = reflineCollection.serieTangents;
    const r_serieNormals = reflineCollection.serieNormals;
    const r_catmullPoints = reflineCollection.catmullPoints;
    const r_catmullTangents = reflineCollection.catmullTangents;
    const r_altitudeCatmullPoints = reflineCollection.altitudeCatmullPoints;
    const r_altitudeCatmullTangents = reflineCollection.altitudeCatmullTangents;

    // resolve correlated lanes
    let correlatedLanesInStartRoadForLeftLanes = [] as LaneItem[];
    let correlatedLanesInEndRoadForLeftLanes = [] as LaneItem[];
    let correlatedLanesInStartRoadForRightLanes = [] as LaneItem[];
    let correlatedLanesInEndRoadForRightLanes = [] as LaneItem[];

    if (candidate.startRoadVertexCategory === JunctionVertexCategory.RoadStart && candidate.endRoadVertexCategory === JunctionVertexCategory.RoadStart) {
      correlatedLanesInStartRoadForLeftLanes = startRoadItem.laneItems.rightLanes;
      correlatedLanesInEndRoadForLeftLanes = endRoadItem.laneItems.leftLanes;
      correlatedLanesInStartRoadForRightLanes = startRoadItem.laneItems.leftLanes;
      correlatedLanesInEndRoadForRightLanes = endRoadItem.laneItems.rightLanes;
    } else if (
      (candidate.startRoadVertexCategory === JunctionVertexCategory.RoadStart && candidate.endRoadVertexCategory === JunctionVertexCategory.RoadEnd) ||
      (candidate.startRoadVertexCategory === JunctionVertexCategory.RoadEnd && candidate.endRoadVertexCategory === JunctionVertexCategory.RoadStart)
    ) {
      correlatedLanesInStartRoadForLeftLanes = startRoadItem.laneItems.leftLanes;
      correlatedLanesInEndRoadForLeftLanes = endRoadItem.laneItems.leftLanes;
      correlatedLanesInStartRoadForRightLanes = startRoadItem.laneItems.rightLanes;
      correlatedLanesInEndRoadForRightLanes = endRoadItem.laneItems.rightLanes;
    } else if (candidate.startRoadVertexCategory === JunctionVertexCategory.RoadEnd && candidate.endRoadVertexCategory === JunctionVertexCategory.RoadEnd) {
      correlatedLanesInStartRoadForLeftLanes = startRoadItem.laneItems.leftLanes;
      correlatedLanesInEndRoadForLeftLanes = endRoadItem.laneItems.rightLanes;
      correlatedLanesInStartRoadForRightLanes = startRoadItem.laneItems.rightLanes;
      correlatedLanesInEndRoadForRightLanes = endRoadItem.laneItems.leftLanes;
    }

    // left most outer
    let left_seriePoints = [] as Vector3[];
    let left_catmullPoints = [] as Vector3[];
    let left_catmullTangents = [] as Vector3[];
    let left_altitudeCatmullPoints = [] as Vector3[];
    let left_altitudeCatmullTangents = [] as Vector3[];

    if (correlatedLanesInStartRoadForLeftLanes.length > 0 && correlatedLanesInEndRoadForLeftLanes.length > 0) {
      const startRoadLanesCount = correlatedLanesInStartRoadForLeftLanes.length;
      const endRoadLanesCount = correlatedLanesInEndRoadForLeftLanes.length;
      const mostOuterIndex = Math.max(startRoadLanesCount, endRoadLanesCount) - 1;

      const startRoadLane = (mostOuterIndex < startRoadLanesCount) ? correlatedLanesInStartRoadForLeftLanes[mostOuterIndex] : correlatedLanesInStartRoadForLeftLanes[startRoadLanesCount - 1];
      const endRoadLane = (mostOuterIndex < endRoadLanesCount) ? correlatedLanesInEndRoadForLeftLanes[mostOuterIndex] : correlatedLanesInEndRoadForLeftLanes[endRoadLanesCount - 1];

      const rawStartCatmullPoint = endRoadLane.laneLines.outerLaneLine.catmullPoints[endRoadLane.laneLines.outerLaneLine.catmullPoints.length - 1];
      const rawEndCatmullPoint = startRoadLane.laneLines.outerLaneLine.catmullPoints[0];
      const outerLaneLineCatmullPoints_raw = [
        rawStartCatmullPoint,
        rawEndCatmullPoint,
      ];

      const outerLaneLineCatmullTangents_raw = [
        endRoadLane.laneLines.outerLaneLine.catmullTangents[endRoadLane.laneLines.outerLaneLine.catmullTangents.length - 1],
        startRoadLane.laneLines.outerLaneLine.catmullTangents[0],
      ];

      const outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
        outerLaneLineCatmullPoints_raw,
        outerLaneLineCatmullTangents_raw,
        r_seriePoints.length,
      );

      const rawStartAltitudeCatmullPoint = endRoadLane.laneLines.outerLaneLine.altitudeCatmullPoints[endRoadLane.laneLines.outerLaneLine.altitudeCatmullPoints.length - 1];
      const rawEndAltitudeCatmullPoint = startRoadLane.laneLines.outerLaneLine.altitudeCatmullPoints[0];
      const outerLaneLineAltitudeCatmullPoints = [
        new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawStartCatmullPoint, rawStartCatmullPoint), 0, rawStartAltitudeCatmullPoint.z),
        new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawEndCatmullPoint, rawStartCatmullPoint), 0, rawEndAltitudeCatmullPoint.z),
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

      
      left_seriePoints = [...outerLaneLineSeriePoints];
      left_catmullPoints = [...outerLaneLineCatmullPoints];
      left_catmullTangents = [...outerLaneLineCatmullTangents];
      left_altitudeCatmullPoints = [...outerLaneLineAltitudeCatmullPoints];
      left_altitudeCatmullTangents = [...outerLaneLineAltitudeCatmullTangents];
    }

    // right most outer
    let right_seriePoints = [] as Vector3[];
    let right_catmullPoints = [] as Vector3[];
    let right_catmullTangents = [] as Vector3[];
    let right_altitudeCatmullPoints = [] as Vector3[];
    let right_altitudeCatmullTangents = [] as Vector3[];

    if (correlatedLanesInStartRoadForRightLanes.length > 0 && correlatedLanesInEndRoadForRightLanes.length > 0) {
      const startRoadLanesCount = correlatedLanesInStartRoadForRightLanes.length;
      const endRoadLanesCount = correlatedLanesInEndRoadForRightLanes.length;
      const mostOuterIndex = Math.max(startRoadLanesCount, endRoadLanesCount) - 1;

      const startRoadLane = (mostOuterIndex < startRoadLanesCount) ? correlatedLanesInStartRoadForRightLanes[mostOuterIndex] : correlatedLanesInStartRoadForRightLanes[startRoadLanesCount - 1];
      const endRoadLane = (mostOuterIndex < endRoadLanesCount) ? correlatedLanesInEndRoadForRightLanes[mostOuterIndex] : correlatedLanesInEndRoadForRightLanes[endRoadLanesCount - 1];

      const rawStartCatmullPoint = startRoadLane.laneLines.outerLaneLine.catmullPoints[startRoadLane.laneLines.outerLaneLine.catmullPoints.length - 1];
      const rawEndCatmullPoint = endRoadLane.laneLines.outerLaneLine.catmullPoints[0];
      const outerLaneLineCatmullPoints_raw = [
        rawStartCatmullPoint,
        rawEndCatmullPoint,
      ];

      const outerLaneLineCatmullTangents_raw = [
        startRoadLane.laneLines.outerLaneLine.catmullTangents[startRoadLane.laneLines.outerLaneLine.catmullTangents.length - 1],
        endRoadLane.laneLines.outerLaneLine.catmullTangents[0],
      ];

      const outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
        outerLaneLineCatmullPoints_raw,
        outerLaneLineCatmullTangents_raw,
        r_seriePoints.length,
      );
      
      const rawStartAltitudeCatmullPoint = startRoadLane.laneLines.outerLaneLine.altitudeCatmullPoints[startRoadLane.laneLines.outerLaneLine.altitudeCatmullPoints.length - 1];
      const rawEndAltitudeCatmullPoint = endRoadLane.laneLines.outerLaneLine.altitudeCatmullPoints[0];
      const outerLaneLineAltitudeCatmullPoints = [
        new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawStartCatmullPoint, rawStartCatmullPoint), 0, rawStartAltitudeCatmullPoint.z),
        new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawEndCatmullPoint, rawStartCatmullPoint), 0, rawEndAltitudeCatmullPoint.z),
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

      
      right_seriePoints = [...outerLaneLineSeriePoints];
      right_catmullPoints = [...outerLaneLineCatmullPoints];
      right_catmullTangents = [...outerLaneLineCatmullTangents];
      right_altitudeCatmullPoints = [...outerLaneLineAltitudeCatmullPoints];
      right_altitudeCatmullTangents = [...outerLaneLineAltitudeCatmullTangents];
    }

    // impossible to be both empty
    if (left_seriePoints.length === 0 && right_seriePoints.length === 0) return;

    if (left_seriePoints.length > 0 && right_seriePoints.length === 0) {
      const isLeftLocked = (
        this.scope.isSerieStartPoint(firstRoadVertex.roadVertex, left_seriePoints) &&
        this.scope.isSerieEndPoint(secondRoadVertex.roadVertex, left_seriePoints)
      ) || (
        this.scope.isSerieStartPoint(secondRoadVertex.roadVertex, left_seriePoints) &&
        this.scope.isSerieEndPoint(firstRoadVertex.roadVertex, left_seriePoints)
      );

      if (isLeftLocked) {
        return {
          seriePoints: left_seriePoints,
          catmullPoints: left_catmullPoints,
          catmullTangents: left_catmullTangents,
          altitudeCatmullPoints: left_altitudeCatmullPoints,
          altitudeCatmullTangents: left_altitudeCatmullTangents,
        };
      } else {
        return {
          seriePoints: [...r_seriePoints].reverse(),
          catmullPoints: [...r_catmullPoints].reverse(),
          catmullTangents: [...r_catmullTangents].reverse(),
          altitudeCatmullPoints: [...r_altitudeCatmullPoints].reverse(),
          altitudeCatmullTangents: [...r_altitudeCatmullTangents].reverse(),
        };
      }
    }

    if (left_seriePoints.length === 0 && right_seriePoints.length > 0) {
      const isRightLocked = (
        this.scope.isSerieStartPoint(firstRoadVertex.roadVertex, right_seriePoints) &&
        this.scope.isSerieEndPoint(secondRoadVertex.roadVertex, right_seriePoints)
      ) || (
        this.scope.isSerieStartPoint(secondRoadVertex.roadVertex, right_seriePoints) &&
        this.scope.isSerieEndPoint(firstRoadVertex.roadVertex, right_seriePoints)
      );

      if (isRightLocked) {
        return {
          seriePoints: right_seriePoints,
          catmullPoints: right_catmullPoints,
          catmullTangents: right_catmullTangents,
          altitudeCatmullPoints: right_altitudeCatmullPoints,
          altitudeCatmullTangents: right_altitudeCatmullTangents,
        };
      } else {
        return {
          seriePoints: [...r_seriePoints],
          catmullPoints: [...r_catmullPoints],
          catmullTangents: [...r_catmullTangents],
          altitudeCatmullPoints: [...r_altitudeCatmullPoints],
          altitudeCatmullTangents: [...r_altitudeCatmullTangents],
        };
      }
    }

    const isLeftLocked = (
      this.scope.isSerieStartPoint(firstRoadVertex.roadVertex, left_seriePoints) &&
      this.scope.isSerieEndPoint(secondRoadVertex.roadVertex, left_seriePoints)
    ) || (
      this.scope.isSerieStartPoint(secondRoadVertex.roadVertex, left_seriePoints) &&
      this.scope.isSerieEndPoint(firstRoadVertex.roadVertex, left_seriePoints)
    );

    if (isLeftLocked) {
      return {
        seriePoints: left_seriePoints,
        catmullPoints: left_catmullPoints,
        catmullTangents: left_catmullTangents,
        altitudeCatmullPoints: left_altitudeCatmullPoints,
        altitudeCatmullTangents: left_altitudeCatmullTangents,
      };
    } else {
      return {
        seriePoints: right_seriePoints,
        catmullPoints: right_catmullPoints,
        catmullTangents: right_catmullTangents,
        altitudeCatmullPoints: right_altitudeCatmullPoints,
        altitudeCatmullTangents: right_altitudeCatmullTangents,
      };
    }
  }

  createInitJunctionMeshAndEdges() {
    const edges = [] as JunctionEdgeItem[];

    this.pickedOuterRoadsEdges.forEach((edge: JunctionEdge) => {
      const mostOuterLaneLineCollection = this.resolveMostOuterLaneLineForEdge(edge);
      if (!mostOuterLaneLineCollection) return;

      const seriePoints = mostOuterLaneLineCollection.seriePoints;
      const catmullPoints = mostOuterLaneLineCollection.catmullPoints;
      const catmullTangents = mostOuterLaneLineCollection.catmullTangents;
      const altitudeCatmullPoints = mostOuterLaneLineCollection.altitudeCatmullPoints;
      const altitudeCatmullTangents = mostOuterLaneLineCollection.altitudeCatmullTangents;

      const drawingPoints = [...seriePoints];
      const resolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(seriePoints);
      const serieTangents = resolved.serieTangents;
      const serieNormals = resolved.serieNormals;

      const edgeId = `${this.junctionId}_edge_${edge.roadIds[0]}_${edge.roadIds[1]}`;
      const edgeColor = RendererConfig.junction.solidLineColor;

      const edgeMesh = this.scope.createSolidLine({
        points: [...seriePoints],
        color: edgeColor,
        id: edgeId,
      });

      const junctionEdgeItem = {
        seriePoints,
        drawingPoints,
        serieNormals,
        serieTangents,
        catmullPoints,
        catmullTangents,
        altitudeCatmullPoints,
        altitudeCatmullTangents,
        edgeId,
        edgeMesh,
        options: {
          lineType: LineType.Solid,
          lineColor: edgeColor,
          lineId: edgeId,
        },
      } as JunctionEdgeItem;

      edgeMesh.metadata = {
        belongingJunctionEdgeItem: junctionEdgeItem
      };

      edges.push(junctionEdgeItem);
    });
    
    const junctionMesh = this.scope.generateJunctionMeshViaEdgesExtrusion(edges, this.junctionId);

    return {
      junctionMesh,
      edges,
    };
  }

  createJunction() {
    this.connections.forEach((c: ConnectionItem) => {
      this.createConnectionRoad(c);
    });

    const junctionMeshAndEdges = this.createInitJunctionMeshAndEdges();

    const junctionItem = {
      junctionId: this.junctionId,
      junctionPID: this.scope.generatePersistenceID() as string,
      junctionType: AtlasJunction.Type.CROSS_ROAD,
      allCandidateConnections: [...this.allCandidateConnections],
      involvedRoads: this.connections.map((c: ConnectionItem) => {
        const createdRoadItem = c.createdRoadItem as RoadItem;

        return {
          roadId: createdRoadItem.roadId,
          roadCategory: createdRoadItem.category,
          prevJunctionVertexCategory: c.startRoadVertexCategory,
          nextJunctionVertexCategory: c.endRoadVertexCategory,
        };
      }),
      edges: junctionMeshAndEdges.edges,
      junctionMesh: junctionMeshAndEdges.junctionMesh,
    } as JunctionItem;

    junctionItem.junctionMesh.metadata = {
      belongingJunctionItem: junctionItem,
    };

    this.createdJunctionItem = junctionItem;

    this.scope.emitEvent(StoreJunctionEvent, junctionItem);

    this.scope.emitEvent(StoreDirtyJunctionEvent, {
      junctionId: junctionItem.junctionId,
      junctionPID: junctionItem.junctionPID,
    });

    this.scope.emitEvent(InvokeCreateJunctionEvent, {
      junctionId: this.junctionId,
    });

    this.scope.makeSceneDirty();

    return junctionItem;
  }

  removeJunction() {
    const createdJunctionItem = this.createdJunctionItem as JunctionItem;

    this.connections.forEach((c: ConnectionItem) => {
      this.removeConnectionRoad(c);
    });
     
    this.scope.emitEvent(RemoveJunctionEvent, {
      id: createdJunctionItem.junctionId,
    });

    this.scope.emitEvent(StoreDirtyJunctionEvent, {
      junctionId: createdJunctionItem.junctionId,
      junctionPID: createdJunctionItem.junctionPID,
    });

    this.scope.emitEvent(InvokeRemoveJunctionEvent, {
      junctionId: this.junctionId,
    });
  }
};