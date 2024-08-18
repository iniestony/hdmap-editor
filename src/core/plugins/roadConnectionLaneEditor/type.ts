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

export enum ConnectionLaneActionMeshCategory {
  LeftLaneCatmullEdit,
  RightLaneCatmullEdit
};

export interface ConnectionLaneActionMeshMetadata {
  isConnectionLaneActionMesh: boolean;
  point: Vector3;
  color: Color3;
  category: ConnectionLaneActionMeshCategory;
  relatedRefLine?: ReferenceLineItem;
  relatedLaneLine?: LaneLineItem;
  relatedLane?: LaneItem;
  isStartCatmull?: boolean;
  isEndCatmull?: boolean;
  catmullIndex?: number;
};

export enum PrevAndNextConnectionLaneCategory {
  ConnectionLane,
  PrevLane,
  NextLane,
};

export interface PrevAndNextConnectionLaneVertexMetadata {  
  isPrevAndNextConnectionLaneVertex: boolean;
  point: Vector3;
  color: Color3;
  category: PrevAndNextConnectionLaneCategory;
  laneItem: LaneItem;
  roadItem: RoadItem;
};


export interface RoadConnectionLaneLineAttributeEdit {
  atlasLaneBoundaryVirtual?: boolean;
  atlasLaneBoundaryType?: AtlasLaneBoundaryType.Type;
}

export interface RoadConnectionLaneLinesAttributeFormEdit {
  laneLines_innerLaneLine_atlasLaneBoundaryVirtual?: boolean;
  laneLines_innerLaneLine_atlasLaneBoundaryType?: AtlasLaneBoundaryType.Type;
  laneLines_outerLaneLine_atlasLaneBoundaryVirtual?: boolean;
  laneLines_outerLaneLine_atlasLaneBoundaryType?: AtlasLaneBoundaryType.Type;
}

export interface RoadConnectionLaneAttributeEdit {
  atlasLaneSpeedLimit?: number;
  atlasLaneType?: AtlasLane.LaneType;
  atlasLaneTurn?: AtlasLane.LaneTurn;
  atlasLaneDirection?: AtlasLane.LaneDirection;
};