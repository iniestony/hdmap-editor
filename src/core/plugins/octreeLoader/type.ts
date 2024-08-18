import {
  CloudPoint,
  Vector3,
} from "@babylonjs/core";

export interface OctreeInfo {
  pointcloud: {
    worldTransform: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number; w: number };
    };
    bbox: {
      min: { x: number; y: number; z: number };
      max: { x: number; y: number; z: number };
    };
  };
  octree: {
    bbox: {
      min: { x: number; y: number; z: number };
      max: { x: number; y: number; z: number };
    };
    levels: number;
    visibleNodes: number[];
    visibleNodePoints: number[];
  };
};

export enum PointCloudVizOption {
  Intensity,
  Height,
};

export interface LASIntensitySection {
  min: number;
  max: number;
};

export enum LASVizOption {
  Intensity,
  Height,
};

export interface AlterLASInfo {
  lasIntensityRanges: number[];
  lasIntensitySection: LASIntensitySection;
  lasPointSize: number;
  lasVizOption: LASVizOption.Intensity;
  octreeInfo: OctreeInfo | undefined;
};

export interface LasPoint2D {
  pixelX: number;
  pixelY: number;
};

export interface LasPoint2Dand3D {
  position: Vector3;
  lasPoint2D: LasPoint2D;
};

export interface Point2D {
  clientX: number;
  clientY: number;
};

export interface SorptionPointInfo {
  distance: number;
  position: Vector3;
  lasPoint2D: LasPoint2D;
};