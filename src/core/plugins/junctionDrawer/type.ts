import {
  Vector3,
  Color3,
  LinesMesh,
} from "@babylonjs/core";

import {
  LineAndCurveCategory,
  LineAndCurveItem,
  ReferenceLineItem,
  LaneLineItem,
  LaneItem,
  RoadItem,
  RoadCategory,
  LaneSide,
  LaneLineSide,
} from '../statusManager/type';

export enum JunctionVertexCategory {
  RoadStart,
  RoadEnd,
};

export interface JunctionVertexMetadata {
  isJunctionVertex: boolean;
  point: Vector3;
  color: Color3;
  category: JunctionVertexCategory;
  relatedRoadId: string;
  relatedRoadCategory: RoadCategory;
  connectedPoint: Vector3;
  isSelected: boolean;
};

export interface JunctionEdge {
  roadIds: string[];
  roadCategories: RoadCategory[];
  junctionVertexCategories: JunctionVertexCategory[];
  roadVertices: Vector3[];
  connectedRoadVertices: Vector3[];
};