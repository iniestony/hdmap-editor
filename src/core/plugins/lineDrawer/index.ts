import {
  Vector3,
  Color3,
  Mesh,
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../../core/renderer/config';
import { DisposeLineAndCurveMarkerEvent } from '../statusManager/constant';
import { DisposeLineAndCurveMarkerOpt } from '../statusManager/type';
import { TransactionType } from '../../transactions';
import {
  LineType,
  LineDrawerConfig,
  DashAlignType,
} from './type';
import {
  AlterLineDrawerConfigEvent,
  FetchLineDrawerConfigEvent,
  ReceiveTwoStraightLinePointEvent,
  ReceiveThreeCircleCurvePointEvent,
  ReceiveQuadraticBezierCurvePointEvent,
  ReceiveCubicBezierCurvePointEvent,
} from './constant';

export default class LineDrawerPlugin extends LogicalPlugin {
  private drawerConfig: LineDrawerConfig;

  private twoStraightLineIndex: number;
  private twoStraightLinePoints: Vector3[];
  private twoStraightLinePointsMesh: Mesh[];

  private threeCircleCurveIndex: number;
  private threeCircleCurvePoints: Vector3[];
  private threeCircleCurvePointsMesh: Mesh[];

  private quadraticBezierCurveIndex: number;
  private quadraticBezierCurvePoints: Vector3[];
  private quadraticBezierCurvePointsMesh: Mesh[];

  private cubicBezierCurveIndex: number;
  private cubicBezierCurvePoints: Vector3[];
  private cubicBezierCurvePointsMesh: Mesh[];


  constructor(options: PluginOptions) {
    super(options);

    this.drawerConfig = {
      lineType: LineType.Solid,
      dashAlignType: DashAlignType.GapStartGapEnd,
      straightDashLength: 1,
      straightDashSize: 1,
      straightGapSize: 1,
      curveDashLength: 1,
      curveDashSize: 1,
      curveGapSize: 1,
    };

    this.twoStraightLineIndex = 0;
    this.twoStraightLinePoints = [];
    this.twoStraightLinePointsMesh = [];

    this.threeCircleCurveIndex = 0;
    this.threeCircleCurvePoints = [];
    this.threeCircleCurvePointsMesh = [];

    this.quadraticBezierCurveIndex = 0;
    this.quadraticBezierCurvePoints = [];
    this.quadraticBezierCurvePointsMesh = [];

    this.cubicBezierCurveIndex = 0;
    this.cubicBezierCurvePoints = [];
    this.cubicBezierCurvePointsMesh = [];
  }

  activate() {
    super.activate();
    
    this.init();
  }

  init() {
    this.initConfigEvent();
    this.initDisposeEvent();
    this.initReceivePointEvent();
  }

  initConfigEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(AlterLineDrawerConfigEvent);
    scope.onEvent(AlterLineDrawerConfigEvent, (params: { payload: Partial<LineDrawerConfig> }) => {
      this.drawerConfig = { ...this.drawerConfig, ...params.payload };
    });

    scope.registerEvent(FetchLineDrawerConfigEvent);
    scope.onEvent(FetchLineDrawerConfigEvent, (params: { payload: { callback: Function } }) => {
      params.payload.callback(this.drawerConfig);
    });
  }

  initDisposeEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.onEvent(DisposeLineAndCurveMarkerEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as DisposeLineAndCurveMarkerOpt;

      if (payload.twoStraightLineTemp) {
        this.twoStraightLinePointsMesh.forEach((item: Mesh) => {
          item.dispose();
          scope.makeSceneDirty();
        });
  
        this.twoStraightLinePoints = [];
        this.twoStraightLinePointsMesh = [];
      }

      if (payload.threeCircleCurveTemp) {
        this.threeCircleCurvePointsMesh.forEach((item: Mesh) => {
          item.dispose();
          scope.makeSceneDirty();
        });
  
        this.threeCircleCurvePoints = [];
        this.threeCircleCurvePointsMesh = [];
      }

      if (payload.quadraticBezierCurveTemp) {
        this.quadraticBezierCurvePointsMesh.forEach((item: Mesh) => {
          item.dispose();
          scope.makeSceneDirty();
        });
  
        this.quadraticBezierCurvePoints = [];
        this.quadraticBezierCurvePointsMesh = [];
      }

      if (payload.cubicBezierCurveTemp) {
        this.cubicBezierCurvePointsMesh.forEach((item: Mesh) => {
          item.dispose();
          scope.makeSceneDirty();
        });
  
        this.cubicBezierCurvePoints = [];
        this.cubicBezierCurvePointsMesh = [];
      }
    });
  }

  initReceivePointEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(ReceiveTwoStraightLinePointEvent);
    scope.onEvent(ReceiveTwoStraightLinePointEvent, (params: { payload: Object | string | number | null }) => {
      if (this.twoStraightLinePoints.length >= 2) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      this.twoStraightLinePoints.push(pickedPoint);
      this.drawTwoStraightLine();
    });

    scope.registerEvent(ReceiveThreeCircleCurvePointEvent);
    scope.onEvent(ReceiveThreeCircleCurvePointEvent, (params: { payload: Object | string | number | null }) => {
      if (this.threeCircleCurvePoints.length >= 3) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      this.threeCircleCurvePoints.push(pickedPoint);
      this.drawThreeCircleCurve();
    });

    scope.registerEvent(ReceiveQuadraticBezierCurvePointEvent);
    scope.onEvent(ReceiveQuadraticBezierCurvePointEvent, (params: { payload: Object | string | number | null }) => {
      if (this.quadraticBezierCurvePoints.length >= 3) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      this.quadraticBezierCurvePoints.push(pickedPoint);
      this.drawQuadraticBezierCurve();
    });

    scope.registerEvent(ReceiveCubicBezierCurvePointEvent);
    scope.onEvent(ReceiveCubicBezierCurvePointEvent, (params: { payload: Object | string | number | null }) => {
      if (this.cubicBezierCurvePoints.length >= 4) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      this.cubicBezierCurvePoints.push(pickedPoint);
      this.drawCubicBezierCurve();
    });
  }

  resolveLineColor() {
    if (this.drawerConfig.lineType === LineType.Solid) return RendererConfig.mesh.solidLineColor;
    if (this.drawerConfig.lineType === LineType.Dashed) return RendererConfig.mesh.dashedLineColor;
    return new Color3(0, 0, 0);
  }

  drawTwoStraightLine() {
    if (this.twoStraightLinePoints.length <= 0) return;
    const scope = this as unknown as ExtendedNamespace;

    const p = this.twoStraightLinePoints[this.twoStraightLinePoints.length - 1];
    const marker = scope.createMarker(p, RendererConfig.mesh.reflineMarkerColor);
    this.twoStraightLinePointsMesh.push(marker);

    if (this.twoStraightLinePoints.length === 2) {
      const opts = {
        scope,
        id: `Line_TwoStraightLine_${this.twoStraightLineIndex}`,
        points: this.twoStraightLinePoints,
        pointsMesh: this.twoStraightLinePointsMesh,
        color: this.resolveLineColor(),
        lineType: this.drawerConfig.lineType,
        dashAlignType: this.drawerConfig.dashAlignType,
        straightDashLength: this.drawerConfig.lineType === LineType.Dashed ? this.drawerConfig.straightDashLength : undefined,
        straightDashSize: this.drawerConfig.lineType === LineType.Dashed ? this.drawerConfig.straightDashSize : undefined,
        straightGapSize: this.drawerConfig.lineType === LineType.Dashed ? this.drawerConfig.straightGapSize : undefined,
      };

      const transaction = scope.createTransaction(TransactionType.CreateTwoStraightLine, opts);
      scope.commitTransaction(transaction);

      this.twoStraightLineIndex++;
      this.twoStraightLinePoints = [];
      this.twoStraightLinePointsMesh = [];
    }

    scope.makeSceneDirty();
  }

  drawThreeCircleCurve() {
    if (this.threeCircleCurvePoints.length <= 0) return;
    const scope = this as unknown as ExtendedNamespace;

    const p = this.threeCircleCurvePoints[this.threeCircleCurvePoints.length - 1];
    const marker = scope.createMarker(p, RendererConfig.mesh.reflineMarkerColor);
    this.threeCircleCurvePointsMesh.push(marker);

    if (this.threeCircleCurvePoints.length === 3) {
      const opts = {
        scope,
        id: `Line_ThreeCircleCurve_${this.threeCircleCurveIndex}`,
        points: this.threeCircleCurvePoints,
        pointsMesh: this.threeCircleCurvePointsMesh,
        color: this.resolveLineColor(),
        lineType: this.drawerConfig.lineType,
        dashAlignType: this.drawerConfig.dashAlignType,
        curveDashLength: this.drawerConfig.lineType === LineType.Dashed ? this.drawerConfig.curveDashLength : undefined,
        curveDashSize: this.drawerConfig.lineType === LineType.Dashed ? this.drawerConfig.curveDashSize : undefined,
        curveGapSize: this.drawerConfig.lineType === LineType.Dashed ? this.drawerConfig.curveGapSize : undefined,
      };

      const transaction = scope.createTransaction(TransactionType.CreateThreeCircleCurve, opts);
      scope.commitTransaction(transaction);

      this.threeCircleCurveIndex++;
      this.threeCircleCurvePoints = [];
      this.threeCircleCurvePointsMesh = [];
    }

    scope.makeSceneDirty();
  }

  drawQuadraticBezierCurve() {
    if (this.quadraticBezierCurvePoints.length <= 0) return;
    const scope = this as unknown as ExtendedNamespace;

    const p = this.quadraticBezierCurvePoints[this.quadraticBezierCurvePoints.length - 1];
    const marker = scope.createMarker(p, RendererConfig.mesh.reflineMarkerColor);
    this.quadraticBezierCurvePointsMesh.push(marker);

    if (this.quadraticBezierCurvePoints.length === 3) {
      const opts = {
        scope,
        id: `Line_QuadraticBezierCurve_${this.quadraticBezierCurveIndex}`,
        points: this.quadraticBezierCurvePoints,
        pointsMesh: this.quadraticBezierCurvePointsMesh,
        color: this.resolveLineColor(),
        lineType: this.drawerConfig.lineType,
        dashAlignType: this.drawerConfig.dashAlignType,
        curveDashLength: this.drawerConfig.lineType === LineType.Dashed ? this.drawerConfig.curveDashLength : undefined,
        curveDashSize: this.drawerConfig.lineType === LineType.Dashed ? this.drawerConfig.curveDashSize : undefined,
        curveGapSize: this.drawerConfig.lineType === LineType.Dashed ? this.drawerConfig.curveGapSize : undefined,
      };

      const transaction = scope.createTransaction(TransactionType.CreateQuadraticBezierCurve, opts);
      scope.commitTransaction(transaction);

      this.quadraticBezierCurveIndex++;
      this.quadraticBezierCurvePoints = [];
      this.quadraticBezierCurvePointsMesh = [];
    }

    scope.makeSceneDirty();
  }

  drawCubicBezierCurve() {
    if (this.cubicBezierCurvePoints.length <= 0) return;
    const scope = this as unknown as ExtendedNamespace;

    const p = this.cubicBezierCurvePoints[this.cubicBezierCurvePoints.length - 1];
    const marker = scope.createMarker(p, RendererConfig.mesh.reflineMarkerColor);
    this.cubicBezierCurvePointsMesh.push(marker);

    if (this.cubicBezierCurvePoints.length === 4) {
      const opts = {
        scope,
        id: `Line_CubicBezierCurve_${this.cubicBezierCurveIndex}`,
        points: this.cubicBezierCurvePoints,
        pointsMesh: this.cubicBezierCurvePointsMesh,
        color: this.resolveLineColor(),
        lineType: this.drawerConfig.lineType,
        dashAlignType: this.drawerConfig.dashAlignType,
        curveDashLength: this.drawerConfig.lineType === LineType.Dashed ? this.drawerConfig.curveDashLength : undefined,
        curveDashSize: this.drawerConfig.lineType === LineType.Dashed ? this.drawerConfig.curveDashSize : undefined,
        curveGapSize: this.drawerConfig.lineType === LineType.Dashed ? this.drawerConfig.curveGapSize : undefined,
      };

      const transaction = scope.createTransaction(TransactionType.CreateCubicBezierCurve, opts);
      scope.commitTransaction(transaction);

      this.cubicBezierCurveIndex++;
      this.cubicBezierCurvePoints = [];
      this.cubicBezierCurvePointsMesh = [];
    }

    scope.makeSceneDirty();
  }
};