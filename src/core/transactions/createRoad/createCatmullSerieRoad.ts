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
} from '../../plugins/statusManager/type';
import {
  StoreRoadEvent,
  RemoveRoadEvent,
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import { LineType } from '../../plugins/lineDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  AtlasRoad,
  AtlasLane,
  AtlasLaneBoundaryType,
} from '../../plugins/atlasConverter/type';
import {
  InvokeCreateCatmullSerieRoadEvent,
  InvokeRemoveCatmullSerieRoadEvent,
} from '../event';

export default class CreateCatmullSerieRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private meshId: string;
  private points: Vector3[];
  private pointsMesh: Mesh[];
  private referenceLineColor: Color3;
  private referenceLineType: LineType;
  private laneLineColor: Color3;
  private laneLineType: LineType;
  private laneWidth: number;

  private createdRoadItem?: RoadItem;

  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.meshId = (options as unknown as { id: string }).id;
    this.points = (options as unknown as { points: Vector3[] }).points;
    this.pointsMesh = (options as unknown as { pointsMesh: Mesh[] }).pointsMesh;
    this.referenceLineColor = (options as unknown as { referenceLineColor: Color3 }).referenceLineColor;
    this.referenceLineType = (options as unknown as { referenceLineType: LineType }).referenceLineType;
    this.laneLineColor = (options as unknown as { laneLineColor: Color3 }).laneLineColor;
    this.laneLineType = (options as unknown as { laneLineType: LineType }).laneLineType;
    this.laneWidth = (options as unknown as { laneWidth: LineType }).laneWidth;
  }

  commit() {
    super.commit();

    const entity = this.createRoad();
    return { entity };
  }

  onUndo() {
    super.onUndo();
    this.removeRoad();
  }

  onRedo() {
    super.onRedo();
    this.createRoad();
  }

  createReferenceLine() {
    const catmullA = this.points[0];
    const catmullB = this.points[1];

    const rawCatmullPoints = [catmullA, catmullB];
    const rawCatmullTangents = this.scope.generateHermiteSerieLineCatmullTangentsViaCatmullPoints(rawCatmullPoints);

    const rawSeriePoints = this.scope.generateHermiteSerieReflineSeriePointsViaCatmullPointsAndCatmullTangents(rawCatmullPoints, rawCatmullTangents);

    const altitudeCatmullA = new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(catmullA, catmullA), 0, catmullA.y);
    const altitudeCatmullB = new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(catmullB, catmullA), 0, catmullB.y);

    const altitudeCatmullPoints = [altitudeCatmullA, altitudeCatmullB];
    const altitudeCatmullTangents = this.scope.generateHermiteSerieLineAltitudeCatmullTangentsViaCatmullPoints(altitudeCatmullPoints);

    const applied = this.scope.applyAltitudeToHermiteSerieRefLineCatmullPointsAndSeriePoints(
      rawCatmullPoints,
      rawSeriePoints,
      altitudeCatmullPoints,
      altitudeCatmullTangents,
    );

    const catmullPoints = applied.appliedCatmullPoints;
    const seriePoints = applied.appliedSeriePoints;
    const catmullTangents = rawCatmullTangents;

    const lineId = `${this.meshId}_ReferenceLine`;
    const line = this.scope.createPureRefererenceLine({
      points: [...seriePoints],
      id: lineId,
    });

    const drawingPoints = [...seriePoints];
    const resolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(seriePoints);
    const serieTangents = resolved.serieTangents;
    const serieNormals = resolved.serieNormals;

    const referenceLineItem = {
      points: this.points,
      pointsMesh: this.pointsMesh,
      lineAndCurveMesh: line,
      markerDisposed: false,
      category: LineAndCurveCategory.TwoStraightLine,
      drawingPoints,
      seriePoints,
      serieNormals,
      serieTangents,
      options: {
        lineType: this.referenceLineType,
        lineColor: this.referenceLineColor,
        lineId,
      },
      catmullPoints,
      catmullTangents,
      altitudeCatmullPoints,
      altitudeCatmullTangents,
    } as ReferenceLineItem;

    this.scope.makeSceneDirty();

    return referenceLineItem;
  }

  createLaneLine(opts: {
    points: Vector3[];
    catmullPoints: Vector3[];
    catmullTangents: Vector3[];
    altitudeCatmullPoints: Vector3[];
    altitudeCatmullTangents: Vector3[];
    lineId: string;
    lineAndCurveCategory: LineAndCurveCategory;
    roadItem: RoadItem;
    laneSide: LaneSide;
    isLaneLine: boolean;
    laneLineSide: LaneLineSide;
  }) {
    const catmullPoints = [...opts.catmullPoints];
    const catmullTangents = [...opts.catmullTangents];

    const altitudeCatmullPoints = [...opts.altitudeCatmullPoints];
    const altitudeCatmullTangents = [...opts.altitudeCatmullTangents];

    const seriePoints = [...opts.points];

    const markerStart = this.scope.createMarker(seriePoints[0], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerStart.metadata = {
      markerSide: MarkerSide.Start,
    };

    const markerEnd = this.scope.createMarker(seriePoints[seriePoints.length - 1], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerEnd.metadata = {
      markerSide: MarkerSide.End,
    };

    const line = this.scope.drawLaneLineMesh({
      points: [...seriePoints],
      color: this.laneLineColor,
      id: opts.lineId,
      atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
      laneLineSide: opts.laneLineSide,
      laneSide: opts.laneSide
    });

    const drawingPoints = line.drawingPoints;
    const resolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(seriePoints);
    const serieTangents = resolved.serieTangents;
    const serieNormals = resolved.serieNormals;

    const laneLineItem = {
      points: [seriePoints[0], seriePoints[seriePoints.length - 1]],
      pointsMesh: [markerStart, markerEnd],
      lineAndCurveMesh: line.line,
      markerDisposed: true,
      category: opts.lineAndCurveCategory,
      drawingPoints,
      seriePoints,
      serieNormals,
      serieTangents,
      options: {
        lineType: this.laneLineType,
        lineColor: this.laneLineColor,
        lineId: opts.lineId,
      },
      laneLineSide: opts.laneLineSide,
      catmullPoints,
      catmullTangents,
      altitudeCatmullPoints,
      altitudeCatmullTangents,
      atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
      atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
    } as LaneLineItem;

    // update marker metadata, dispose finally
    laneLineItem.pointsMesh.forEach((m: Mesh) => {
      m.metadata.belongingLineAndCurveItem = laneLineItem;
      m.dispose();
    });

    this.scope.makeSceneDirty();

    return laneLineItem;
  }

  createLane(
    innerPoints: Vector3[],
    outerPoints: Vector3[],
    innerCatmullPoints: Vector3[],
    outerCatmullPoints: Vector3[],
    innerCatmullTangents: Vector3[],
    outerCatmullTangents: Vector3[],
    innerAltitudeCatmullPoints: Vector3[],
    outerAltitudeCatmullPoints: Vector3[],
    innerAltitudeCatmullTangents: Vector3[],
    outerAltitudeCatmullTangents: Vector3[],
    roadItem: RoadItem,
    laneSide: LaneSide,
  ) {
    const laneId = `${this.meshId}_0_${laneSide === LaneSide.Left ? roadItem.generalLeftLaneIndex : -roadItem.generalRightLaneIndex}`;

    const innerLaneLine = this.createLaneLine({
      points: [...innerPoints],
      catmullPoints: [...innerCatmullPoints],
      catmullTangents: [...innerCatmullTangents],
      altitudeCatmullPoints: [...innerAltitudeCatmullPoints],
      altitudeCatmullTangents: [...innerAltitudeCatmullTangents],
      lineId: `${laneId}_Inner_Line`,
      lineAndCurveCategory: LineAndCurveCategory.TwoStraightLine,
      roadItem,
      laneSide,
      isLaneLine: true,
      laneLineSide: LaneLineSide.Inner,
    });

    const outerLaneLine = this.createLaneLine({
      points: [...outerPoints],
      catmullPoints: [...outerCatmullPoints],
      catmullTangents: [...outerCatmullTangents],
      altitudeCatmullPoints: [...outerAltitudeCatmullPoints],
      altitudeCatmullTangents: [...outerAltitudeCatmullTangents],
      lineId: `${laneId}_Outer_Line`,
      lineAndCurveCategory: LineAndCurveCategory.TwoStraightLine,
      roadItem,
      laneSide,
      isLaneLine: true,
      laneLineSide: LaneLineSide.Outer,
    });

    const laneConnectorStart = this.createLaneLine({
      points: [innerPoints[0], outerPoints[0]],
      catmullPoints: [innerCatmullPoints[0], outerCatmullPoints[0]],
      catmullTangents: [innerCatmullTangents[0], outerCatmullTangents[0]],
      altitudeCatmullPoints: [innerAltitudeCatmullPoints[0], outerAltitudeCatmullPoints[0]],
      altitudeCatmullTangents: [innerAltitudeCatmullTangents[0], outerAltitudeCatmullTangents[0]],
      lineId: `${laneId}_ConnectorStart`,
      lineAndCurveCategory: LineAndCurveCategory.TwoStraightLine,
      roadItem,
      laneSide,
      isLaneLine: false,
      laneLineSide: LaneLineSide.ConnectorStart,
    });

    const laneConnectorEnd = this.createLaneLine({
      points: [innerPoints[innerPoints.length - 1], outerPoints[outerPoints.length - 1]],
      catmullPoints: [innerCatmullPoints[innerCatmullPoints.length - 1], outerCatmullPoints[outerCatmullPoints.length - 1]],
      catmullTangents: [innerCatmullTangents[innerCatmullTangents.length - 1], outerCatmullTangents[outerCatmullTangents.length - 1]],
      altitudeCatmullPoints: [innerAltitudeCatmullPoints[innerAltitudeCatmullPoints.length - 1], outerAltitudeCatmullPoints[outerAltitudeCatmullPoints.length - 1]],
      altitudeCatmullTangents: [innerAltitudeCatmullTangents[innerAltitudeCatmullTangents.length - 1], outerAltitudeCatmullTangents[outerAltitudeCatmullTangents.length - 1]],
      lineId: `${laneId}_ConnectorEnd`,
      lineAndCurveCategory: LineAndCurveCategory.TwoStraightLine,
      roadItem,
      laneSide,
      isLaneLine: false,
      laneLineSide: LaneLineSide.ConnectorEnd,
    });

    const laneLines = { innerLaneLine, outerLaneLine };
    const laneConnectors = { laneConnectorStart, laneConnectorEnd };

    const laneMeshId = `${laneId}__LaneMesh`;
    const laneMesh = this.scope.createRibbonLane({
      innerPoints: [...innerPoints],
      outerPoints: [...outerPoints],
      id: laneMeshId,
    });

    const laneDirectionId = `${laneId}_Direction_Sign`;
    const laneDirectionMeshs = this.scope.createLaneDirectionSign({
      innerPoints: [...innerPoints],
      outerPoints: [...outerPoints],
      id: laneDirectionId,
    });

    if (laneSide === LaneSide.Left) {
      roadItem.generalLeftLaneIndex++;
    } else {
      roadItem.generalRightLaneIndex++;
    }

    const laneItem = {
      laneLines,
      laneConnectors,
      laneMesh,
      laneDirectionMeshs,
      laneSide,
      laneId,
    };

    laneItem.laneMesh.metadata = {
      belongingRoadItem: roadItem,
      belongingLaneItem: laneItem,
    };

    innerLaneLine.lineAndCurveMesh.forEach((m: Mesh) => {
      m.metadata = {
        lineAndCurveItem: innerLaneLine,
        belongingLaneItem: laneItem,
        belongingRoadItem: roadItem,
      }
    })

    outerLaneLine.lineAndCurveMesh.forEach((m: Mesh) => {
      m.metadata = {
        lineAndCurveItem: outerLaneLine,
        belongingLaneItem: laneItem,
        belongingRoadItem: roadItem,
      };
    })

    laneConnectorStart.lineAndCurveMesh.forEach((m: Mesh) => {
      m.metadata = {
        lineAndCurveItem: laneConnectorStart,
        belongingLaneItem: laneItem,
        belongingRoadItem: roadItem,
      };
    })

    laneConnectorEnd.lineAndCurveMesh.forEach((m: Mesh) => {
      m.metadata = {
        lineAndCurveItem: laneConnectorEnd,
        belongingLaneItem: laneItem,
        belongingRoadItem: roadItem,
      };
    })

    return laneItem;
  }

  createLanes(roadItem: RoadItem, referenceLine: ReferenceLineItem) {
    const refLineSeriePoints = referenceLine.seriePoints;
    const refLineSerieNormals = referenceLine.serieNormals;
    const refLineCatmullPoints = referenceLine.catmullPoints;
    const refLineCatmullTangents = referenceLine.catmullTangents;
    const refLineCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(refLineSeriePoints, refLineCatmullPoints);

    const refLineAltitudeCatmullPoints = [...referenceLine.altitudeCatmullPoints];
    const refLineAltitudeCatmullTangents = [...referenceLine.altitudeCatmullTangents];

    // left inner
    const leftInnerAltitudeCatmullPoints = [...refLineAltitudeCatmullPoints].reverse();
    const leftInnerAltitudeCatmullTangents = [...refLineAltitudeCatmullTangents].reverse().map((v: Vector3) => {
      return v.multiplyByFloats(-1, -1, -1);
    });

    const leftInnerCatmullPoints_raw = [...refLineCatmullPoints].reverse();
    const leftInnerCatmullTangents_raw = [...refLineCatmullTangents].map((tan: Vector3) => {
      return tan.normalize().multiplyByFloats(-1, -1, -1);
    }).reverse();

    const leftInnerSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(leftInnerCatmullPoints_raw, leftInnerCatmullTangents_raw, refLineSeriePoints.length);

    const appliedLeftInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
      leftInnerCatmullPoints_raw,
      leftInnerSeriePoints_raw,
      leftInnerAltitudeCatmullPoints,
      leftInnerAltitudeCatmullTangents,
    );

    const leftInnerCatmullPoints = appliedLeftInner.appliedCatmullPoints;
    const leftInnerSeriePoints = [...refLineSeriePoints].reverse();
    const leftInnerCatmullTangents = leftInnerCatmullTangents_raw;

    // left outer
    const leftOuterAltitudeCatmullPoints = [...refLineAltitudeCatmullPoints].reverse();
    const leftOuterAltitudeCatmullTangents = [...refLineAltitudeCatmullTangents].reverse().map((v: Vector3) => {
      return v.multiplyByFloats(-1, -1, -1);
    });

    const leftOuterCatmullPoints_raw = refLineCatmullPoints.map((v: Vector3, idx: number) => {
      return v.add(refLineSerieNormals[refLineCatmullIndices[idx]].multiplyByFloats(-this.laneWidth, -this.laneWidth, -this.laneWidth));
    }).reverse();
    const leftOuterCatmullTangents_raw = [...refLineCatmullTangents].map((tan: Vector3) => {
      return tan.normalize().multiplyByFloats(-1, -1, -1);
    }).reverse();

    const leftOuterSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(leftOuterCatmullPoints_raw, leftOuterCatmullTangents_raw, refLineSeriePoints.length);

    const appliedLeftOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
      leftOuterCatmullPoints_raw,
      leftOuterSeriePoints_raw,
      leftOuterAltitudeCatmullPoints,
      leftOuterAltitudeCatmullTangents,
    );

    const leftOuterCatmullPoints = appliedLeftOuter.appliedCatmullPoints;
    const leftOuterSeriePoints = appliedLeftOuter.appliedSeriePoints;
    const leftOuterCatmullTangents = leftOuterCatmullTangents_raw;

    // right inner
    const rightInnerAltitudeCatmullPoints = [...refLineAltitudeCatmullPoints];
    const rightInnerAltitudeCatmullTangents = [...refLineAltitudeCatmullTangents];

    const rightInnerCatmullPoints_raw = [...refLineCatmullPoints];
    const rightInnerCatmullTangents_raw = [...refLineCatmullTangents].map((tan: Vector3) => {
      return tan.normalize();
    });

    const rightInnerSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(rightInnerCatmullPoints_raw, rightInnerCatmullTangents_raw, refLineSeriePoints.length);

    const appliedRightInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
      rightInnerCatmullPoints_raw,
      rightInnerSeriePoints_raw,
      rightInnerAltitudeCatmullPoints,
      rightInnerAltitudeCatmullTangents,
    );

    const rightInnerCatmullPoints = appliedRightInner.appliedCatmullPoints;
    const rightInnerSeriePoints = [...refLineSeriePoints];
    const rightInnerCatmullTangents = rightInnerCatmullTangents_raw;

    // right outer
    const rightOuterAltitudeCatmullPoints = [...refLineAltitudeCatmullPoints];
    const rightOuterAltitudeCatmullTangents = [...refLineAltitudeCatmullTangents];

    const rightOuterCatmullPoints_raw = refLineCatmullPoints.map((v: Vector3, idx: number) => {
      return v.add(refLineSerieNormals[refLineCatmullIndices[idx]].multiplyByFloats(this.laneWidth, this.laneWidth, this.laneWidth));
    });
    const rightOuterCatmullTangents_raw = [...refLineCatmullTangents].map((tan: Vector3) => {
      return tan.normalize();
    });

    const rightOuterSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(rightOuterCatmullPoints_raw, rightOuterCatmullTangents_raw, refLineSeriePoints.length);

    const appliedRightOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
      rightOuterCatmullPoints_raw,
      rightOuterSeriePoints_raw,
      rightOuterAltitudeCatmullPoints,
      rightOuterAltitudeCatmullTangents,
    );

    const rightOuterCatmullPoints = appliedRightOuter.appliedCatmullPoints;
    const rightOuterSeriePoints = appliedRightOuter.appliedSeriePoints;
    const rightOuterCatmullTangents = rightOuterCatmullTangents_raw;


    const laneleft = this.createLane(
      leftInnerSeriePoints,
      leftOuterSeriePoints,
      leftInnerCatmullPoints,
      leftOuterCatmullPoints,
      leftInnerCatmullTangents,
      leftOuterCatmullTangents,
      leftInnerAltitudeCatmullPoints,
      leftOuterAltitudeCatmullPoints,
      leftInnerAltitudeCatmullTangents,
      leftOuterAltitudeCatmullTangents,
      roadItem,
      LaneSide.Left,
    );

    const laneRight = this.createLane(
      rightInnerSeriePoints,
      rightOuterSeriePoints,
      rightInnerCatmullPoints,
      rightOuterCatmullPoints,
      rightInnerCatmullTangents,
      rightOuterCatmullTangents,
      rightInnerAltitudeCatmullPoints,
      rightOuterAltitudeCatmullPoints,
      rightInnerAltitudeCatmullTangents,
      rightOuterAltitudeCatmullTangents,
      roadItem,
      LaneSide.Right,
    );

    return {
      leftLanes: [{
        ...laneleft,
        laneWidthEditable: true,
        atlasLaneSpeedLimit: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneSpeedLimit,
        atlasLaneType: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneType,
        atlasLaneTurn: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneTurn,
        atlasLaneDirection: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneDirection,
        prevLanes: [],
        nextLanes: [],
      }],
      rightLanes: [{
        ...laneRight,
        laneWidthEditable: true,
        atlasLaneSpeedLimit: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneSpeedLimit,
        atlasLaneType: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneType,
        atlasLaneTurn: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneTurn,
        atlasLaneDirection: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneDirection,
        prevLanes: [],
        nextLanes: [],
      }],
    };
  }

  createRoad() {
    const referenceLine = this.createReferenceLine();

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
      category: RoadCategory.CatmullSerieRoad,
      roadId: this.meshId,
      roadPID: this.scope.generatePersistenceID() as string,
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      atlasRoadType: AtlasRoad.Type.CITY_ROAD,
      matAlpha: RendererConfig.scene.defaultRoadMatAlpha,
      prevRoads: [],
      nextRoads: [],
      junctionId: undefined,
    } as RoadItem;

    // attach info to reference line mesh
    referenceLine.lineAndCurveMesh.metadata = {
      lineAndCurveItem: referenceLine,
      belongingRoadItem: roadItem,
    };

    roadItem.laneItems = this.createLanes(roadItem, referenceLine);

    this.createdRoadItem = roadItem;

    this.scope.emitEvent(StoreRoadEvent, roadItem);

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.makeSceneDirty();

    this.scope.emitEvent(InvokeCreateCatmullSerieRoadEvent, {
      roadId: this.meshId,
    });

    return roadItem;
  }

  removeRoad() {
    const createdRoadItem = this.createdRoadItem as RoadItem;

    this.scope.emitEvent(RemoveRoadEvent, {
      id: createdRoadItem.roadId,
      category: createdRoadItem.category,
    });

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: createdRoadItem.roadPID,
      roadId: createdRoadItem.roadId,
      roadCategory: createdRoadItem.category,
    });

    this.scope.emitEvent(InvokeRemoveCatmullSerieRoadEvent, {
      roadId: this.meshId,
    });
  }
};