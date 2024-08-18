export enum LineType {
  Solid,
  Dashed,
};

export enum DashAlignType {
  DashStartDashEnd,
  DashStartGapEnd,
  GapStartDashEnd,
  GapStartGapEnd,
};

export interface LineDrawerConfig {
  lineType: LineType,
  dashAlignType: DashAlignType,
  straightDashLength: number,
  straightDashSize: number,
  straightGapSize: number,
  curveDashLength: number,
  curveDashSize: number,
  curveGapSize: number,
};