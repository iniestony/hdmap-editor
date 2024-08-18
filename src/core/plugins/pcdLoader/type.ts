export type Field = "x" | "y" | "z" | "intensity";
export type Type = "i" | "u" | "f";
export type Data = "ascii" | "binary" | "binary_compressed";

export interface PcdHeader {
  version: number;
  fields: Field[];
  size: number[];
  type: Type[];
  count: number[];
  height: number;
  width: number;
  points: number;
  data: Data;
};

export interface PcdInfo {
  header: PcdHeader;
  positions: Float32Array | null;
  intensities: Float32Array | null;
  colors: Float32Array | null;
};

export interface PcdOffsets {
  x: number | null;
  y: number | null;
  z: number | null;
  intensity: number | null;
};

export enum PcdVizOption {
  Intensity,
  Height,
};