import {
  LasPoint2D
} from '../lasLoader/type';
import {
  Vector3,
  Color3,
  LinesMesh,
  Mesh,
} from "@babylonjs/core";

export enum SegmentAlignPointType {
  start,
  end
}

export interface SegmentAlignPoint2D {
  clientX: number;
  clientY: number;
}

export interface SegmentAlignPointItem {
  segmentAlignPointId: string;
  position2D: LasPoint2D;
  position: Vector3;
  pointMesh: Mesh;
  pointType: SegmentAlignPointType.start;
}

export interface SegmentAlignItem {
  segmentAlignId: string;
  segmentAlignPoints: SegmentAlignPointItem[];
  lasPlaneDistance: number;
  lasAltitudeDistance: number;
  lasSpaceDistance: number;
  segmentAlignMesh: Mesh;
}


export interface SegmentAlignPointItemKeyInfo {
  segmentAlignPointId: string;
  position2D: LasPoint2D;
  position: Vector3;
  pointType: SegmentAlignPointType.start;
}

export interface SegmentAlignItemKeyInfo {
  segmentAlignId: string;
  segmentAlignPoints: SegmentAlignPointItemKeyInfo[];
  lasPlaneDistance: number;
  lasAltitudeDistance: number;
  lasSpaceDistance: number;
}