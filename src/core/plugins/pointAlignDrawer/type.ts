import {
  LasPoint2D
} from '../lasLoader/type';
import {
  Vector3,
  Color3,
  LinesMesh,
  Mesh,
} from "@babylonjs/core";

export interface PointAlign2D {
  clientX: number;
  clientY: number;
}

export interface PointAlignItem {
  pointAlignId: string;
  pointAlignPoint: Vector3;
  pointAlignlasPoint2D: LasPoint2D;
  pointAlignPointMesh: Mesh;
}

export interface PointAlignItemKeyInfo {
  pointAlignId: string;
  pointAlignPoint: Vector3;
  pointAlignlasPoint2D: LasPoint2D;
}