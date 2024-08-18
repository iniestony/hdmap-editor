import {
  Engine,
  Scene,
  FreeCamera,
  FreeCameraMouseWheelInput,
  ArcRotateCamera,
  ArcRotateCameraPointersInput,
  ArcRotateCameraMouseWheelInput,
  HemisphericLight,
  AbstractMesh,
  Mesh,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  LinesMesh,
  Color4,
  Path3D,
  PointerEventTypes,
  Viewport,
  PointerInfo,
  Matrix,
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import { TransactionType } from '../../transactions';
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
  EnterRoadConnectionAltitudeAdaptorEvent,
  ExitRoadConnectionAltitudeAdaptorEvent,
  UpdateRoadConnectionAltitudeAxisEvent,
} from './constant';
import {
  RoadConnectionAltitudeActionMeshCategory,
  RoadConnectionAltitudeActionMeshMetadata,
} from './type';

export default class RoadConnectionAltitudeAdaptorPlugin extends LogicalPlugin {
  private wrapperElementId: string = 'hdmap-general-wrapper';
  private contextCanvasId: string = 'road_connection_altitude_canvas';
  private isNewComingRoad: boolean = true;

  private debouncedSyncAltitudeAxis: Function;

  private editingRoadConnectionItem: RoadItem | null;
  private currentActionMesh: Mesh | null;
  private currentActionMeshInitPosition: Vector3 | null;
  private actionMeshes: { [id: string]: Mesh };
  private actionMeshIndex: number;

  private contextCanvas?: HTMLCanvasElement;
  private contextEngine?: Engine;
  private contextScene?: Scene;

  private isDirty: boolean = false;
  private frameThreshold: number = 0;

  private lineMesh?: Mesh;
  private pointCloudMesh: Mesh[] = [];

  constructor(options: PluginOptions) {
    super(options);

    this.editingRoadConnectionItem = null;
    this.currentActionMesh = null;
    this.currentActionMeshInitPosition = null;
    this.actionMeshes = {};
    this.actionMeshIndex = 0;

    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    this.debouncedSyncAltitudeAxis = scope.makeDebounce(scope.syncRoadConnectionAltitudeAxis, 500);
  }

  activate() {
    super.activate();
    
    this.init();
  }

  init() {
    this.initScene();
    this.initEvent();
  }

  makeAltitudeSceneDirty() {
    this.isDirty = true;
    this.frameThreshold = 0;
  }

  initScene() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);

    this.contextCanvas = document.querySelector<HTMLCanvasElement>(`#${this.wrapperElementId} #${this.contextCanvasId}`) as HTMLCanvasElement;

    this.contextEngine = new Engine(this.contextCanvas, true, {
      preserveDrawingBuffer: true,
      stencil: true, 
      disableWebGL2Support: false
    });
    
    this.contextScene = new Scene(this.contextEngine);
    this.contextScene.clearColor = RendererConfig.scene.clearColor;

    this.startRenderLoop();
    this.initLight();
    this.initCamera();
    this.initMouse();
  }

  startRenderLoop() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);

    const contextCanvas = this.contextCanvas as HTMLCanvasElement;
    const contextEngine = this.contextEngine as Engine;
    const contextScene = this.contextScene as Scene;

    contextEngine.runRenderLoop(() => {
      if (!this.isDirty) return;

      if (contextScene.activeCamera) {
        contextScene.render();
        this.frameThreshold++;

        if (this.frameThreshold >= RendererConfig.scene.frameThreshold) {
          this.isDirty = false;
        }
      }
    });

    contextCanvas.addEventListener("resize", () => {
      contextEngine.resize();
    });
  }

  initLight() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);

    const contextEngine = this.contextEngine as Engine;
    const contextScene = this.contextScene as Scene;

    new HemisphericLight("light", RendererConfig.scene.hemisphericLightAim, contextScene);
  }

  initCamera() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    const contextScene = this.contextScene as Scene;
    const contextCanvas = this.contextCanvas as HTMLCanvasElement;

    const camera = new ArcRotateCamera(
      "Road_Connection_Altitude_Orbit_Camera",
      RendererConfig.orbitCamera.longitude,
      RendererConfig.orbitCamera.latitude,
      RendererConfig.orbitCamera.radius,
      RendererConfig.orbitCamera.target,
      contextScene,
    );

    camera.lowerAlphaLimit = RendererConfig.orbitCamera.lowerLongitude;
    camera.upperAlphaLimit = RendererConfig.orbitCamera.upperLongitude;
    camera.lowerBetaLimit = RendererConfig.orbitCamera.lowerLatitude;
    camera.upperBetaLimit = RendererConfig.orbitCamera.upperLatitude;
    camera.lowerRadiusLimit = RendererConfig.orbitCamera.lowerRadius;
    camera.upperRadiusLimit = RendererConfig.orbitCamera.upperRadius;

    camera.panningSensibility = RendererConfig.orbitCamera.panningSensibility;
    camera.inertialRadiusOffset = RendererConfig.altitude.radiusInertia;
    camera.inertia = RendererConfig.altitude.rawInertia;

    const pointersInput = camera.inputs.attached.pointers as ArcRotateCameraPointersInput;

    // no rotation
    pointersInput.angularSensibilityX = Infinity;
    pointersInput.angularSensibilityY = Infinity;

    const mouseWheelInput = camera.inputs.attached.mousewheel as ArcRotateCameraMouseWheelInput;
    mouseWheelInput.wheelDeltaPercentage = RendererConfig.altitude.wheelDeltaPercentage;
    
    camera.attachControl(false, false);

    return camera;
  }

  initMouse() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    const contextScene = this.contextScene as Scene;

    contextScene.onPointerObservable.add((pointerInfo: { type: number }) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN:
          this.onPointerDown(pointerInfo);
          break;
        case PointerEventTypes.POINTERUP:
          this.debouncedSyncAltitudeAxis(contextScene);
          this.onPointerUp(pointerInfo);
          break;
        case PointerEventTypes.POINTERMOVE:
          this.onPointerMove(pointerInfo);
          break;
        case PointerEventTypes.POINTERWHEEL:
          this.debouncedSyncAltitudeAxis(contextScene);
          break;
        case PointerEventTypes.POINTERPICK:
          break;
        case PointerEventTypes.POINTERTAP:
          this.onPointerTap(pointerInfo);
          break;
        case PointerEventTypes.POINTERDOUBLETAP:
          break;
      }

      this.makeAltitudeSceneDirty();
    });
  }

  onPointerDown(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    const rawPointerInfo = pointerInfo as PointerInfo;

    const pointerEventButton = (pointerInfo as PointerInfo).event.button;
    const isLeftButton = pointerEventButton === 0;
    const isRightButton = pointerEventButton === 2;

    const isCtrl = (pointerInfo as PointerInfo).event.ctrlKey;
    const isAlt = (pointerInfo as PointerInfo).event.altKey;
    const isShift = (pointerInfo as PointerInfo).event.shiftKey;
    
    if (isLeftButton && rawPointerInfo.pickInfo?.pickedMesh) {
      const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;

      if (pickedMesh?.metadata?.isRoadConnectionReflineAltitudeActionMesh) {
        scope.onPickActionMesh(pickedMesh as Mesh);
      }
    }
  }

  onPointerUp(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);

    scope.onUnpickActionMesh(pointerInfo as PointerInfo);
  }

  onPointerMove(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);

    scope.onOperateActionMesh(pointerInfo as PointerInfo);
  }

  onPointerTap(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    const contextScene = this.contextScene as Scene;

    const rawPointerInfo = pointerInfo as PointerInfo;

    const pointerEventButton = (pointerInfo as PointerInfo).event.button;
    const isLeftButton = pointerEventButton === 0;
    const isRightButton = pointerEventButton === 2;

    const isCtrl = (pointerInfo as PointerInfo).event.ctrlKey;
    const isAlt = (pointerInfo as PointerInfo).event.altKey;
    const isShift = (pointerInfo as PointerInfo).event.shiftKey;

    const hasActualPickedMesh = !!((pointerInfo as PointerInfo).pickInfo?.pickedMesh);

    const pickedReferenceLineItem = scope.resolveMousePickingReferenceLineItemAltitudeInfo(contextScene, pointerInfo as PointerInfo);

    if (isRightButton && hasActualPickedMesh && pickedReferenceLineItem) {
      const pickedPoint = pickedReferenceLineItem.pickedPoint;

      if (isCtrl) {
        scope.onDeliverRoadInnerRemoveCatmullPoint(pickedPoint);
      } else {
        scope.onDeliverRoadInnerAddCatmullPoint(pickedPoint);
      }
    }
  }

  onPickActionMesh(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    if (!scope.isActionMesh(pickedMesh)) return;

    scope.currentActionMesh = pickedMesh;
    scope.currentActionMeshInitPosition = pickedMesh.position;
  }

  async onOperateActionMesh(pointerInfo: PointerInfo) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    if (!scope.editingRoadConnectionItem || !scope.currentActionMesh) return;

    const alignAltitude = scope.currentActionMesh.position.y;

    const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
      altitude: alignAltitude,
    });

    if (!pickingInfo.pickedPoint) return;
    if (!scope.editingRoadConnectionItem || !scope.currentActionMesh || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;
    pickedPoint.y = alignAltitude;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) return;

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as RoadConnectionAltitudeActionMeshMetadata;
    const actionMeshIsStartCatmull = actionMeshMetadata.isStartCatmull as boolean;
    const actionMeshIsEndCatmull = actionMeshMetadata.isEndCatmull as boolean;
    const actionMeshCatmullIndex = actionMeshMetadata.catmullIndex as number;

    const oldAltitudeCatmullPoint = scope.editingRoadConnectionItem.referenceLine.altitudeCatmullPoints[actionMeshCatmullIndex];

    let meshPoint = pickedPoint;

    if (actionMeshIsStartCatmull || actionMeshIsEndCatmull) {
      meshPoint = new Vector3(oldAltitudeCatmullPoint.x, pickedPoint.y, pickedPoint.z);
    } else {
      meshPoint = pickedPoint;
    }

    scope.updateActionMesh(actionMesh.id, meshPoint);
  }

  async onUnpickActionMesh(pointerInfo: PointerInfo) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    if (!scope.editingRoadConnectionItem || !scope.currentActionMesh) return;

    const alignAltitude = scope.currentActionMesh.position.y;

    const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
      altitude: alignAltitude,
    });

    if (!pickingInfo.pickedPoint) return;
    if (!scope.editingRoadConnectionItem || !scope.currentActionMesh || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;
    pickedPoint.y = alignAltitude;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) {
      scope.currentActionMesh = null;
      scope.currentActionMeshInitPosition = null;

      return;
    }

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as RoadConnectionAltitudeActionMeshMetadata;
    const actionMeshIsStartCatmull = actionMeshMetadata.isStartCatmull as boolean;
    const actionMeshIsEndCatmull = actionMeshMetadata.isEndCatmull as boolean;
    const actionMeshCatmullIndex = actionMeshMetadata.catmullIndex as number;

    const altitudeCatmullPoints = (actionMeshMetadata.relatedRefLine as ReferenceLineItem).altitudeCatmullPoints;
    const altitudeCatmullTangents = (actionMeshMetadata.relatedRefLine as ReferenceLineItem).altitudeCatmullTangents;

    const oldAltitudeCatmullPoint = scope.editingRoadConnectionItem.referenceLine.altitudeCatmullPoints[actionMeshCatmullIndex];

    let newAltitudeCatmullPoint = pickedPoint;

    if (actionMeshIsStartCatmull || actionMeshIsEndCatmull) {
      newAltitudeCatmullPoint = new Vector3(oldAltitudeCatmullPoint.x, pickedPoint.y, pickedPoint.z);
    } else {
      newAltitudeCatmullPoint = pickedPoint;
    }

    const newRefLineAltitudeCatmullPoints = [...altitudeCatmullPoints];
    newRefLineAltitudeCatmullPoints.splice(actionMeshCatmullIndex, 1, newAltitudeCatmullPoint);

    const newRefLineAltitudeCatmullTangents = [...altitudeCatmullTangents];

    // determine transaction
    let isCompMode = false;
    const compRoads = [] as Array<{
      roadId: string;
      roadCategory: RoadCategory;
      isStart: boolean;
    }>;

    if (!actionMeshIsStartCatmull && !actionMeshIsEndCatmull) {
      isCompMode = false;
    } else {
      const tempSeriePoints = (actionMeshMetadata.relatedRefLine as ReferenceLineItem).seriePoints;
      const targetSeriePoint = actionMeshIsStartCatmull ? tempSeriePoints[0] : tempSeriePoints[tempSeriePoints.length - 1];

      const connectedRoads = [...scope.editingRoadConnectionItem.prevRoads].concat([...scope.editingRoadConnectionItem.nextRoads]);

      for (let i = 0; i < connectedRoads.length; i++) {
        const roadItem = scope.resolveRoadByRoadIdAndRoadCategory(connectedRoads[i].roadId, connectedRoads[i].roadCategory) as RoadItem;
        const reflineSeriePoints = roadItem.referenceLine.seriePoints;

        if (scope.isGeoConnectedPoint(targetSeriePoint, reflineSeriePoints[0])) {
          compRoads.push({
            roadId: connectedRoads[i].roadId,
            roadCategory: connectedRoads[i].roadCategory,
            isStart: true,
          });
        } else if (scope.isGeoConnectedPoint(targetSeriePoint, reflineSeriePoints[reflineSeriePoints.length - 1])) {
          compRoads.push({
            roadId: connectedRoads[i].roadId,
            roadCategory: connectedRoads[i].roadCategory,
            isStart: false,
          });
        }
      }

      if (compRoads.length > 0) {
        isCompMode = true;
      }
    }

    if (isCompMode) {
      const opts = {
        scope,
        newRefLineAltitudeCatmullPoints,
        newRefLineAltitudeCatmullTangents,
        isStartCatmull: actionMeshIsStartCatmull,
        isEndCatmull: actionMeshIsEndCatmull,
        roadId: scope.editingRoadConnectionItem.roadId,
        roadCategory: scope.editingRoadConnectionItem.category,
        compRoads,
      };

      const transaction = scope.createTransaction(TransactionType.CatmullAltitudeReformatConnectionRoadComp, opts);
      scope.commitTransaction(transaction);
    } else {
      const opts = {
        scope,
        newRefLineAltitudeCatmullPoints,
        newRefLineAltitudeCatmullTangents,
        isStartCatmull: actionMeshIsStartCatmull,
        isEndCatmull: actionMeshIsEndCatmull,
        roadId: scope.editingRoadConnectionItem.roadId,
        roadCategory: scope.editingRoadConnectionItem.category,
      };

      const transaction = scope.createTransaction(TransactionType.CatmullAltitudeReformatConnectionRoad, opts);
      scope.commitTransaction(transaction);
    }

    // clear after one down-move-up loop, actionMesh is active only in every loop
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
  }

  onDeliverRoadInnerAddCatmullPoint(pickedPoint: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    if (!scope.editingRoadConnectionItem || !pickedPoint) return;

    const oldAltitudeSeriePoints = scope.calculateReflineAltitudeSeriePoints(scope.editingRoadConnectionItem.referenceLine);
    const virtualPointPostion = scope.resolveNearestVirtualPointPositionViaLineSeriePoints(oldAltitudeSeriePoints, pickedPoint);
    const virtualPoint = scope.resolveNearestVirtualPointViaLineSeriePoints(oldAltitudeSeriePoints, pickedPoint);

    const oldAltitudeCatmullPoints = scope.editingRoadConnectionItem.referenceLine.altitudeCatmullPoints;
    const oldAltitudeCatmullPointsPosition = oldAltitudeCatmullPoints.map((v: Vector3) => {
      return scope.resolveNearestVirtualPointPositionViaLineSeriePoints(oldAltitudeSeriePoints, v);
    });

    const oldAltitudeCatmullTangents = scope.editingRoadConnectionItem.referenceLine.altitudeCatmullTangents;

    const sameAltitudeCatmullPointIdx = oldAltitudeCatmullPointsPosition.findIndex((v: number) => {
      return Math.abs(v - virtualPointPostion) <= RendererConfig.scene.minimumGeoPositionDiffAmount;
    });
    if (sameAltitudeCatmullPointIdx > 0) return;

    const nextAltitudeCatmullPointIdx = oldAltitudeCatmullPointsPosition.findIndex((v: number) => {
      return v > virtualPointPostion;
    });
    if (nextAltitudeCatmullPointIdx <= 0) return;

    const newRefLineAltitudeCatmullPoints = [...oldAltitudeCatmullPoints];
    newRefLineAltitudeCatmullPoints.splice(nextAltitudeCatmullPointIdx, 0, virtualPoint);

    const generatedRawCatmullTangents = scope.generateHermiteSerieLineCatmullTangentsViaCatmullPoints(newRefLineAltitudeCatmullPoints);
    const targetTangent = generatedRawCatmullTangents[nextAltitudeCatmullPointIdx];

    const newRefLineAltitudeCatmullTangents = [...oldAltitudeCatmullTangents];
    newRefLineAltitudeCatmullTangents.splice(nextAltitudeCatmullPointIdx, 0, targetTangent);

    const opts = {
      scope,
      newRefLineAltitudeCatmullPoints,
      newRefLineAltitudeCatmullTangents,
      isStartCatmull: false,
      isEndCatmull: false,
      roadId: scope.editingRoadConnectionItem.roadId,
      roadCategory: scope.editingRoadConnectionItem.category,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullAltitudeReformatConnectionRoad, opts);
    scope.commitTransaction(transaction);
  }

  onDeliverRoadInnerRemoveCatmullPoint(pickedPoint: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    if (!scope.editingRoadConnectionItem || !pickedPoint) return;

    const oldAltitudeCatmullPoints = scope.editingRoadConnectionItem.referenceLine.altitudeCatmullPoints;
    const oldAltitudeCatmullTangents = scope.editingRoadConnectionItem.referenceLine.altitudeCatmullTangents;

    const sameAltitudeCatmullPointIdx = oldAltitudeCatmullPoints.findIndex((v: Vector3) => {
      return v.subtract(pickedPoint).length() <= RendererConfig.scene.maximumSameCatmullPointDistance;
    });
    if (sameAltitudeCatmullPointIdx < 0) return;

    // not first nor last
    if (sameAltitudeCatmullPointIdx === 0 || sameAltitudeCatmullPointIdx === oldAltitudeCatmullPoints.length - 1) {
      scope.notifyInfo('不可删除首尾高程控制点');
      return;
    }

    const newRefLineAltitudeCatmullPoints = [...oldAltitudeCatmullPoints];
    newRefLineAltitudeCatmullPoints.splice(sameAltitudeCatmullPointIdx, 1);

    const newRefLineAltitudeCatmullTangents = [...oldAltitudeCatmullTangents];
    newRefLineAltitudeCatmullTangents.splice(sameAltitudeCatmullPointIdx, 1);

    const opts = {
      scope,
      newRefLineAltitudeCatmullPoints,
      newRefLineAltitudeCatmullTangents,
      isStartCatmull: false,
      isEndCatmull: false,
      roadId: scope.editingRoadConnectionItem.roadId,
      roadCategory: scope.editingRoadConnectionItem.category,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullAltitudeReformatConnectionRoad, opts);
    scope.commitTransaction(transaction);
  }

  initEvent() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);

    scope.registerEvent(EnterRoadConnectionAltitudeAdaptorEvent);
    scope.onEvent(EnterRoadConnectionAltitudeAdaptorEvent, (params: { payload: Object | string | number | null }) => {
      const comingRoadItem = (params.payload as { roadItem: RoadItem }).roadItem;

      if (!scope.editingRoadConnectionItem) {
        this.isNewComingRoad = true;
      } else if (scope.editingRoadConnectionItem.roadId === comingRoadItem.roadId && scope.editingRoadConnectionItem.category === comingRoadItem.category) {
        this.isNewComingRoad = false;
      } else {
        this.isNewComingRoad = true;
      }

      scope.undecorateRoadItemAltitude();
      scope.editingRoadConnectionItem = comingRoadItem;
      scope.decorateRoadItemAltitude();
    });

    scope.registerEvent(ExitRoadConnectionAltitudeAdaptorEvent);
    scope.onEvent(ExitRoadConnectionAltitudeAdaptorEvent, (params: { payload: Object | string | number | null }) => {
      scope.undecorateRoadItemAltitude();
    });

    scope.registerEvent(UpdateRoadConnectionAltitudeAxisEvent);
  }

  isActionMesh(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    if (!scope.editingRoadConnectionItem) return false;

    return !!(pickedMesh?.metadata?.isRoadConnectionReflineAltitudeActionMesh);
  }

  createActionMesh(
    point: Vector3,
    color: Color3,
    category: RoadConnectionAltitudeActionMeshCategory,
    extra: {
      relatedRefLine?: ReferenceLineItem;
      relatedLaneLine?: LaneLineItem;
      relatedLane?: LaneItem;
      isStartCatmull?: boolean;
      isEndCatmull?: boolean;
      catmullIndex?: number;
    },
  ) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    const contextScene = this.contextScene as Scene;

    const id = `Road_Connection_Altitude_Action_Mesh_${scope.actionMeshIndex}`;
    const actionMesh = scope.createAltitudeMarker(contextScene, point, color, id) as Mesh;
    actionMesh.metadata = {
      isRoadConnectionReflineAltitudeActionMesh: true,
      point,
      color,
      category,
      relatedRefLine: extra.relatedRefLine,
      relatedLaneLine: extra.relatedLaneLine,
      relatedLane: extra.relatedLane,
      isStartCatmull: extra.isStartCatmull,
      isEndCatmull: extra.isEndCatmull,
      catmullIndex: extra.catmullIndex,
    } as RoadConnectionAltitudeActionMeshMetadata;

    scope.actionMeshIndex++;
    scope.actionMeshes[id] = actionMesh;

    scope.makeAltitudeSceneDirty();
  }

  updateActionMesh(id: string, point: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    const contextScene = this.contextScene as Scene;

    const oldMesh = scope.actionMeshes[id];
    if (!oldMesh) return;
    const oldMetadata = oldMesh.metadata as RoadConnectionAltitudeActionMeshMetadata;

    const actionMesh = scope.createAltitudeMarker(contextScene, point, oldMetadata.color, id) as Mesh;
    actionMesh.metadata = {
      isRoadConnectionReflineAltitudeActionMesh: true,
      point,
      color: oldMetadata.color,
      category: oldMetadata.category,
      relatedRefLine: oldMetadata.relatedRefLine,
      relatedLaneLine: oldMetadata.relatedLaneLine,
      relatedLane: oldMetadata.relatedLane,
      isStartCatmull: oldMetadata.isStartCatmull,
      isEndCatmull: oldMetadata.isEndCatmull,
      catmullIndex: oldMetadata.catmullIndex,
    } as RoadConnectionAltitudeActionMeshMetadata;

    oldMesh.dispose();

    scope.currentActionMesh = actionMesh;
    scope.actionMeshes[id] = actionMesh;

    scope.makeAltitudeSceneDirty();
  }

  undecorateRoadItemAltitude() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    const contextScene = this.contextScene as Scene;

    // line
    if (this.lineMesh) {
      this.lineMesh.dispose();
      this.lineMesh = undefined;
    }

    // points
    const ids = Object.keys(scope.actionMeshes);
    ids.forEach((id: string) => {
      scope.actionMeshes[id].dispose();
    });

    scope.editingRoadConnectionItem = null;
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
    scope.actionMeshes = {};

    scope.makeAltitudeSceneDirty();
  }

  async decorateRoadItemAltitude() {
    const scope = this as unknown as (ExtendedNamespace & RoadConnectionAltitudeAdaptorPlugin);
    if (!scope.editingRoadConnectionItem) return;

    const contextScene = this.contextScene as Scene;

    const reflineItem = scope.editingRoadConnectionItem.referenceLine;
    const seriePoints = scope.calculateReflineAltitudeSeriePoints(reflineItem);

    if (this.isNewComingRoad) {
      this.pointCloudMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      this.pointCloudMesh = await scope.drawRoadAltitudePointCloud(contextScene, scope.editingRoadConnectionItem);
      
      scope.syncAltitudeCamera(contextScene, seriePoints);
      this.debouncedSyncAltitudeAxis(contextScene);
    }

    // line
    this.lineMesh = scope.drawRoadAltitudeTrendLine(contextScene, seriePoints, reflineItem, scope.editingRoadConnectionItem);

    // points
    const altitudeCatmullPoints = [...reflineItem.altitudeCatmullPoints];
    const numAltitudeCatmullPoints = altitudeCatmullPoints.length;

    altitudeCatmullPoints.forEach((p: Vector3, catmullIndex: number) => {
      scope.createActionMesh(
        p,
        RendererConfig.mesh.reflineMarkerColor,
        RoadConnectionAltitudeActionMeshCategory.RefLineAltitudeCatmullReformat,
        {
          relatedRefLine: reflineItem,
          isStartCatmull: catmullIndex === 0,
          isEndCatmull: catmullIndex === numAltitudeCatmullPoints - 1,
          catmullIndex: catmullIndex,
        },
      );
    });

    scope.makeAltitudeSceneDirty();
  }
};