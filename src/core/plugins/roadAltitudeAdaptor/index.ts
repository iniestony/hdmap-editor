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
import { JunctionVertexCategory } from '../junctionDrawer/type';
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
  JunctionItem,
  JunctionEdgeItem,
} from '../statusManager/type';
import {
  EnterRoadAltitudeAdaptorEvent,
  ExitRoadAltitudeAdaptorEvent,
  UpdateRoadAltitudeAxisEvent,
} from './constant';
import {
  RoadAltitudeActionMeshCategory,
  RoadAltitudeActionMeshMetadata,
} from './type';

export default class RoadAltitudeAdaptorPlugin extends LogicalPlugin {
  private wrapperElementId: string = 'hdmap-general-wrapper';
  private contextCanvasId: string = 'road_altitude_canvas';
  private isNewComingRoad: boolean = true;

  private debouncedSyncAltitudeAxis: Function;

  private editingRoadItem: RoadItem | null;
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

    this.editingRoadItem = null;
    this.currentActionMesh = null;
    this.currentActionMeshInitPosition = null;
    this.actionMeshes = {};
    this.actionMeshIndex = 0;

    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
    this.debouncedSyncAltitudeAxis = scope.makeDebounce(scope.syncRoadAltitudeAxis, 500);
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
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);

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
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);

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
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);

    const contextEngine = this.contextEngine as Engine;
    const contextScene = this.contextScene as Scene;

    new HemisphericLight("light", RendererConfig.scene.hemisphericLightAim, contextScene);
  }

  initCamera() {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
    const contextScene = this.contextScene as Scene;
    const contextCanvas = this.contextCanvas as HTMLCanvasElement;

    const camera = new ArcRotateCamera(
      "Road_Altitude_Orbit_Camera",
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
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
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
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
    const rawPointerInfo = pointerInfo as PointerInfo;

    const pointerEventButton = (pointerInfo as PointerInfo).event.button;
    const isLeftButton = pointerEventButton === 0;
    const isRightButton = pointerEventButton === 2;

    const isCtrl = (pointerInfo as PointerInfo).event.ctrlKey;
    const isAlt = (pointerInfo as PointerInfo).event.altKey;
    const isShift = (pointerInfo as PointerInfo).event.shiftKey;
    
    if (isLeftButton && rawPointerInfo.pickInfo?.pickedMesh) {
      const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;

      if (pickedMesh?.metadata?.isRoadReflineAltitudeActionMesh) {
        scope.onPickActionMesh(pickedMesh as Mesh);
      }
    }
  }

  onPointerUp(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);

    scope.onUnpickActionMesh(pointerInfo as PointerInfo);
  }

  onPointerMove(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);

    scope.onOperateActionMesh(pointerInfo as PointerInfo);
  }

  onPointerTap(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
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
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
    if (!scope.isActionMesh(pickedMesh)) return;

    scope.currentActionMesh = pickedMesh;
    scope.currentActionMeshInitPosition = pickedMesh.position;
  }

  async onOperateActionMesh(pointerInfo: PointerInfo) {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
    if (!scope.editingRoadItem || !scope.currentActionMesh) return;

    const alignAltitude = scope.currentActionMesh.position.y;

    const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
      altitude: alignAltitude,
    });

    if (!pickingInfo.pickedPoint) return;
    if (!scope.editingRoadItem || !scope.currentActionMesh || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;
    pickedPoint.y = alignAltitude;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) return;

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as RoadAltitudeActionMeshMetadata;
    const actionMeshIsStartCatmull = actionMeshMetadata.isStartCatmull as boolean;
    const actionMeshIsEndCatmull = actionMeshMetadata.isEndCatmull as boolean;
    const actionMeshCatmullIndex = actionMeshMetadata.catmullIndex as number;

    const oldAltitudeCatmullPoint = scope.editingRoadItem.referenceLine.altitudeCatmullPoints[actionMeshCatmullIndex];

    let meshPoint = pickedPoint;

    if (actionMeshIsStartCatmull || actionMeshIsEndCatmull) {
      meshPoint = new Vector3(oldAltitudeCatmullPoint.x, pickedPoint.y, pickedPoint.z);
    } else {
      meshPoint = pickedPoint;
    }

    scope.updateActionMesh(actionMesh.id, meshPoint);
  }

  async onUnpickActionMesh(pointerInfo: PointerInfo) {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
    if (!scope.editingRoadItem || !scope.currentActionMesh) return;

    const alignAltitude = scope.currentActionMesh.position.y;

    const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
      altitude: alignAltitude,
    });

    if (!pickingInfo.pickedPoint) return;
    if (!scope.editingRoadItem || !scope.currentActionMesh || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;
    pickedPoint.y = alignAltitude;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) {
      scope.currentActionMesh = null;
      scope.currentActionMeshInitPosition = null;

      return;
    }

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as RoadAltitudeActionMeshMetadata;
    const actionMeshIsStartCatmull = actionMeshMetadata.isStartCatmull as boolean;
    const actionMeshIsEndCatmull = actionMeshMetadata.isEndCatmull as boolean;
    const actionMeshCatmullIndex = actionMeshMetadata.catmullIndex as number;

    const altitudeCatmullPoints = (actionMeshMetadata.relatedRefLine as ReferenceLineItem).altitudeCatmullPoints;
    const altitudeCatmullTangents = (actionMeshMetadata.relatedRefLine as ReferenceLineItem).altitudeCatmullTangents;

    const oldAltitudeCatmullPoint = scope.editingRoadItem.referenceLine.altitudeCatmullPoints[actionMeshCatmullIndex];

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

    const compJunctions = [] as Array<{
      junctionId: string;
      edges: Array<{
        edgeId: string;
        isStart: boolean;
        relatedRoadId: string;
        relatedRoadCategory: RoadCategory;
        isRelatedRoadStart: boolean;
        isRelatedRoadLeftMost: boolean;
      }>;
    }>;

    if (!actionMeshIsStartCatmull && !actionMeshIsEndCatmull) {
      isCompMode = false;
    } else {
      // roads
      const tempSeriePoints = (actionMeshMetadata.relatedRefLine as ReferenceLineItem).seriePoints;
      const targetSeriePoint = actionMeshIsStartCatmull ? tempSeriePoints[0] : tempSeriePoints[tempSeriePoints.length - 1];

      const connectedRoads = [...scope.editingRoadItem.prevRoads].concat([...scope.editingRoadItem.nextRoads]);

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

        if (roadItem.junctionId) {
          const junctionItem = scope.resolveJunctionByJunctionId(roadItem.junctionId) as JunctionItem;

          const isExist = compJunctions.find((j: {
            junctionId: string;
          }) => {
            return j.junctionId === junctionItem.junctionId;
          });

          if (!isExist) {
            compJunctions.push({
              junctionId: junctionItem.junctionId,
              edges: [],
            });
          }
        }
      }

      // junctions
      const roadConnectorPoints = scope.resolveRoadConnectorPoints({
        roadId: scope.editingRoadItem.roadId,
        roadCategory: scope.editingRoadItem.category,
        junctionVertexCategory: actionMeshIsStartCatmull ? JunctionVertexCategory.RoadStart : JunctionVertexCategory.RoadEnd,
      });

      const leftMostPoint = roadConnectorPoints[0].point as Vector3;
      const rightMostPoint = roadConnectorPoints[1].point as Vector3;

      compJunctions.forEach((j: {
        junctionId: string;
        edges: Array<{
          edgeId: string;
          isStart: boolean;
          relatedRoadId: string;
          relatedRoadCategory: RoadCategory;
          isRelatedRoadStart: boolean;
          isRelatedRoadLeftMost: boolean;
        }>;
      }) => {
        const junctionItem = scope.resolveJunctionByJunctionId(j.junctionId) as JunctionItem;
        
        junctionItem.edges.forEach((junctionEdgeItem: JunctionEdgeItem) => {
          const junctionEdgeItemSeriePoints = junctionEdgeItem.seriePoints;

          if (scope.isGeoConnectedPoint(leftMostPoint, junctionEdgeItemSeriePoints[0])) {
            j.edges.push({
              edgeId: junctionEdgeItem.edgeId,
              isStart: true,
              relatedRoadId: (scope.editingRoadItem as RoadItem).roadId,
              relatedRoadCategory: (scope.editingRoadItem as RoadItem).category,
              isRelatedRoadStart: actionMeshIsStartCatmull,
              isRelatedRoadLeftMost: true,
            });
          } else if (scope.isGeoConnectedPoint(rightMostPoint, junctionEdgeItemSeriePoints[0])) {
            j.edges.push({
              edgeId: junctionEdgeItem.edgeId,
              isStart: true,
              relatedRoadId: (scope.editingRoadItem as RoadItem).roadId,
              relatedRoadCategory: (scope.editingRoadItem as RoadItem).category,
              isRelatedRoadStart: actionMeshIsStartCatmull,
              isRelatedRoadLeftMost: false,
            });
          } else if (scope.isGeoConnectedPoint(leftMostPoint, junctionEdgeItemSeriePoints[junctionEdgeItemSeriePoints.length - 1])) {
            j.edges.push({
              edgeId: junctionEdgeItem.edgeId,
              isStart: false,
              relatedRoadId: (scope.editingRoadItem as RoadItem).roadId,
              relatedRoadCategory: (scope.editingRoadItem as RoadItem).category,
              isRelatedRoadStart: actionMeshIsStartCatmull,
              isRelatedRoadLeftMost: true,
            });
          } else if (scope.isGeoConnectedPoint(rightMostPoint, junctionEdgeItemSeriePoints[junctionEdgeItemSeriePoints.length - 1])) {
            j.edges.push({
              edgeId: junctionEdgeItem.edgeId,
              isStart: false,
              relatedRoadId: (scope.editingRoadItem as RoadItem).roadId,
              relatedRoadCategory: (scope.editingRoadItem as RoadItem).category,
              isRelatedRoadStart: actionMeshIsStartCatmull,
              isRelatedRoadLeftMost: false,
            });
          }
        });
      });

      if (compRoads.length > 0 || compJunctions.length > 0) {
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
        roadId: scope.editingRoadItem.roadId,
        roadCategory: scope.editingRoadItem.category,
        compRoads,
        compJunctions,
      };

      const transaction = scope.createTransaction(TransactionType.CatmullAltitudeReformatCatmullSerieRoadComp, opts);
      scope.commitTransaction(transaction);
    } else {
      const opts = {
        scope,
        newRefLineAltitudeCatmullPoints,
        newRefLineAltitudeCatmullTangents,
        isStartCatmull: actionMeshIsStartCatmull,
        isEndCatmull: actionMeshIsEndCatmull,
        roadId: scope.editingRoadItem.roadId,
        roadCategory: scope.editingRoadItem.category,
      };
  
      const transaction = scope.createTransaction(TransactionType.CatmullAltitudeReformatCatmullSerieRoad, opts);
      scope.commitTransaction(transaction);
    }

    // clear after one down-move-up loop, actionMesh is active only in every loop
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
  }

  onDeliverRoadInnerAddCatmullPoint(pickedPoint: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
    if (!scope.editingRoadItem || !pickedPoint) return;

    const oldAltitudeSeriePoints = scope.calculateReflineAltitudeSeriePoints(scope.editingRoadItem.referenceLine);
    const virtualPointPostion = scope.resolveNearestVirtualPointPositionViaLineSeriePoints(oldAltitudeSeriePoints, pickedPoint);
    const virtualPoint = scope.resolveNearestVirtualPointViaLineSeriePoints(oldAltitudeSeriePoints, pickedPoint);

    const oldAltitudeCatmullPoints = scope.editingRoadItem.referenceLine.altitudeCatmullPoints;
    const oldAltitudeCatmullPointsPosition = oldAltitudeCatmullPoints.map((v: Vector3) => {
      return scope.resolveNearestVirtualPointPositionViaLineSeriePoints(oldAltitudeSeriePoints, v);
    });

    const oldAltitudeCatmullTangents = scope.editingRoadItem.referenceLine.altitudeCatmullTangents;

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
      roadId: scope.editingRoadItem.roadId,
      roadCategory: scope.editingRoadItem.category,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullAltitudeReformatCatmullSerieRoad, opts);
    scope.commitTransaction(transaction);
  }

  onDeliverRoadInnerRemoveCatmullPoint(pickedPoint: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
    if (!scope.editingRoadItem || !pickedPoint) return;

    const oldAltitudeCatmullPoints = scope.editingRoadItem.referenceLine.altitudeCatmullPoints;
    const oldAltitudeCatmullTangents = scope.editingRoadItem.referenceLine.altitudeCatmullTangents;

    const sameAltitudeCatmullPointIdx = oldAltitudeCatmullPoints.findIndex((v: Vector3) => {
      return v.subtract(pickedPoint).length() <= RendererConfig.scene.maximumSameCatmullPointDistance;
    });
    if (sameAltitudeCatmullPointIdx < 0) return;

    // not first nor last
    if (sameAltitudeCatmullPointIdx === 0 || (sameAltitudeCatmullPointIdx === oldAltitudeCatmullPoints.length - 1)) {
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
      roadId: scope.editingRoadItem.roadId,
      roadCategory: scope.editingRoadItem.category,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullAltitudeReformatCatmullSerieRoad, opts);
    scope.commitTransaction(transaction);
  }

  initEvent() {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);

    scope.registerEvent(EnterRoadAltitudeAdaptorEvent);
    scope.onEvent(EnterRoadAltitudeAdaptorEvent, (params: { payload: Object | string | number | null }) => {
      const comingRoadItem = (params.payload as { roadItem: RoadItem }).roadItem;

      if (!scope.editingRoadItem) {
        this.isNewComingRoad = true;
      } else if (scope.editingRoadItem.roadId === comingRoadItem.roadId && scope.editingRoadItem.category === comingRoadItem.category) {
        this.isNewComingRoad = false;
      } else {
        this.isNewComingRoad = true;
      }

      scope.undecorateRoadItemAltitude();
      scope.editingRoadItem = comingRoadItem;
      scope.decorateRoadItemAltitude();
    });

    scope.registerEvent(ExitRoadAltitudeAdaptorEvent);
    scope.onEvent(ExitRoadAltitudeAdaptorEvent, (params: { payload: Object | string | number | null }) => {
      scope.undecorateRoadItemAltitude();
    });

    scope.registerEvent(UpdateRoadAltitudeAxisEvent);
  }

  isActionMesh(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
    if (!scope.editingRoadItem) return false;

    return !!(pickedMesh?.metadata?.isRoadReflineAltitudeActionMesh);
  }

  createActionMesh(
    point: Vector3,
    color: Color3,
    category: RoadAltitudeActionMeshCategory,
    extra: {
      relatedRefLine?: ReferenceLineItem;
      relatedLaneLine?: LaneLineItem;
      relatedLane?: LaneItem;
      isStartCatmull?: boolean;
      isEndCatmull?: boolean;
      catmullIndex?: number;
    },
  ) {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
    const contextScene = this.contextScene as Scene;

    const id = `Road_Altitude_Action_Mesh_${scope.actionMeshIndex}`;
    const actionMesh = scope.createAltitudeMarker(contextScene, point, color, id) as Mesh;
    actionMesh.metadata = {
      isRoadReflineAltitudeActionMesh: true,
      point,
      color,
      category,
      relatedRefLine: extra.relatedRefLine,
      relatedLaneLine: extra.relatedLaneLine,
      relatedLane: extra.relatedLane,
      isStartCatmull: extra.isStartCatmull,
      isEndCatmull: extra.isEndCatmull,
      catmullIndex: extra.catmullIndex,
    } as RoadAltitudeActionMeshMetadata;

    scope.actionMeshIndex++;
    scope.actionMeshes[id] = actionMesh;

    scope.makeAltitudeSceneDirty();
  }

  updateActionMesh(id: string, point: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
    const contextScene = this.contextScene as Scene;

    const oldMesh = scope.actionMeshes[id];
    if (!oldMesh) return;
    const oldMetadata = oldMesh.metadata as RoadAltitudeActionMeshMetadata;

    const actionMesh = scope.createAltitudeMarker(contextScene, point, oldMetadata.color, id) as Mesh;
    actionMesh.metadata = {
      isRoadReflineAltitudeActionMesh: true,
      point,
      color: oldMetadata.color,
      category: oldMetadata.category,
      relatedRefLine: oldMetadata.relatedRefLine,
      relatedLaneLine: oldMetadata.relatedLaneLine,
      relatedLane: oldMetadata.relatedLane,
      isStartCatmull: oldMetadata.isStartCatmull,
      isEndCatmull: oldMetadata.isEndCatmull,
      catmullIndex: oldMetadata.catmullIndex,
    } as RoadAltitudeActionMeshMetadata;

    oldMesh.dispose();

    scope.currentActionMesh = actionMesh;
    scope.actionMeshes[id] = actionMesh;

    scope.makeAltitudeSceneDirty();
  }

  undecorateRoadItemAltitude() {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
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

    scope.editingRoadItem = null;
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
    scope.actionMeshes = {};

    scope.makeAltitudeSceneDirty();
  }

  async decorateRoadItemAltitude() {
    const scope = this as unknown as (ExtendedNamespace & RoadAltitudeAdaptorPlugin);
    if (!scope.editingRoadItem) return;

    const contextScene = this.contextScene as Scene;

    const reflineItem = scope.editingRoadItem.referenceLine;
    const seriePoints = scope.calculateReflineAltitudeSeriePoints(reflineItem);

    if (this.isNewComingRoad) {
      this.pointCloudMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      this.pointCloudMesh = await scope.drawRoadAltitudePointCloud(contextScene, scope.editingRoadItem);

      scope.syncAltitudeCamera(contextScene, seriePoints);
      this.debouncedSyncAltitudeAxis(contextScene);
    }

    // line
    this.lineMesh = scope.drawRoadAltitudeTrendLine(contextScene, seriePoints, reflineItem, scope.editingRoadItem);

    // points
    const altitudeCatmullPoints = [...reflineItem.altitudeCatmullPoints];
    const numAltitudeCatmullPoints = altitudeCatmullPoints.length;

    altitudeCatmullPoints.forEach((p: Vector3, catmullIndex: number) => {
      scope.createActionMesh(
        p,
        RendererConfig.mesh.reflineMarkerColor,
        RoadAltitudeActionMeshCategory.RefLineAltitudeCatmullReformat,
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