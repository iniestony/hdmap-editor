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
} from '../../../core/plugins/atlasConverter/type';

export enum ConnectionActionMeshCategory {
  RefLineCatmullReformat,
  LeftLaneCatmullEdit,
  RightLaneCatmullEdit
};

export interface ConnectionActionMeshMetadata {
  isConnectionActionMesh: boolean;
  point: Vector3;
  color: Color3;
  category: ConnectionActionMeshCategory;
  relatedRefLine?: ReferenceLineItem;
  relatedLaneLine?: LaneLineItem;
  relatedLane?: LaneItem;
  isStartCatmull?: boolean;
  isEndCatmull?: boolean;
  catmullIndex?: number;
};

export enum NewLanePrevAndNextConnectionLaneCategory {
  PrevLane,
  NextLane,
};

export interface NewLanePrevAndNextConnectionLaneVertexMetadata {
  isNewLanePrevAndNextConnectionLaneVertex: boolean;
  point: Vector3;
  color: Color3;
  category: NewLanePrevAndNextConnectionLaneCategory;
  laneItem: LaneItem;
  roadItem: RoadItem;
};

export interface RoadItemConnectionAttributeEdit {
  atlasRoadType?: AtlasRoad.Type;
};
