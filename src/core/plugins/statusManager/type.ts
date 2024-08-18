import {
  Vector3,
  Color3,
  LinesMesh,
  Mesh,
} from "@babylonjs/core";
import { LineType, DashAlignType } from '../../../core/plugins/lineDrawer/type';
import {
  AtlasRoad,
  AtlasLane,
  AtlasJunction,
  AtlasLaneBoundaryType,
  AtlasSignal,
  AtlasSubsignal,
  AtlasSignInfo,
} from '../../../core/plugins/atlasConverter/type';
import { JunctionVertexCategory } from "../junctionDrawer/type";
import {
  SubSignalColorType,
} from "../signalDrawer/type";

export interface DirtyRoadInfo {
  roadPID: string;
  roadId: string;
  roadCategory: RoadCategory;
};

export interface DirtyRoadInfoCollection {
  [roadId: string]: DirtyRoadInfo;
};

export interface DirtyJunctionInfo {
  junctionPID: string;
  junctionId: string;
};

export interface DirtyJunctionInfoCollection {
  [junctionId: string]: DirtyJunctionInfo;
};

export interface DirtySignalInfo {
  signalPID: string;
  signalId: string;
};

export interface DirtySignalInfoCollection {
  [signalId: string]: DirtySignalInfo;
};

export enum LineAndCurveCategory {
  TwoStraightLine,
  ThreeCircleCurve,
  QuadraticBezierCurve,
  CubicBezierCurve,
};

/**
 * reference line: points -> seriePoints
 * lane line: seriePoints -> points
 */
export interface LineAndCurveItem {
  points: Vector3[]; // markers
  pointsMesh: Mesh[];
  lineAndCurveMesh: LinesMesh;
  markerDisposed: boolean;
  category: LineAndCurveCategory;
  drawingPoints: Vector3[];
  seriePoints: Vector3[];
  serieNormals: Vector3[]; // towards forward direction right
  serieTangents: Vector3[];  // towards forward direction
  options: {
    lineType: LineType;
    lineColor: Color3;
    lineId: string;
    dashAlignType?: DashAlignType;
    straightDashLength?: number;
    straightDashSize?: number;
    straightGapSize?: number;
    curveDashLength?: number;
    curveDashSize?: number;
    curveGapSize?: number;
  };
};

export interface ReferenceLineItem {
  points: Vector3[]; // markers
  pointsMesh: Mesh[];
  lineAndCurveMesh: LinesMesh;
  markerDisposed: boolean;
  category: LineAndCurveCategory;
  drawingPoints: Vector3[];
  seriePoints: Vector3[];
  serieNormals: Vector3[]; // towards forward direction right
  serieTangents: Vector3[];  // towards forward direction
  options: {
    lineType: LineType;
    lineColor: Color3;
    lineId: string;
    dashAlignType?: DashAlignType;
    straightDashLength?: number;
    straightDashSize?: number;
    straightGapSize?: number;
    curveDashLength?: number;
    curveDashSize?: number;
    curveGapSize?: number;
  };
  catmullPoints: Vector3[];
  catmullTangents: Vector3[];
  altitudeCatmullPoints: Vector3[];
  altitudeCatmullTangents: Vector3[];
};

export interface LaneLineItem {
  points: Vector3[]; // markers
  pointsMesh: Mesh[];
  lineAndCurveMesh: LinesMesh[];
  markerDisposed: boolean;
  category: LineAndCurveCategory;
  drawingPoints: Vector3[];
  seriePoints: Vector3[];
  serieNormals: Vector3[]; // towards forward direction right
  serieTangents: Vector3[];  // towards forward direction
  options: {
    lineType: LineType;
    lineColor: Color3;
    lineId: string;
    dashAlignType?: DashAlignType;
    straightDashLength?: number;
    straightDashSize?: number;
    straightGapSize?: number;
    curveDashLength?: number;
    curveDashSize?: number;
    curveGapSize?: number;
  };
  laneLineSide: LaneLineSide;
  catmullPoints: Vector3[];
  catmullTangents: Vector3[];
  altitudeCatmullPoints: Vector3[];
  altitudeCatmullTangents: Vector3[];
  atlasLaneBoundaryVirtual: boolean;
  atlasLaneBoundaryType: AtlasLaneBoundaryType.Type;
};

export interface DisposeLineAndCurveMarkerOpt {
  twoStraightLinePerm?: boolean;
  twoStraightLineTemp?: boolean;
  threeCircleCurvePerm?: boolean;
  threeCircleCurveTemp?: boolean;
  quadraticBezierCurvePerm?: boolean;
  quadraticBezierCurveTemp?: boolean;
  cubicBezierCurvePerm?: boolean;
  cubicBezierCurveTemp?: boolean;
};

export interface DisposeRoadMarkerOpt {
  twoStraightLineRoadPerm?: boolean;
  twoStraightLineRoadTemp?: boolean;
  threeCircleCurveRoadPerm?: boolean;
  threeCircleCurveRoadTemp?: boolean;
  quadraticBezierCurveRoadPerm?: boolean;
  quadraticBezierCurveRoadTemp?: boolean;
  cubicBezierCurveRoadPerm?: boolean;
  cubicBezierCurveRoadTemp?: boolean;
  catmullSerieRoadPerm?: boolean;
  catmullSerieRoadTemp?: boolean;
};

export enum RoadCategory {
  TwoStraightLineRoad,
  ThreeCircleCurveRoad,
  QuadraticBezierCurveRoad,
  CubicBezierCurveRoad,
  CatmullSerieRoad,
  ConnectionRoad,
};

export enum AddLaneSide {
  Left,
  Right,
};

export enum LaneSide {
  Left,
  Right,
};

export enum LaneLineSide {
  Inner,
  Outer,
  ConnectorStart,
  ConnectorEnd,
};

export enum MarkerSide {
  Start,
  Middle,
  End,
  Control,
  ControlNearStart,
  ControlNearEnd,
};

export interface LaneItem {
  laneLines: {
    // towards lane forward direction
    innerLaneLine: LaneLineItem;
    // towards lane forward direction
    outerLaneLine: LaneLineItem;
  };
  laneConnectors: {
    // towards lane forward direction right, aka from inner to outer
    laneConnectorStart: LaneLineItem;
    // towards lane forward direction right, aka from inner to outer
    laneConnectorEnd: LaneLineItem;
  };
  laneId: string;
  laneSide: LaneSide;
  laneMesh: Mesh;
  laneDirectionMeshs: Mesh[];
  laneWidthEditable: boolean;
  atlasLaneSpeedLimit: number;
  atlasLaneType: AtlasLane.LaneType;
  atlasLaneTurn: AtlasLane.LaneTurn;
  atlasLaneDirection: AtlasLane.LaneDirection;
  prevLanes: Array<{
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  }>;
  nextLanes: Array<{
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  }>;
};

export interface RoadItem {
  referenceLine: ReferenceLineItem;
  referenceLineEditable: boolean;
  surfaceLines: LineAndCurveItem[];
  laneItems: {
    leftLanes: LaneItem[];
    rightLanes: LaneItem[];
  };
  startPointNormal: Vector3; // towards road forward direction right
  endPointNormal: Vector3; // towards road forward direction right
  startPointTangent: Vector3; // towards road forward direction
  endPointTangent: Vector3; // towards road forward direction
  generalLeftLaneIndex: number;
  generalRightLaneIndex: number;
  category: RoadCategory;
  roadId: string;
  roadPID: string;
  position: Vector3;
  rotation: Vector3;
  atlasRoadType: AtlasRoad.Type;
  matAlpha: number;
  prevRoads: Array<{
    roadId: string;
    roadCategory: RoadCategory;
  }>;
  nextRoads: Array<{
    roadId: string;
    roadCategory: RoadCategory;
  }>;
  junctionId?: string;
};

export interface JunctionEdgeItem {
  seriePoints: Vector3[];
  drawingPoints: Vector3[];
  serieNormals: Vector3[];
  serieTangents: Vector3[];
  catmullPoints: Vector3[];
  catmullTangents: Vector3[];
  altitudeCatmullPoints: Vector3[];
  altitudeCatmullTangents: Vector3[];
  edgeId: string;
  edgeMesh: Mesh;
  options: {
    lineType: LineType;
    lineColor: Color3;
    lineId: string;
    dashAlignType?: DashAlignType;
    straightDashLength?: number;
    straightDashSize?: number;
    straightGapSize?: number;
    curveDashLength?: number;
    curveDashSize?: number;
    curveGapSize?: number;
  };
};

export interface JunctionItem {
  junctionId: string;
  junctionPID: string;
  junctionType: AtlasJunction.Type;
  allCandidateConnections: Array<{
    startRoadId: string;
    startRoadCategory: RoadCategory;
    startRoadVertexCategory: JunctionVertexCategory;
    endRoadId: string;
    endRoadCategory: RoadCategory;
    endRoadVertexCategory: JunctionVertexCategory;
  }>;
  involvedRoads: Array<{
    roadId: string;
    roadCategory: RoadCategory;
    prevJunctionVertexCategory: JunctionVertexCategory;
    nextJunctionVertexCategory: JunctionVertexCategory;
  }>;
  edges: Array<JunctionEdgeItem>;
  junctionMesh: Mesh;
};

export interface SignalItem {
  signalId: string;
  signalPID: string;
  signalType: AtlasSignal.Type;
  width: number;
  height: number;
  position: Vector3;
  rotationHorizontal: number;
  rotationVertical: number;
  vertices: {
    topLeft: Vector3;
    topRight: Vector3;
    bottomLeft: Vector3;
    bottomRight: Vector3;
    center: Vector3;
  };
  generalSubSignalIndex: number;
  signalMesh: Mesh;
  subSignalItems: SubSignalItem[];
};

export interface SubSignalItem {
  subSignalId: string;
  subSignalType: AtlasSubsignal.Type;
  subSignalColorType: SubSignalColorType;
  position: Vector3;
  subSignalMesh: Mesh;
};


// key info
export interface ReferenceLineItemKeyInfo {
  points: Vector3[];
  seriePoints: Vector3[];
  serieNormals: Vector3[];
  serieTangents: Vector3[];
  category: LineAndCurveCategory;
  options: {
    lineType: LineType;
    lineColor: Color3;
    lineId: string;
    dashAlignType?: DashAlignType;
    straightDashLength?: number;
    straightDashSize?: number;
    straightGapSize?: number;
    curveDashLength?: number;
    curveDashSize?: number;
    curveGapSize?: number;
  };
  catmullPoints: Vector3[];
  catmullTangents: Vector3[];
  altitudeCatmullPoints: Vector3[];
  altitudeCatmullTangents: Vector3[];
};

export interface LineAndCurveItemKeyInfo {
  seriePoints: Vector3[];
  category: LineAndCurveCategory;
  options: {
    lineType: LineType;
    lineColor: Color3;
    lineId: string;
    dashAlignType?: DashAlignType;
    straightDashLength?: number;
    straightDashSize?: number;
    straightGapSize?: number;
    curveDashLength?: number;
    curveDashSize?: number;
    curveGapSize?: number;
  };
};

export interface LaneLineItemKeyInfo {
  seriePoints: Vector3[];
  category: LineAndCurveCategory;
  options: {
    lineType: LineType;
    lineColor: Color3;
    lineId: string;
    dashAlignType?: DashAlignType;
    straightDashLength?: number;
    straightDashSize?: number;
    straightGapSize?: number;
    curveDashLength?: number;
    curveDashSize?: number;
    curveGapSize?: number;
  };
  laneLineSide: LaneLineSide;
  catmullPoints: Vector3[];
  catmullTangents: Vector3[];
  altitudeCatmullPoints: Vector3[];
  altitudeCatmullTangents: Vector3[];
  atlasLaneBoundaryVirtual: boolean;
  atlasLaneBoundaryType: AtlasLaneBoundaryType.Type;
};

export interface LaneItemKeyInfo {
  laneLines: {
    innerLaneLine: LaneLineItemKeyInfo;
    outerLaneLine: LaneLineItemKeyInfo;
  };
  laneConnectors: {
    laneConnectorStart: LaneLineItemKeyInfo;
    laneConnectorEnd: LaneLineItemKeyInfo;
  };
  laneId: string;
  laneSide: LaneSide;
  laneWidthEditable: boolean;
  atlasLaneSpeedLimit: number;
  atlasLaneType: AtlasLane.LaneType;
  atlasLaneTurn: AtlasLane.LaneTurn;
  atlasLaneDirection: AtlasLane.LaneDirection;
  prevLanes: Array<{
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  }>;
  nextLanes: Array<{
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  }>;
};

export interface RoadItemKeyInfo {
  referenceLine: ReferenceLineItemKeyInfo;
  referenceLineEditable: boolean;
  surfaceLines: LineAndCurveItemKeyInfo[];
  laneItems: {
    leftLanes: LaneItemKeyInfo[];
    rightLanes: LaneItemKeyInfo[];
  };
  generalLeftLaneIndex: number;
  generalRightLaneIndex: number;
  category: RoadCategory;
  roadId: string;
  roadPID: string;
  position: Vector3;
  rotation: Vector3;
  atlasRoadType: AtlasRoad.Type;
  matAlpha: number;
  prevRoads: Array<{
    roadId: string;
    roadCategory: RoadCategory;
  }>;
  nextRoads: Array<{
    roadId: string;
    roadCategory: RoadCategory;
  }>;
  junctionId?: string;
};

export interface JunctionEdgeItemKeyInfo {
  seriePoints: Vector3[];
  catmullPoints: Vector3[];
  catmullTangents: Vector3[];
  altitudeCatmullPoints: Vector3[];
  altitudeCatmullTangents: Vector3[];
  edgeId: string;
  options: {
    lineType: LineType;
    lineColor: Color3;
    lineId: string;
    dashAlignType?: DashAlignType;
    straightDashLength?: number;
    straightDashSize?: number;
    straightGapSize?: number;
    curveDashLength?: number;
    curveDashSize?: number;
    curveGapSize?: number;
  };
};

export interface JunctionItemKeyInfo {
  junctionId: string;
  junctionPID: string;
  junctionType: AtlasJunction.Type;
  allCandidateConnections: Array<{
    startRoadId: string;
    startRoadCategory: RoadCategory;
    startRoadVertexCategory: JunctionVertexCategory;
    endRoadId: string;
    endRoadCategory: RoadCategory;
    endRoadVertexCategory: JunctionVertexCategory;
  }>;
  involvedRoads: Array<{
    roadId: string;
    roadCategory: RoadCategory;
    prevJunctionVertexCategory: JunctionVertexCategory;
    nextJunctionVertexCategory: JunctionVertexCategory;
  }>;
  edges: Array<JunctionEdgeItemKeyInfo>;
};

export interface SignalItemKeyInfo {
  signalId: string;
  signalPID: string;
  signalType: AtlasSignal.Type;
  width: number;
  height: number;
  position: Vector3;
  rotationHorizontal: number;
  rotationVertical: number;
  vertices: {
    topLeft: Vector3;
    topRight: Vector3;
    bottomLeft: Vector3;
    bottomRight: Vector3;
    center: Vector3;
  };
  generalSubSignalIndex: number;
  subSignalItems: SubSignalItemKeyInfo[];
};

export interface SubSignalItemKeyInfo {
  subSignalId: string;
  subSignalType: AtlasSubsignal.Type;
  subSignalColorType: SubSignalColorType;
  position: Vector3;
};