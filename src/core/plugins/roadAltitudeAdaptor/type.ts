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

export enum RoadAltitudeActionMeshCategory {
  RefLineAltitudeCatmullReformat,
};

export interface RoadAltitudeActionMeshMetadata {
  isRoadReflineAltitudeActionMesh: boolean;
  point: Vector3;
  color: Color3;
  category: RoadAltitudeActionMeshCategory;
  relatedRefLine?: ReferenceLineItem;
  relatedLaneLine?: LaneLineItem;
  relatedLane?: LaneItem;
  isStartCatmull?: boolean;
  isEndCatmull?: boolean;
  catmullIndex?: number;
};
