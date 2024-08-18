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

import {
  AtlasRoad,
  AtlasLane,
  AtlasLaneBoundaryType,
} from '../atlasConverter/type';

export enum ActionMeshCategory {
  LeftLaneWidthEdit,
  RightLaneWidthEdit,
  LeftLaneCatmullEdit,
  RightLaneCatmullEdit,
};

export interface ActionMeshMetadata {
  isLaneActionMesh: boolean;
  point: Vector3;
  color: Color3;
  category: ActionMeshCategory;
  relatedRefLine?: ReferenceLineItem;
  relatedLaneLine?: LaneLineItem;
  relatedLane?: LaneItem;
  isStartCatmull?: boolean;
  isEndCatmull?: boolean;
  catmullIndex?: number;
};

export interface RoadLaneLineAttributeEdit {
  atlasLaneBoundaryVirtual?: boolean;
  atlasLaneBoundaryType?: AtlasLaneBoundaryType.Type;
};

export interface RoadLaneLinesAttributeFormEdit {
  laneLines_innerLaneLine_atlasLaneBoundaryVirtual?: boolean;
  laneLines_innerLaneLine_atlasLaneBoundaryType?: AtlasLaneBoundaryType.Type;
  laneLines_outerLaneLine_atlasLaneBoundaryVirtual?: boolean;
  laneLines_outerLaneLine_atlasLaneBoundaryType?: AtlasLaneBoundaryType.Type;
};

export interface RoadLaneAttributeEdit {
  atlasLaneSpeedLimit?: number;
  atlasLaneType?: AtlasLane.LaneType;
  atlasLaneTurn?: AtlasLane.LaneTurn;
  atlasLaneDirection?: AtlasLane.LaneDirection;
};