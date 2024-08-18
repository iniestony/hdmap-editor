import {
  CloudPoint,
} from "@babylonjs/core";
export interface LASTileInfo {
  level: number;
  tileSize: number;
  voxelSize: number;
  tileX: number;
  tileY: number;
};

export interface LASInfo {
  id: string;
  projectId: string;
  pointRange: {
    xmin: number;
    xmax: number;
    xrange: number;
    xcenter: number;
    ymin: number;
    ymax: number;
    yrange: number;
    ycenter: number;
    zmin: number;
    zmax: number;
    zrange: number;
    zcenter: number;
  };
  tiles: Array<LASTileInfo>;
};

export interface LASIntensitySection {
  min: number;
  max: number;
};

export interface LasTilesRange {
  level: number;
  viewDistanceSection: number[];
};

export enum LASVizOption {
  Intensity,
  Height,
};

export interface LasPoint2D {
  pixelX: number;
  pixelY: number;
}

export interface LasPoint2Dand3D{
  cloudPoint: CloudPoint;
  lasPoint2D: LasPoint2D;
}