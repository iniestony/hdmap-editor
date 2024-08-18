import {
  Vector3,
  Color3,
  Mesh,
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import { DisposeRoadMarkerEvent } from '../statusManager/constant';
import { DisposeRoadMarkerOpt } from '../statusManager/type';
import { TransactionType } from '../../transactions';
import {
  LineType,
} from '../lineDrawer/type';
import {
  RoadDrawerConfig,
} from './type';
import {
  AlterRoadDrawerConfigEvent,
  FetchRoadDrawerConfigEvent,
  ReceiveTwoStraightLineRoadPointEvent,
  ReceiveThreeCircleCurveRoadPointEvent,
  ReceiveQuadraticBezierCurveRoadPointEvent,
  ReceiveCubicBezierCurveRoadPointEvent,
  ReceiveCatmullSerieRoadPointEvent,
} from './constant';

export default class RoadDrawerPlugin extends LogicalPlugin {
  private drawerConfig: RoadDrawerConfig;

  private twoStraightLineRoadPoints: Vector3[];
  private twoStraightLineRoadPointsMesh: Mesh[];

  private threeCircleCurveRoadPoints: Vector3[];
  private threeCircleCurveRoadPointsMesh: Mesh[];

  private quadraticBezierCurveRoadPoints: Vector3[];
  private quadraticBezierCurveRoadPointsMesh: Mesh[];

  private cubicBezierCurveRoadPoints: Vector3[];
  private cubicBezierCurveRoadPointsMesh: Mesh[];

  private catmullSerieRoadPoints: Vector3[];
  private catmullSerieRoadPointsMesh: Mesh[];


  constructor(options: PluginOptions) {
    super(options);

    this.drawerConfig = {
      laneWidth: RendererConfig.mesh.defaultLaneWidth,
    };

    this.twoStraightLineRoadPoints = [];
    this.twoStraightLineRoadPointsMesh = [];

    this.threeCircleCurveRoadPoints = [];
    this.threeCircleCurveRoadPointsMesh = [];

    this.quadraticBezierCurveRoadPoints = [];
    this.quadraticBezierCurveRoadPointsMesh = [];

    this.cubicBezierCurveRoadPoints = [];
    this.cubicBezierCurveRoadPointsMesh = [];

    this.catmullSerieRoadPoints = [];
    this.catmullSerieRoadPointsMesh = [];
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

    scope.registerEvent(AlterRoadDrawerConfigEvent);
    scope.onEvent(AlterRoadDrawerConfigEvent, (params: { payload: Partial<RoadDrawerConfig> }) => {
      this.drawerConfig = { ...this.drawerConfig, ...params.payload };
    });

    scope.registerEvent(FetchRoadDrawerConfigEvent);
    scope.onEvent(FetchRoadDrawerConfigEvent, (params: { payload: { callback: Function } }) => {
      params.payload.callback(this.drawerConfig);
    });
  }

  initDisposeEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.onEvent(DisposeRoadMarkerEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as DisposeRoadMarkerOpt;

      if (payload.twoStraightLineRoadTemp) {
        this.twoStraightLineRoadPointsMesh.forEach((item: Mesh) => {
          item.dispose();
          scope.makeSceneDirty();
        });
  
        this.twoStraightLineRoadPoints = [];
        this.twoStraightLineRoadPointsMesh = [];
      }

      if (payload.threeCircleCurveRoadTemp) {
        this.threeCircleCurveRoadPointsMesh.forEach((item: Mesh) => {
          item.dispose();
          scope.makeSceneDirty();
        });
  
        this.threeCircleCurveRoadPoints = [];
        this.threeCircleCurveRoadPointsMesh = [];
      }

      if (payload.quadraticBezierCurveRoadTemp) {
        this.quadraticBezierCurveRoadPointsMesh.forEach((item: Mesh) => {
          item.dispose();
          scope.makeSceneDirty();
        });
  
        this.quadraticBezierCurveRoadPoints = [];
        this.quadraticBezierCurveRoadPointsMesh = [];
      }

      if (payload.cubicBezierCurveRoadTemp) {
        this.cubicBezierCurveRoadPointsMesh.forEach((item: Mesh) => {
          item.dispose();
          scope.makeSceneDirty();
        });
  
        this.cubicBezierCurveRoadPoints = [];
        this.cubicBezierCurveRoadPointsMesh = [];
      }

      if (payload.catmullSerieRoadTemp) {
        this.catmullSerieRoadPointsMesh.forEach((item: Mesh) => {
          item.dispose();
          scope.makeSceneDirty();
        });
  
        this.catmullSerieRoadPoints = [];
        this.catmullSerieRoadPointsMesh = [];
      }
    });
  }

  initReceivePointEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(ReceiveTwoStraightLineRoadPointEvent);
    scope.onEvent(ReceiveTwoStraightLineRoadPointEvent, (params: { payload: Object | string | number | null }) => {
      if (this.twoStraightLineRoadPoints.length >= 2) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      this.twoStraightLineRoadPoints.push(pickedPoint);
      this.drawTwoStraightLineRoad();
    });

    scope.registerEvent(ReceiveThreeCircleCurveRoadPointEvent);
    scope.onEvent(ReceiveThreeCircleCurveRoadPointEvent, (params: { payload: Object | string | number | null }) => {
      if (this.threeCircleCurveRoadPoints.length >= 3) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      this.threeCircleCurveRoadPoints.push(pickedPoint);
      this.drawThreeCircleCurveRoad();
    });

    scope.registerEvent(ReceiveQuadraticBezierCurveRoadPointEvent);
    scope.onEvent(ReceiveQuadraticBezierCurveRoadPointEvent, (params: { payload: Object | string | number | null }) => {
      if (this.quadraticBezierCurveRoadPoints.length >= 3) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      this.quadraticBezierCurveRoadPoints.push(pickedPoint);
      this.drawQuadraticBezierCurveRoad();
    });

    scope.registerEvent(ReceiveCubicBezierCurveRoadPointEvent);
    scope.onEvent(ReceiveCubicBezierCurveRoadPointEvent, (params: { payload: Object | string | number | null }) => {
      if (this.cubicBezierCurveRoadPoints.length >= 4) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      this.cubicBezierCurveRoadPoints.push(pickedPoint);
      this.drawCubicBezierCurveRoad();
    });

    scope.registerEvent(ReceiveCatmullSerieRoadPointEvent);
    scope.onEvent(ReceiveCatmullSerieRoadPointEvent, (params: { payload: Object | string | number | null }) => {
      if (this.catmullSerieRoadPoints.length >= 2) return;

      const pickedPoint = (params.payload as { pickedPoint: Vector3 }).pickedPoint;
      this.catmullSerieRoadPoints.push(pickedPoint);
      this.drawCatmullSerieRoad();
    });
  }

  drawTwoStraightLineRoad() {
    if (this.twoStraightLineRoadPoints.length <= 0) return;
    const scope = this as unknown as ExtendedNamespace;

    const p = this.twoStraightLineRoadPoints[this.twoStraightLineRoadPoints.length - 1];
    const marker = scope.createMarker(p, RendererConfig.mesh.reflineMarkerColor);
    this.twoStraightLineRoadPointsMesh.push(marker);

    if (this.twoStraightLineRoadPoints.length === 2) {
      const opts = {
        scope,
        id: scope.resolveNextCandidateEntityId(),
        points: this.twoStraightLineRoadPoints,
        pointsMesh: this.twoStraightLineRoadPointsMesh,
        referenceLineColor: RendererConfig.mesh.solidLineColor,
        referenceLineType: LineType.Solid,
        laneLineColor: RendererConfig.mesh.solidLineColor,
        laneLineType: LineType.Solid,
        laneWidth: this.drawerConfig.laneWidth,
      };

      const transaction = scope.createTransaction(TransactionType.CreateTwoStraightLineRoad, opts);
      const roadItem = scope.commitTransaction(transaction).entity;
      scope.enterEditRoad(roadItem);

      this.twoStraightLineRoadPoints = [];
      this.twoStraightLineRoadPointsMesh = [];
    }

    scope.makeSceneDirty();
  }

  drawThreeCircleCurveRoad() {
    if (this.threeCircleCurveRoadPoints.length <= 0) return;
    const scope = this as unknown as ExtendedNamespace;

    const p = this.threeCircleCurveRoadPoints[this.threeCircleCurveRoadPoints.length - 1];
    const marker = scope.createMarker(p, RendererConfig.mesh.reflineMarkerColor);
    this.threeCircleCurveRoadPointsMesh.push(marker);

    if (this.threeCircleCurveRoadPoints.length === 3) {
      const opts = {
        scope,
        id: scope.resolveNextCandidateEntityId(),
        points: this.threeCircleCurveRoadPoints,
        pointsMesh: this.threeCircleCurveRoadPointsMesh,
        referenceLineColor: RendererConfig.mesh.solidLineColor,
        referenceLineType: LineType.Solid,
        laneLineColor: RendererConfig.mesh.solidLineColor,
        laneLineType: LineType.Solid,
        laneWidth: this.drawerConfig.laneWidth,
      };

      const transaction = scope.createTransaction(TransactionType.CreateThreeCircleCurveRoad, opts);
      const roadItem = scope.commitTransaction(transaction).entity;
      scope.enterEditRoad(roadItem);

      this.threeCircleCurveRoadPoints = [];
      this.threeCircleCurveRoadPointsMesh = [];
    }

    scope.makeSceneDirty();
  }

  drawQuadraticBezierCurveRoad() {
    if (this.quadraticBezierCurveRoadPoints.length <= 0) return;
    const scope = this as unknown as ExtendedNamespace;

    const p = this.quadraticBezierCurveRoadPoints[this.quadraticBezierCurveRoadPoints.length - 1];
    const marker = scope.createMarker(p, RendererConfig.mesh.reflineMarkerColor);
    this.quadraticBezierCurveRoadPointsMesh.push(marker);

    if (this.quadraticBezierCurveRoadPoints.length === 3) {
      const opts = {
        scope,
        id: scope.resolveNextCandidateEntityId(),
        points: this.quadraticBezierCurveRoadPoints,
        pointsMesh: this.quadraticBezierCurveRoadPointsMesh,
        referenceLineColor: RendererConfig.mesh.solidLineColor,
        referenceLineType: LineType.Solid,
        laneLineColor: RendererConfig.mesh.solidLineColor,
        laneLineType: LineType.Solid,
        laneWidth: this.drawerConfig.laneWidth,
      };

      const transaction = scope.createTransaction(TransactionType.CreateQuadraticBezierCurveRoad, opts);
      const roadItem = scope.commitTransaction(transaction).entity;
      scope.enterEditRoad(roadItem);

      this.quadraticBezierCurveRoadPoints = [];
      this.quadraticBezierCurveRoadPointsMesh = [];
    }

    scope.makeSceneDirty();
  }

  drawCubicBezierCurveRoad() {
    if (this.cubicBezierCurveRoadPoints.length <= 0) return;
    const scope = this as unknown as ExtendedNamespace;

    const p = this.cubicBezierCurveRoadPoints[this.cubicBezierCurveRoadPoints.length - 1];
    const marker = scope.createMarker(p, RendererConfig.mesh.reflineMarkerColor);
    this.cubicBezierCurveRoadPointsMesh.push(marker);

    if (this.cubicBezierCurveRoadPoints.length === 4) {
      const opts = {
        scope,
        id: scope.resolveNextCandidateEntityId(),
        points: this.cubicBezierCurveRoadPoints,
        pointsMesh: this.cubicBezierCurveRoadPointsMesh,
        referenceLineColor: RendererConfig.mesh.solidLineColor,
        referenceLineType: LineType.Solid,
        laneLineColor: RendererConfig.mesh.solidLineColor,
        laneLineType: LineType.Solid,
        laneWidth: this.drawerConfig.laneWidth,
      };

      const transaction = scope.createTransaction(TransactionType.CreateCubicBezierCurveRoad, opts);
      const roadItem = scope.commitTransaction(transaction).entity;
      scope.enterEditRoad(roadItem);

      this.cubicBezierCurveRoadPoints = [];
      this.cubicBezierCurveRoadPointsMesh = [];
    }

    scope.makeSceneDirty();
  }

  drawCatmullSerieRoad() {
    if (this.catmullSerieRoadPoints.length <= 0) return;
    const scope = this as unknown as ExtendedNamespace;

    const p = this.catmullSerieRoadPoints[this.catmullSerieRoadPoints.length - 1];
    const marker = scope.createMarker(p, RendererConfig.mesh.reflineMarkerColor);
    this.catmullSerieRoadPointsMesh.push(marker);

    if (this.catmullSerieRoadPoints.length === 2) {
      const opts = {
        scope,
        id: scope.resolveNextCandidateEntityId(),
        points: this.catmullSerieRoadPoints,
        pointsMesh: this.catmullSerieRoadPointsMesh,
        referenceLineColor: RendererConfig.mesh.solidLineColor,
        referenceLineType: LineType.Solid,
        laneLineColor: RendererConfig.mesh.solidLineColor,
        laneLineType: LineType.Solid,
        laneWidth: this.drawerConfig.laneWidth,
      };

      const transaction = scope.createTransaction(TransactionType.CreateCatmullSerieRoad, opts);
      const roadItem = scope.commitTransaction(transaction).entity;
      scope.enterEditRoad(roadItem);

      this.catmullSerieRoadPoints = [];
      this.catmullSerieRoadPointsMesh = [];
    }

    scope.makeSceneDirty();
  }
};