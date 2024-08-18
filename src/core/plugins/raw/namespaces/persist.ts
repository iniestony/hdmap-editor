import {
  Vector3,
  Color3,
  LinesMesh,
  Mesh,
} from "@babylonjs/core";
import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../../core/renderer/config';
import {
  RoadItem,
  LineAndCurveItem,
  ReferenceLineItem,
  LaneLineItem,
  LaneLineSide,
  LaneSide,
  LaneItem,
  LineAndCurveItemKeyInfo,
  ReferenceLineItemKeyInfo,
  LaneLineItemKeyInfo,
  LaneItemKeyInfo,
  RoadItemKeyInfo,
  RoadCategory,
  JunctionEdgeItemKeyInfo,
  JunctionItem,
  JunctionItemKeyInfo,
} from '../../statusManager/type';
import {
  StoreRoadEvent,
  ReformatRoadEvent,
  StoreJunctionEvent,
} from '../../statusManager/constant';
import {
  PersistDirtyHDMapEvent,
} from '../../persistenceAdaptor/constant';
import {
  JunctionVertexCategory,
} from "../../junctionDrawer/type";

export function performPersistAllDirtyItems(this: ExtendedNamespace) {
  this.emitEvent(PersistDirtyHDMapEvent);
};

export async function persistPlusRoad(
  this: ExtendedNamespace,
  roadItem: RoadItem,
  hdMapId: string,
) {
  const roadItemKeyInfo = this.resolveRoadItemKeyInfo(roadItem) as RoadItemKeyInfo;
  // add roads
};

export async function persistMinusRoad(
  this: ExtendedNamespace,
  roadPID: string,
  hdMapId: string,
) {
  // delete roads
};

export async function persistPlusJunction(
  this: ExtendedNamespace,
  junctionItem: JunctionItem,
  hdMapId: string,
) {
  // add junctions
  const junctionItemKeyInfo = this.resolveJunctionItemKeyInfo(junctionItem) as JunctionItemKeyInfo;
};

export async function persistMinusJunction(
  this: ExtendedNamespace,
  junctionPID: string,
  hdMapId: string,
) {
  // delete junctions
};

export async function loadHDMap(
  this: ExtendedNamespace,
  hdMapId: string,
) {
  const response = await fetch(`hdmap_${hdMapId}.json`);
  const hdmapData = await response.json();

  if (hdmapData) {
    const roads = (hdmapData.roads || []).map((raw: unknown) => {
      return this.alignPersistRoadItemKeyInfo(raw as unknown as RoadItemKeyInfo) as RoadItemKeyInfo;
    });

    roads.forEach((roadItemKeyInfo: RoadItemKeyInfo) => {
      this.persistLoadRoad(roadItemKeyInfo);
    });

    const junctions = (hdmapData.junctions || []).map((raw: unknown) => {
      return this.alignPersistJunctionItemKeyInfo(raw as unknown as JunctionItemKeyInfo) as JunctionItemKeyInfo;
    });

    junctions.forEach((junctionItemKeyInfo: JunctionItemKeyInfo) => {
      this.persistLoadJunction(junctionItemKeyInfo);
    });
  }
};

export function alignPersistVector3(
  this: ExtendedNamespace,
  rawVector: Vector3,
) {
  return new Vector3(rawVector._x, rawVector._y, rawVector._z);
};

export function alignPersistReferenceLineItemKeyInfo(
  this: ExtendedNamespace,
  rawRefLine: ReferenceLineItemKeyInfo,
) {
  const rawLineColor = rawRefLine.options.lineColor;

  const referenceLine = {
    points: rawRefLine.points ? rawRefLine.points.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    seriePoints: rawRefLine.seriePoints ? rawRefLine.seriePoints.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    serieNormals: rawRefLine.serieNormals ? rawRefLine.serieNormals.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    serieTangents: rawRefLine.serieTangents ? rawRefLine.serieTangents.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    category: rawRefLine.category,
    options: {
      lineType: rawRefLine.options.lineType,
      lineColor: new Color3(rawLineColor.r, rawLineColor.g, rawLineColor.b),
      lineId: rawRefLine.options.lineId,
      dashAlignType: rawRefLine.options.dashAlignType,
      straightDashLength: rawRefLine.options.straightDashLength,
      straightDashSize: rawRefLine.options.straightDashSize,
      straightGapSize: rawRefLine.options.straightGapSize,
      curveDashLength: rawRefLine.options.curveDashLength,
      curveDashSize: rawRefLine.options.curveDashSize,
      curveGapSize: rawRefLine.options.curveGapSize,
    },
    catmullPoints: rawRefLine.catmullPoints ? rawRefLine.catmullPoints.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    catmullTangents: rawRefLine.catmullTangents ? rawRefLine.catmullTangents.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    altitudeCatmullPoints: rawRefLine.altitudeCatmullPoints ? rawRefLine.altitudeCatmullPoints.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    altitudeCatmullTangents: rawRefLine.altitudeCatmullTangents ? rawRefLine.altitudeCatmullTangents.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
  } as ReferenceLineItemKeyInfo;

  return referenceLine;
};

export function alignPersistLineAndCurveItemKeyInfo(
  this: ExtendedNamespace,
  rawLineAndCurveItem: LineAndCurveItemKeyInfo,
) {
  const rawLineColor = rawLineAndCurveItem.options.lineColor;

  const lineAndCurve = {
    seriePoints: rawLineAndCurveItem.seriePoints ? rawLineAndCurveItem.seriePoints.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    category: rawLineAndCurveItem.category,
    options: {
      lineType: rawLineAndCurveItem.options.lineType,
      lineColor: new Color3(rawLineColor.r, rawLineColor.g, rawLineColor.b),
      lineId: rawLineAndCurveItem.options.lineId,
      dashAlignType: rawLineAndCurveItem.options.dashAlignType,
      straightDashLength: rawLineAndCurveItem.options.straightDashLength,
      straightDashSize: rawLineAndCurveItem.options.straightDashSize,
      straightGapSize: rawLineAndCurveItem.options.straightGapSize,
      curveDashLength: rawLineAndCurveItem.options.curveDashLength,
      curveDashSize: rawLineAndCurveItem.options.curveDashSize,
      curveGapSize: rawLineAndCurveItem.options.curveGapSize,
    },
  } as LineAndCurveItemKeyInfo;

  return lineAndCurve;
};

export function alignPersistLaneLineItemKeyInfo(
  this: ExtendedNamespace,
  rawLaneLine: LaneLineItemKeyInfo,
) {
  const rawLineColor = rawLaneLine.options.lineColor;
  const laneLine = {
    seriePoints: rawLaneLine.seriePoints ? rawLaneLine.seriePoints.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    category: rawLaneLine.category,
    options: {
      lineType: rawLaneLine.options.lineType,
      lineColor: new Color3(rawLineColor.r, rawLineColor.g, rawLineColor.b),
      lineId: rawLaneLine.options.lineId,
      dashAlignType: rawLaneLine.options.dashAlignType,
      straightDashLength: rawLaneLine.options.straightDashLength,
      straightDashSize: rawLaneLine.options.straightDashSize,
      straightGapSize: rawLaneLine.options.straightGapSize,
      curveDashLength: rawLaneLine.options.curveDashLength,
      curveDashSize: rawLaneLine.options.curveDashSize,
      curveGapSize: rawLaneLine.options.curveGapSize,
    },
    laneLineSide: rawLaneLine.laneLineSide,
    catmullPoints: rawLaneLine.catmullPoints ? rawLaneLine.catmullPoints.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    catmullTangents: rawLaneLine.catmullTangents ? rawLaneLine.catmullTangents.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    altitudeCatmullPoints: rawLaneLine.altitudeCatmullPoints ? rawLaneLine.altitudeCatmullPoints.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    altitudeCatmullTangents: rawLaneLine.altitudeCatmullTangents ? rawLaneLine.altitudeCatmullTangents.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    atlasLaneBoundaryVirtual: rawLaneLine.atlasLaneBoundaryVirtual,
    atlasLaneBoundaryType: rawLaneLine.atlasLaneBoundaryType,
  } as LaneLineItemKeyInfo;

  return laneLine;
};

export function alignPersistLaneItemKeyInfo(
  this: ExtendedNamespace,
  rawLane: LaneItemKeyInfo,
) {
  const lane = {
    laneLines: {
      innerLaneLine: this.alignPersistLaneLineItemKeyInfo(rawLane.laneLines.innerLaneLine) as LaneLineItemKeyInfo,
      outerLaneLine: this.alignPersistLaneLineItemKeyInfo(rawLane.laneLines.outerLaneLine) as LaneLineItemKeyInfo,
    },
    laneConnectors: {
      laneConnectorStart: this.alignPersistLaneLineItemKeyInfo(rawLane.laneConnectors.laneConnectorStart) as LaneLineItemKeyInfo,
      laneConnectorEnd: this.alignPersistLaneLineItemKeyInfo(rawLane.laneConnectors.laneConnectorEnd) as LaneLineItemKeyInfo,
    },
    laneId: rawLane.laneId,
    laneSide: rawLane.laneSide,
    laneWidthEditable: rawLane.laneWidthEditable,
    atlasLaneSpeedLimit: rawLane.atlasLaneSpeedLimit,
    atlasLaneType: rawLane.atlasLaneType,
    atlasLaneTurn: rawLane.atlasLaneTurn,
    atlasLaneDirection: rawLane.atlasLaneDirection,
    prevLanes: rawLane.prevLanes,
    nextLanes: rawLane.nextLanes,
  } as LaneItemKeyInfo;

  return lane;
};

export function alignPersistRoadItemKeyInfo(
  this: ExtendedNamespace,
  rawRoad: RoadItemKeyInfo,
) {
  const rawRoadPosition = rawRoad.position;
  const rawRoadRotation = rawRoad.rotation;

  const road = {
    referenceLine: this.alignPersistReferenceLineItemKeyInfo(rawRoad.referenceLine) as ReferenceLineItemKeyInfo,
    referenceLineEditable: rawRoad.referenceLineEditable,
    surfaceLines: rawRoad.surfaceLines ? rawRoad.surfaceLines.map((l: LineAndCurveItemKeyInfo) => {
      return this.alignPersistLineAndCurveItemKeyInfo(l) as LineAndCurveItemKeyInfo;
    }) : [],
    laneItems: {
      leftLanes: rawRoad.laneItems.leftLanes ? rawRoad.laneItems.leftLanes.map((l: LaneItemKeyInfo) => {
        return this.alignPersistLaneItemKeyInfo(l) as LaneItemKeyInfo;
      }) : [],
      rightLanes: rawRoad.laneItems.rightLanes ? rawRoad.laneItems.rightLanes.map((l: LaneItemKeyInfo) => {
        return this.alignPersistLaneItemKeyInfo(l) as LaneItemKeyInfo;
      }) : [],
    },
    generalLeftLaneIndex: rawRoad.generalLeftLaneIndex,
    generalRightLaneIndex: rawRoad.generalRightLaneIndex,
    category: rawRoad.category,
    roadId: rawRoad.roadId,
    roadPID: rawRoad.roadPID,
    position: new Vector3(rawRoadPosition.x, rawRoadPosition.y, rawRoadPosition.z),
    rotation: new Vector3(rawRoadRotation.x, rawRoadRotation.y, rawRoadRotation.z),
    atlasRoadType: rawRoad.atlasRoadType,
    matAlpha: rawRoad.matAlpha,
    prevRoads: rawRoad.prevRoads,
    nextRoads: rawRoad.nextRoads,
    junctionId: rawRoad.junctionId,
  } as RoadItemKeyInfo;

  return road;
};

export function persistLoadRoad(
  this: ExtendedNamespace,
  roadItemKeyInfo: RoadItemKeyInfo,
) {
  const placeholderRefLine = this.createPlaceholderReferenceLine(roadItemKeyInfo) as ReferenceLineItem;

  const seriePoints = roadItemKeyInfo.referenceLine.seriePoints;
  const reflineKeyPoints = [seriePoints[0], seriePoints[seriePoints.length - 1]];
  const serieTangents = roadItemKeyInfo.referenceLine.serieTangents;
  const serieNormals = roadItemKeyInfo.referenceLine.serieNormals;

  const roadItem = {
    referenceLine: placeholderRefLine,
    referenceLineEditable: roadItemKeyInfo.referenceLineEditable,
    surfaceLines: [],
    laneItems: {
      leftLanes: [],
      rightLanes: [],
    },
    startPointNormal: serieNormals[0],
    endPointNormal: serieNormals[serieNormals.length - 1],
    startPointTangent: serieTangents[0],
    endPointTangent: serieTangents[serieTangents.length - 1],
    generalLeftLaneIndex: roadItemKeyInfo.generalLeftLaneIndex,
    generalRightLaneIndex: roadItemKeyInfo.generalRightLaneIndex,
    category: roadItemKeyInfo.category,
    roadId: roadItemKeyInfo.roadId,
    roadPID: roadItemKeyInfo.roadPID,
    position: roadItemKeyInfo.position,
    rotation: roadItemKeyInfo.rotation,
    atlasRoadType: roadItemKeyInfo.atlasRoadType,
    matAlpha: roadItemKeyInfo.matAlpha,
    prevRoads: [...roadItemKeyInfo.prevRoads],
    nextRoads: [...roadItemKeyInfo.nextRoads],
    junctionId: roadItemKeyInfo.junctionId,
  } as RoadItem;

  this.emitEvent(StoreRoadEvent, roadItem);
  this.emitEvent(ReformatRoadEvent, {
    roadId: roadItemKeyInfo.roadId,
    roadCategory: roadItemKeyInfo.category,
    roadItemKeyInfo: roadItemKeyInfo,
    reflineKeyPoints: reflineKeyPoints,
  });
};

export function alignPersistJunctionEdgeItemKeyInfo(
  this: ExtendedNamespace,
  rawEdge: JunctionEdgeItemKeyInfo,
) {
  const rawEdgeLineColor = rawEdge.options.lineColor;

  const edge = {
    seriePoints: rawEdge.seriePoints ? rawEdge.seriePoints.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    catmullPoints: rawEdge.catmullPoints ? rawEdge.catmullPoints.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    catmullTangents: rawEdge.catmullTangents ? rawEdge.catmullTangents.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    altitudeCatmullPoints: rawEdge.altitudeCatmullPoints ? rawEdge.altitudeCatmullPoints.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    altitudeCatmullTangents: rawEdge.altitudeCatmullTangents ? rawEdge.altitudeCatmullTangents.map((v: Vector3) => {
      return this.alignPersistVector3(v) as Vector3;
    }) : [],
    edgeId: rawEdge.edgeId,
    options: {
      lineType: rawEdge.options.lineType,
      lineColor: new Color3(rawEdgeLineColor.r, rawEdgeLineColor.g, rawEdgeLineColor.b),
      lineId: rawEdge.options.lineId,
      dashAlignType: rawEdge.options.dashAlignType,
      straightDashLength: rawEdge.options.straightDashLength,
      straightDashSize: rawEdge.options.straightDashSize,
      straightGapSize: rawEdge.options.straightGapSize,
      curveDashLength: rawEdge.options.curveDashLength,
      curveDashSize: rawEdge.options.curveDashSize,
      curveGapSize: rawEdge.options.curveGapSize,
    },
  } as JunctionEdgeItemKeyInfo;

  return edge;
};

export function alignPersistJunctionItemKeyInfo(
  this: ExtendedNamespace,
  rawJunction: JunctionItemKeyInfo,
) {
  const junction = {
    junctionId: rawJunction.junctionId,
    junctionPID: rawJunction.junctionPID,
    junctionType: rawJunction.junctionType,
    allCandidateConnections: rawJunction.allCandidateConnections || [],
    involvedRoads: rawJunction.involvedRoads || [],
    edges: rawJunction.edges ? rawJunction.edges.map((edge: JunctionEdgeItemKeyInfo) => {
      return this.alignPersistJunctionEdgeItemKeyInfo(edge) as JunctionEdgeItemKeyInfo;
    }) : [],
  } as JunctionItemKeyInfo;

  return junction;
};

export function persistLoadJunction(
  this: ExtendedNamespace,
  junctionItemKeyInfo: JunctionItemKeyInfo,
) {
  const junctionMeshAndEdges = this.reformatJunctionMeshAndEdges(junctionItemKeyInfo);

  const junctionItem = {
    junctionId: junctionItemKeyInfo.junctionId,
    junctionPID: junctionItemKeyInfo.junctionPID,
    junctionType: junctionItemKeyInfo.junctionType,
    allCandidateConnections: junctionItemKeyInfo.allCandidateConnections.map((r: {
      startRoadId: string;
      startRoadCategory: RoadCategory;
      startRoadVertexCategory: JunctionVertexCategory;
      endRoadId: string;
      endRoadCategory: RoadCategory;
      endRoadVertexCategory: JunctionVertexCategory;
    }) => {
      return {
        startRoadId: r.startRoadId,
        startRoadCategory: r.startRoadCategory,
        startRoadVertexCategory: r.startRoadVertexCategory,
        endRoadId: r.endRoadId,
        endRoadCategory: r.endRoadCategory,
        endRoadVertexCategory: r.endRoadVertexCategory,
      };
    }),
    involvedRoads: junctionItemKeyInfo.involvedRoads.map((c: {
      roadId: string;
      roadCategory: RoadCategory;
      prevJunctionVertexCategory: JunctionVertexCategory;
      nextJunctionVertexCategory: JunctionVertexCategory;
    }) => {
      return {
        roadId: c.roadId,
        roadCategory: c.roadCategory,
        prevJunctionVertexCategory: c.prevJunctionVertexCategory,
        nextJunctionVertexCategory: c.nextJunctionVertexCategory,
      };
    }),
    edges: junctionMeshAndEdges.edges,
    junctionMesh: junctionMeshAndEdges.junctionMesh,
  } as JunctionItem;

  junctionItem.junctionMesh.metadata = {
    belongingJunctionItem: junctionItem,
  };

  this.emitEvent(StoreJunctionEvent, junctionItem);

  this.makeSceneDirty();
};