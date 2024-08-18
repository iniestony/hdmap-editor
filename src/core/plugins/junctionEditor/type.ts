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
  JunctionEdgeItem,
  JunctionItem,
} from '../statusManager/type';
import {
  AtlasJunction,
} from '../../../core/plugins/atlasConverter/type';
import {
  JunctionVertexCategory,
} from '../junctionDrawer/type';

export enum JunctionActionMeshCategory {
  EdgeCatmullEdit,
};

export interface JunctionActionMeshMetadata {
  isJunctionActionMesh: boolean;
  point: Vector3;
  color: Color3;
  category: JunctionActionMeshCategory;
  relatedJunctionEdge?: JunctionEdgeItem;
  relatedJunction?: JunctionItem;
  isStartCatmull?: boolean;
  isEndCatmull?: boolean;
  catmullIndex?: number;
};

export interface NewRoadPrevAndNextConnectionRoadVertexMetadata {
  isNewRoadPrevAndNextConnectionRoadVertex: boolean;
  point: Vector3;
  color: Color3;
  category: JunctionVertexCategory;
  roadItem: RoadItem;
  isSelected: boolean;
};

export interface JunctionItemAttributeEdit {
  junctionType?: AtlasJunction.Type;
};