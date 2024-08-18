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

export enum RoadConnectionAltitudeActionMeshCategory {
  RefLineAltitudeCatmullReformat,
};

export interface RoadConnectionAltitudeActionMeshMetadata {
  isRoadConnectionReflineAltitudeActionMesh: boolean;
  point: Vector3;
  color: Color3;
  category: RoadConnectionAltitudeActionMeshCategory;
  relatedRefLine?: ReferenceLineItem;
  relatedLaneLine?: LaneLineItem;
  relatedLane?: LaneItem;
  isStartCatmull?: boolean;
  isEndCatmull?: boolean;
  catmullIndex?: number;
};
