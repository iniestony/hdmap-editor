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
  AtlasSignal,
} from '../atlasConverter/type';

export enum ActionMeshCategory {
  RefLineCatmullReformat,
};

export interface ActionMeshMetadata {
  isActionMesh: boolean;
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

export interface SignalItemAttributeEdit {
  signalType?: AtlasSignal.Type;
};
