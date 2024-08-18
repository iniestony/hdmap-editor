import {
  Vector3,
  Color3,
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

export enum RoadVertexCategory {
  RoadStart,
  RoadEnd,
};

export interface RoadVertexMetadata {
  isRoadVertex: boolean;
  point: Vector3;
  color: Color3;
  category: RoadVertexCategory;
  relatedRoadId: string;
  relatedRoadCategory: RoadCategory;
};