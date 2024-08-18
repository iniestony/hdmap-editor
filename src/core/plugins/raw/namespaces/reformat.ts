import {
  Mesh,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  LinesMesh,
  Color4,
  Curve3,
} from "@babylonjs/core";
import earcut from "earcut";
import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../../core/renderer/config';
import {
  RoadItem,
  LineAndCurveItem,
  LineAndCurveCategory,
  LaneLineSide,
  LaneSide,
  LaneItem,
  LaneLineItem,
  ReferenceLineItem,
  LaneLineItemKeyInfo,
  LaneItemKeyInfo,
  RoadItemKeyInfo,
} from '../../statusManager/type';

export function createPlaceholderReferenceLine(
  this: ExtendedNamespace,
  roadItemKeyInfo: RoadItemKeyInfo,
) {
  const seriePoints = roadItemKeyInfo.referenceLine.seriePoints;
  const reflineKeyPoints = [seriePoints[0], seriePoints[seriePoints.length - 1]];

  const keyPointsMeshes = reflineKeyPoints.map((p: Vector3) => {
    const m = this.createMarker(p, RendererConfig.mesh.reflineMarkerColor) as Mesh;
    m.dispose();
    return m;
  });

  const line = this.createPureRefererenceLine({
    points: [...seriePoints],
    id: roadItemKeyInfo.referenceLine.options.lineId,
  });

  const drawingPoints = [...seriePoints];

  const serieTangents = roadItemKeyInfo.referenceLine.serieTangents;
  const serieNormals = roadItemKeyInfo.referenceLine.serieNormals;
  const catmullPoints = [...roadItemKeyInfo.referenceLine.catmullPoints];
  const catmullTangents = [...roadItemKeyInfo.referenceLine.catmullTangents];
  const altitudeCatmullPoints = [...roadItemKeyInfo.referenceLine.altitudeCatmullPoints];
  const altitudeCatmullTangents = [...roadItemKeyInfo.referenceLine.altitudeCatmullTangents];

  const placeholderRefLine = {
    points: [...reflineKeyPoints],
    pointsMesh: [...keyPointsMeshes],
    lineAndCurveMesh: line,
    markerDisposed: true,
    category: roadItemKeyInfo.referenceLine.category,
    drawingPoints,
    seriePoints,
    serieNormals,
    serieTangents,
    options: {
      lineType: roadItemKeyInfo.referenceLine.options.lineType,
      lineColor: roadItemKeyInfo.referenceLine.options.lineColor,
      lineId: roadItemKeyInfo.referenceLine.options.lineId,
    },
    catmullPoints,
    catmullTangents,
    altitudeCatmullPoints,
    altitudeCatmullTangents,
  } as ReferenceLineItem;

  return placeholderRefLine;
};

export function resolveLaneConnectorPointsAndPointsMeshBySeriePoints(
  this: ExtendedNamespace,
  seriePoints: Vector3[],
) {
  const first = 0;
  const last = seriePoints.length - 1;

  const markerStart = this.createMarker(seriePoints[first], RendererConfig.mesh.reflineMarkerColor) as Mesh;
  markerStart.dispose();

  const markerEnd = this.createMarker(seriePoints[last], RendererConfig.mesh.reflineMarkerColor) as Mesh;
  markerEnd.dispose();

  return {
    points: [seriePoints[first], seriePoints[last]],
    pointsMesh: [markerStart, markerEnd],
  };
};

export function resolveLaneLinePointsAndPointsMeshBySeriePoints(
  this: ExtendedNamespace,
  seriePoints: Vector3[],
  lineCategory: LineAndCurveCategory,
) {
  const first = 0;
  const last = seriePoints.length - 1;

  if (lineCategory === LineAndCurveCategory.TwoStraightLine) {
    const markerStart = this.createMarker(seriePoints[first], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerStart.dispose();

    const markerEnd = this.createMarker(seriePoints[last], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerEnd.dispose();

    return {
      points: [seriePoints[first], seriePoints[last]],
      pointsMesh: [markerStart, markerEnd],
    };
  } else if (lineCategory === LineAndCurveCategory.ThreeCircleCurve) {
    const half = Math.floor(seriePoints.length / 2);

    const markerStart = this.createMarker(seriePoints[first], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerStart.dispose();

    const markerMiddle = this.createMarker(seriePoints[half], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerMiddle.dispose();

    const markerEnd = this.createMarker(seriePoints[last], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerEnd.dispose();

    return {
      points: [seriePoints[first], seriePoints[half], seriePoints[last]],
      pointsMesh: [markerStart, markerMiddle, markerEnd],
    };
  } else if (lineCategory === LineAndCurveCategory.QuadraticBezierCurve) {
    const control = Math.floor(seriePoints.length / 2);

    const markerStart = this.createMarker(seriePoints[first], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerStart.dispose();

    const markerEnd = this.createMarker(seriePoints[last], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerEnd.dispose();

    const markerControl = this.createMarker(seriePoints[control], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerControl.dispose();

    return {
      points: [seriePoints[first], seriePoints[last], seriePoints[control]],
      pointsMesh: [markerStart, markerEnd, markerControl],
    };
  } else if (lineCategory === LineAndCurveCategory.CubicBezierCurve) {
    const control = Math.floor(seriePoints.length / 2);

    const markerStart = this.createMarker(seriePoints[first], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerStart.dispose();

    const markerEnd = this.createMarker(seriePoints[last], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerEnd.dispose();

    const markerControl = this.createMarker(seriePoints[control], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerControl.dispose();

    return {
      points: [seriePoints[first], seriePoints[last], seriePoints[control]],
      pointsMesh: [markerStart, markerEnd, markerControl],
    };
  }

  return {
    points: [],
    pointsMesh: [],
  };
};

export function reformatRoadLaneLineAndLaneConnector(
  this: ExtendedNamespace,
  laneLineItemKeyInfo: LaneLineItemKeyInfo,
  isLaneLine: boolean,
  laneSide: LaneSide,
  roadItem: RoadItem,
) {
  const seriePoints = laneLineItemKeyInfo.seriePoints;
  const lineCatgory = laneLineItemKeyInfo.category;
  const laneLineSide = laneLineItemKeyInfo.laneLineSide;
  const lineColor = laneLineItemKeyInfo.options.lineColor;
  const lineId = laneLineItemKeyInfo.options.lineId;
  const lineType = laneLineItemKeyInfo.options.lineType;
  const catmullPoints = laneLineItemKeyInfo.catmullPoints;
  const catmullTangents = laneLineItemKeyInfo.catmullTangents;
  const altitudeCatmullPoints = laneLineItemKeyInfo.altitudeCatmullPoints;
  const altitudeCatmullTangents = laneLineItemKeyInfo.altitudeCatmullTangents;

  let pointsAndPointsMesh = {
    points: [],
    pointsMesh: [],
  } as {
    points: Vector3[],
    pointsMesh: Mesh[],
  };

  if (isLaneLine) {
    pointsAndPointsMesh = this.resolveLaneLinePointsAndPointsMeshBySeriePoints(
      seriePoints,
      lineCatgory,
    ) as {
      points: Vector3[],
      pointsMesh: Mesh[],
    };
  } else {
    pointsAndPointsMesh = this.resolveLaneConnectorPointsAndPointsMeshBySeriePoints(
      seriePoints,
    ) as {
      points: Vector3[],
      pointsMesh: Mesh[],
    };
  }

  const line = this.drawLaneLineMesh({
    points: [...seriePoints],
    color: lineColor,
    id: lineId,
    atlasLaneBoundaryType: laneLineItemKeyInfo.atlasLaneBoundaryType,
    laneLineSide: laneLineSide,
    laneSide: laneSide
  });

  const drawingPoints = line.drawingPoints;

  const resolved = this.calculateNormalsAndTangentsOfCurveSeriePoints(seriePoints);
  const serieTangents = resolved.serieTangents;
  const serieNormals = resolved.serieNormals;

  const laneLineItem = {
    points: pointsAndPointsMesh.points,
    pointsMesh: pointsAndPointsMesh.pointsMesh,
    lineAndCurveMesh: line.line,
    markerDisposed: true,
    category: lineCatgory,
    drawingPoints,
    seriePoints,
    serieNormals,
    serieTangents,
    options: {
      lineType: lineType,
      lineColor: lineColor,
      lineId: lineId,
    },
    laneLineSide,
    catmullPoints,
    catmullTangents,
    altitudeCatmullPoints,
    altitudeCatmullTangents,
    atlasLaneBoundaryVirtual: laneLineItemKeyInfo.atlasLaneBoundaryVirtual,
    atlasLaneBoundaryType: laneLineItemKeyInfo.atlasLaneBoundaryType,
  } as LaneLineItem;

  this.makeSceneDirty();

  return laneLineItem;
};

export function reformatRoadLane(
  this: ExtendedNamespace,
  laneItemKeyInfo: LaneItemKeyInfo,
  laneSide: LaneSide,
  roadItem: RoadItem,
) {
  const innerLaneLineItemKeyInfo = laneItemKeyInfo.laneLines.innerLaneLine;
  const outerLaneLineItemKeyInfo = laneItemKeyInfo.laneLines.outerLaneLine;
  const laneConnectorStartItemKeyInfo = laneItemKeyInfo.laneConnectors.laneConnectorStart;
  const laneConnectorEndItemKeyInfo = laneItemKeyInfo.laneConnectors.laneConnectorEnd;

  const innerLaneLine = this.reformatRoadLaneLineAndLaneConnector(
    innerLaneLineItemKeyInfo,
    true,
    laneSide,
    roadItem,
  );

  const outerLaneLine = this.reformatRoadLaneLineAndLaneConnector(
    outerLaneLineItemKeyInfo,
    true,
    laneSide,
    roadItem,
  );

  const laneConnectorStart = this.reformatRoadLaneLineAndLaneConnector(
    laneConnectorStartItemKeyInfo,
    false,
    laneSide,
    roadItem,
  );

  const laneConnectorEnd = this.reformatRoadLaneLineAndLaneConnector(
    laneConnectorEndItemKeyInfo,
    false,
    laneSide,
    roadItem,
  );

  const laneLines = { innerLaneLine, outerLaneLine };
  const laneConnectors = { laneConnectorStart, laneConnectorEnd };

  // lane mesh
  const innerPoints = innerLaneLineItemKeyInfo.seriePoints;
  const outerPoints = outerLaneLineItemKeyInfo.seriePoints;

  const laneMesh = this.createRibbonLane({
    innerPoints: [...innerPoints],
    outerPoints: [...outerPoints],
    id: `${laneItemKeyInfo.laneId}__LaneMesh`,
  });

  const laneDirectionId = `${laneItemKeyInfo.laneId}_Direction_Sign`;
  const laneDirectionMeshs = this.createLaneDirectionSign({
    innerPoints: [...innerPoints],
    outerPoints: [...outerPoints],
    id: laneDirectionId,
  });

  const laneItem = {
    laneLines,
    laneConnectors,
    laneMesh,
    laneDirectionMeshs,
    laneSide,
    laneId: laneItemKeyInfo.laneId,
    laneWidthEditable: laneItemKeyInfo.laneWidthEditable,
    atlasLaneSpeedLimit: laneItemKeyInfo.atlasLaneSpeedLimit,
    atlasLaneType: laneItemKeyInfo.atlasLaneType,
    atlasLaneTurn: laneItemKeyInfo.atlasLaneTurn,
    atlasLaneDirection: laneItemKeyInfo.atlasLaneDirection,
    prevLanes: [...laneItemKeyInfo.prevLanes],
    nextLanes: [...laneItemKeyInfo.nextLanes],
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
    };
  });

  outerLaneLine.lineAndCurveMesh.forEach((m: Mesh) => {
    m.metadata = {
      lineAndCurveItem: outerLaneLine,
      belongingLaneItem: laneItem,
      belongingRoadItem: roadItem,
    };
  });

  laneConnectorStart.lineAndCurveMesh.forEach((m: Mesh) => {
    m.metadata = {
      lineAndCurveItem: laneConnectorStart,
      belongingLaneItem: laneItem,
      belongingRoadItem: roadItem,
    };
  });

  laneConnectorEnd.lineAndCurveMesh.forEach((m: Mesh) => {
    m.metadata = {
      lineAndCurveItem: laneConnectorEnd,
      belongingLaneItem: laneItem,
      belongingRoadItem: roadItem,
    };
  });

  return laneItem;
};


// inline functionality
export function inlineReformatRoadReferenceLine(
  this: ExtendedNamespace,
  roadItemKeyInfo: RoadItemKeyInfo,
  roadItem: RoadItem,
  reflineKeyPoints: Vector3[],
) {
  const keyPointsMeshes = reflineKeyPoints.map((p: Vector3) => {
    const m = this.createMarker(p, RendererConfig.mesh.reflineMarkerColor) as Mesh;
    m.dispose();
    return m;
  });

  const seriePoints = roadItemKeyInfo.referenceLine.seriePoints;

  const line = this.createPureRefererenceLine({
    points: [...seriePoints],
    id: roadItemKeyInfo.referenceLine.options.lineId,
  });

  const drawingPoints = [...seriePoints];

  const serieTangents = roadItemKeyInfo.referenceLine.serieTangents;
  const serieNormals = roadItemKeyInfo.referenceLine.serieNormals;
  const catmullPoints = [...roadItemKeyInfo.referenceLine.catmullPoints];
  const catmullTangents = [...roadItemKeyInfo.referenceLine.catmullTangents];
  const altitudeCatmullPoints = [...roadItemKeyInfo.referenceLine.altitudeCatmullPoints];
  const altitudeCatmullTangents = [...roadItemKeyInfo.referenceLine.altitudeCatmullTangents];

  const newRefline = {
    points: [...reflineKeyPoints],
    pointsMesh: [...keyPointsMeshes],
    lineAndCurveMesh: line,
    markerDisposed: true,
    category: roadItemKeyInfo.referenceLine.category,
    drawingPoints,
    seriePoints,
    serieNormals,
    serieTangents,
    options: {
      lineType: roadItemKeyInfo.referenceLine.options.lineType,
      lineColor: roadItemKeyInfo.referenceLine.options.lineColor,
      lineId: roadItemKeyInfo.referenceLine.options.lineId,
    },
    catmullPoints,
    catmullTangents,
    altitudeCatmullPoints,
    altitudeCatmullTangents,
  } as ReferenceLineItem;

  // attach info to reference line mesh
  newRefline.lineAndCurveMesh.metadata = {
    lineAndCurveItem: newRefline,
    belongingRoadItem: roadItem,
  };

  // dispose old
  const oldReflineMesh = roadItem.referenceLine.lineAndCurveMesh;
  oldReflineMesh.dispose();

  this.makeSceneDirty();

  // inline new
  roadItem.referenceLine = newRefline;
  roadItem.referenceLineEditable = roadItemKeyInfo.referenceLineEditable;

  roadItem.startPointNormal = serieNormals[0];
  roadItem.endPointNormal = serieNormals[serieNormals.length - 1];
  roadItem.startPointTangent = serieTangents[0];
  roadItem.endPointTangent = serieTangents[serieTangents.length - 1];
};

export function inlineReformatRoadSurfaceLines(
  this: ExtendedNamespace,
  roadItemKeyInfo: RoadItemKeyInfo,
  roadItem: RoadItem,
  reflineKeyPoints: Vector3[],
) {

};

export function inlineReformatRoadLeftAndRightLanes(
  this: ExtendedNamespace,
  roadItemKeyInfo: RoadItemKeyInfo,
  roadItem: RoadItem,
) {
  const leftLanes = roadItemKeyInfo.laneItems.leftLanes.map((laneItemKeyInfo: LaneItemKeyInfo) => {
    return this.reformatRoadLane(
      laneItemKeyInfo,
      LaneSide.Left,
      roadItem,
    );
  });

  const rightLanes = roadItemKeyInfo.laneItems.rightLanes.map((laneItemKeyInfo: LaneItemKeyInfo) => {
    return this.reformatRoadLane(
      laneItemKeyInfo,
      LaneSide.Right,
      roadItem,
    );
  });

  // dispose old
  const allLaneItems = roadItem.laneItems.leftLanes.concat(roadItem.laneItems.rightLanes);
  allLaneItems.forEach((laneItem: LaneItem) => {
    laneItem.laneMesh.dispose();
    laneItem.laneDirectionMeshs.forEach((m: Mesh) => {
      m.dispose();
    });


    laneItem.laneLines.innerLaneLine.lineAndCurveMesh.forEach((m: Mesh) => {
      m.dispose();
    })

    laneItem.laneLines.innerLaneLine.pointsMesh.forEach((m: Mesh) => {
      m.dispose();
    });

    laneItem.laneLines.outerLaneLine.lineAndCurveMesh.forEach((m: Mesh) => {
      m.dispose();
    })

    laneItem.laneLines.outerLaneLine.pointsMesh.forEach((m: Mesh) => {
      m.dispose();
    });

    laneItem.laneConnectors.laneConnectorStart.lineAndCurveMesh.forEach((m: Mesh) => {
      m.dispose();
    })

    laneItem.laneConnectors.laneConnectorStart.pointsMesh.forEach((m: Mesh) => {
      m.dispose();
    });

    laneItem.laneConnectors.laneConnectorEnd.lineAndCurveMesh.forEach((m: Mesh) => {
      m.dispose();
    })

    laneItem.laneConnectors.laneConnectorEnd.pointsMesh.forEach((m: Mesh) => {
      m.dispose();
    });
  });

  // inline new
  roadItem.laneItems = { leftLanes, rightLanes };
};

