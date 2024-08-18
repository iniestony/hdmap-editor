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
  EnterRoadLaneAltitudeAdaptorEvent,
  ExitRoadLaneAltitudeAdaptorEvent,
  UpdateRoadLaneAltitudeAxisEvent,
} from './constant';
import {
  RoadLaneAltitudeActionMeshCategory,
  RoadLaneAltitudeActionMeshMetadata,
} from './type';

export default class RoadLaneAltitudeAdaptorPlugin extends LogicalPlugin {
  private wrapperElementId: string = 'hdmap-general-wrapper';
  private contextCanvasId: string = 'road_lane_altitude_canvas';
  private isNewComingRoadLane: boolean = true;

  private debouncedSyncAltitudeAxis: Function;

  private editingRoadItem: RoadItem | null;
  private editingRoadLaneItem: LaneItem | null;
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
    this.editingRoadLaneItem = null;
    this.currentActionMesh = null;
    this.currentActionMeshInitPosition = null;
    this.actionMeshes = {};
    this.actionMeshIndex = 0;

    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
    this.debouncedSyncAltitudeAxis = scope.makeDebounce(scope.syncRoadLaneAltitudeAxis, 500);
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
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);

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
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);

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
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);

    const contextEngine = this.contextEngine as Engine;
    const contextScene = this.contextScene as Scene;

    new HemisphericLight("light", RendererConfig.scene.hemisphericLightAim, contextScene);
  }

  initCamera() {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
    const contextScene = this.contextScene as Scene;
    const contextCanvas = this.contextCanvas as HTMLCanvasElement;

    const camera = new ArcRotateCamera(
      "Road_Lane_Altitude_Orbit_Camera",
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
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
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
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
    const rawPointerInfo = pointerInfo as PointerInfo;

    const pointerEventButton = (pointerInfo as PointerInfo).event.button;
    const isLeftButton = pointerEventButton === 0;
    const isRightButton = pointerEventButton === 2;

    const isCtrl = (pointerInfo as PointerInfo).event.ctrlKey;
    const isAlt = (pointerInfo as PointerInfo).event.altKey;
    const isShift = (pointerInfo as PointerInfo).event.shiftKey;
    
    if (isLeftButton && rawPointerInfo.pickInfo?.pickedMesh) {
      const pickedMesh = rawPointerInfo.pickInfo.pickedMesh;

      if (pickedMesh?.metadata?.isRoadLaneLineAltitudeActionMesh) {
        scope.onPickActionMesh(pickedMesh as Mesh);
      }
    }
  }

  onPointerUp(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);

    scope.onUnpickActionMesh(pointerInfo as PointerInfo);
  }

  onPointerMove(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);

    scope.onOperateActionMesh(pointerInfo as PointerInfo);
  }

  onPointerTap(pointerInfo: { type: number }) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
    const contextScene = this.contextScene as Scene;

    const rawPointerInfo = pointerInfo as PointerInfo;

    const pointerEventButton = (pointerInfo as PointerInfo).event.button;
    const isLeftButton = pointerEventButton === 0;
    const isRightButton = pointerEventButton === 2;

    const isCtrl = (pointerInfo as PointerInfo).event.ctrlKey;
    const isAlt = (pointerInfo as PointerInfo).event.altKey;
    const isShift = (pointerInfo as PointerInfo).event.shiftKey;

    const hasActualPickedMesh = !!((pointerInfo as PointerInfo).pickInfo?.pickedMesh);

    const pickedLaneLineItem = scope.resolveMousePickingLaneLineItemAltitudeInfo(contextScene, pointerInfo as PointerInfo);

    if (isRightButton && hasActualPickedMesh && pickedLaneLineItem) {
      const pickedPoint = pickedLaneLineItem.pickedPoint;
      const laneLineItem = pickedLaneLineItem.altitudeLineItem;

      if (isCtrl) {
        scope.onDeliverRoadLaneInnerRemoveCatmullPoint(pickedPoint, laneLineItem);
      } else {
        scope.onDeliverRoadLaneInnerAddCatmullPoint(pickedPoint, laneLineItem);
      }
    }
  }

  onPickActionMesh(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
    if (!scope.isActionMesh(pickedMesh)) return;

    scope.currentActionMesh = pickedMesh;
    scope.currentActionMeshInitPosition = pickedMesh.position;
  }

  async onOperateActionMesh(pointerInfo: PointerInfo) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem || !scope.currentActionMesh) return;

    const alignAltitude = scope.currentActionMesh.position.y;

    const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
      altitude: alignAltitude,
    });

    if (!pickingInfo.pickedPoint) return;
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem || !scope.currentActionMesh || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;
    pickedPoint.y = alignAltitude;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) return;

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as RoadLaneAltitudeActionMeshMetadata;
    const actionMeshIsStartCatmull = actionMeshMetadata.isStartCatmull as boolean;
    const actionMeshIsEndCatmull = actionMeshMetadata.isEndCatmull as boolean;
    const actionMeshCatmullIndex = actionMeshMetadata.catmullIndex as number;
    
    const relatedLaneLine = actionMeshMetadata.relatedLaneLine as LaneLineItem;

    const oldAltitudeCatmullPoint = relatedLaneLine.altitudeCatmullPoints[actionMeshCatmullIndex];

    let meshPoint = pickedPoint;

    if (actionMeshIsStartCatmull || actionMeshIsEndCatmull) {
      meshPoint = new Vector3(oldAltitudeCatmullPoint.x, pickedPoint.y, pickedPoint.z);
    } else {
      meshPoint = pickedPoint;
    }

    scope.updateActionMesh(actionMesh.id, meshPoint);
  }

  async onUnpickActionMesh(pointerInfo: PointerInfo) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem || !scope.currentActionMesh) return;

    const alignAltitude = scope.currentActionMesh.position.y;

    const pickingInfo = await scope.resolveMouseRayPickingInfoOnRoadPlane(pointerInfo, {
      altitude: alignAltitude,
    });

    if (!pickingInfo.pickedPoint) return;
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem || !scope.currentActionMesh || !scope.currentActionMeshInitPosition) return;

    const pickedPoint = pickingInfo.pickedPoint;
    pickedPoint.y = alignAltitude;

    if (!scope.isValidActionMeshMovement(pickedPoint, scope.currentActionMeshInitPosition)) {
      scope.currentActionMesh = null;
      scope.currentActionMeshInitPosition = null;

      return;
    }

    const actionMesh = scope.currentActionMesh as Mesh;
    const actionMeshMetadata = actionMesh.metadata as RoadLaneAltitudeActionMeshMetadata;
    const actionMeshIsStartCatmull = actionMeshMetadata.isStartCatmull as boolean;
    const actionMeshIsEndCatmull = actionMeshMetadata.isEndCatmull as boolean;
    const actionMeshCatmullIndex = actionMeshMetadata.catmullIndex as number;

    const relatedLaneLine = actionMeshMetadata.relatedLaneLine as LaneLineItem;

    const altitudeCatmullPoints = relatedLaneLine.altitudeCatmullPoints;
    const altitudeCatmullTangents = relatedLaneLine.altitudeCatmullTangents;

    const oldAltitudeCatmullPoint = altitudeCatmullPoints[actionMeshCatmullIndex];

    let newAltitudeCatmullPoint = pickedPoint;
    
    if (actionMeshIsStartCatmull || actionMeshIsEndCatmull) {
      newAltitudeCatmullPoint = new Vector3(oldAltitudeCatmullPoint.x, pickedPoint.y, pickedPoint.z);
    } else {
      newAltitudeCatmullPoint = pickedPoint;
    }

    const newLaneLineAltitudeCatmullPoints = [...altitudeCatmullPoints];
    newLaneLineAltitudeCatmullPoints.splice(actionMeshCatmullIndex, 1, newAltitudeCatmullPoint);

    const newLaneLineAltitudeCatmullTangents = [...altitudeCatmullTangents];

    // determine transaction
    let isCompMode = false;
    const compRoadLanes = [] as Array<{
      laneId: string;
      laneSide: LaneSide;
      laneLineSide: LaneLineSide;
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
      // road lanes
      const tempSeriePoints = relatedLaneLine.seriePoints;
      const targetSeriePoint = actionMeshIsStartCatmull ? tempSeriePoints[0] : tempSeriePoints[tempSeriePoints.length - 1];

      const connectedRoads = [...scope.editingRoadItem.prevRoads].concat([...scope.editingRoadItem.nextRoads]);

      for (let i = 0; i < connectedRoads.length; i++) {
        const roadItem = scope.resolveRoadByRoadIdAndRoadCategory(connectedRoads[i].roadId, connectedRoads[i].roadCategory) as RoadItem;
        const candidateLanes = [...roadItem.laneItems.leftLanes].concat([...roadItem.laneItems.rightLanes]);

        candidateLanes.forEach((laneItem: LaneItem) => {
          const innerLaneLineSeriePoints = laneItem.laneLines.innerLaneLine.seriePoints;
          const outerLaneLineSeriePoints = laneItem.laneLines.outerLaneLine.seriePoints;

          if (scope.isGeoConnectedPoint(targetSeriePoint, innerLaneLineSeriePoints[0])) {
            compRoadLanes.push({
              laneId: laneItem.laneId,
              laneSide: laneItem.laneSide,
              laneLineSide: LaneLineSide.Inner,
              roadId: roadItem.roadId,
              roadCategory: roadItem.category,
              isStart: true,
            });
          } else if (scope.isGeoConnectedPoint(targetSeriePoint, innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1])) {
            compRoadLanes.push({
              laneId: laneItem.laneId,
              laneSide: laneItem.laneSide,
              laneLineSide: LaneLineSide.Inner,
              roadId: roadItem.roadId,
              roadCategory: roadItem.category,
              isStart: false,
            });
          } else if (scope.isGeoConnectedPoint(targetSeriePoint, outerLaneLineSeriePoints[0])) {
            compRoadLanes.push({
              laneId: laneItem.laneId,
              laneSide: laneItem.laneSide,
              laneLineSide: LaneLineSide.Outer,
              roadId: roadItem.roadId,
              roadCategory: roadItem.category,
              isStart: true,
            });
          } else if (scope.isGeoConnectedPoint(targetSeriePoint, outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1])) {
            compRoadLanes.push({
              laneId: laneItem.laneId,
              laneSide: laneItem.laneSide,
              laneLineSide: LaneLineSide.Outer,
              roadId: roadItem.roadId,
              roadCategory: roadItem.category,
              isStart: false,
            });
          }
        });

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
      const laneSide = scope.editingRoadLaneItem.laneSide;
      const sameSideLaneItems = laneSide === LaneSide.Left ? scope.editingRoadItem.laneItems.leftLanes : scope.editingRoadItem.laneItems.rightLanes;

      // edit outer laneline of most outer lane
      if (sameSideLaneItems[sameSideLaneItems.length - 1].laneId === scope.editingRoadLaneItem.laneId && relatedLaneLine.laneLineSide === LaneLineSide.Outer) {
        let junctionVertexCategory = JunctionVertexCategory.RoadStart;

        if (laneSide === LaneSide.Left && actionMeshIsStartCatmull) {
          junctionVertexCategory = JunctionVertexCategory.RoadEnd;
        } else if (laneSide === LaneSide.Left && actionMeshIsEndCatmull) {
          junctionVertexCategory = JunctionVertexCategory.RoadStart;
        } else if (laneSide === LaneSide.Right && actionMeshIsStartCatmull) {
          junctionVertexCategory = JunctionVertexCategory.RoadStart;
        } else if (laneSide === LaneSide.Right && actionMeshIsEndCatmull) {
          junctionVertexCategory = JunctionVertexCategory.RoadEnd;
        }

        const isRelatedRoadStart = junctionVertexCategory === JunctionVertexCategory.RoadStart;

        const roadConnectorPoints = scope.resolveRoadConnectorPoints({
          roadId: scope.editingRoadItem.roadId,
          roadCategory: scope.editingRoadItem.category,
          junctionVertexCategory,
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
                isRelatedRoadStart,
                isRelatedRoadLeftMost: true,
              });
            } else if (scope.isGeoConnectedPoint(rightMostPoint, junctionEdgeItemSeriePoints[0])) {
              j.edges.push({
                edgeId: junctionEdgeItem.edgeId,
                isStart: true,
                relatedRoadId: (scope.editingRoadItem as RoadItem).roadId,
                relatedRoadCategory: (scope.editingRoadItem as RoadItem).category,
                isRelatedRoadStart,
                isRelatedRoadLeftMost: false,
              });
            } else if (scope.isGeoConnectedPoint(leftMostPoint, junctionEdgeItemSeriePoints[junctionEdgeItemSeriePoints.length - 1])) {
              j.edges.push({
                edgeId: junctionEdgeItem.edgeId,
                isStart: false,
                relatedRoadId: (scope.editingRoadItem as RoadItem).roadId,
                relatedRoadCategory: (scope.editingRoadItem as RoadItem).category,
                isRelatedRoadStart,
                isRelatedRoadLeftMost: true,
              });
            } else if (scope.isGeoConnectedPoint(rightMostPoint, junctionEdgeItemSeriePoints[junctionEdgeItemSeriePoints.length - 1])) {
              j.edges.push({
                edgeId: junctionEdgeItem.edgeId,
                isStart: false,
                relatedRoadId: (scope.editingRoadItem as RoadItem).roadId,
                relatedRoadCategory: (scope.editingRoadItem as RoadItem).category,
                isRelatedRoadStart,
                isRelatedRoadLeftMost: false,
              });
            }
          });
        });
      }

      if (compRoadLanes.length > 0 || compJunctions.length > 0) {
        isCompMode = true;
      }
    }

    if (isCompMode) {
      const opts = {
        scope,
        laneId: scope.editingRoadLaneItem.laneId,
        laneSide: scope.editingRoadLaneItem.laneSide,
        laneLineSide: LaneLineSide.Outer,
        newLaneLineAltitudeCatmullPoints,
        newLaneLineAltitudeCatmullTangents,
        isStartCatmull: actionMeshIsStartCatmull,
        isEndCatmull: actionMeshIsEndCatmull,
        roadId: scope.editingRoadItem.roadId,
        roadCategory: scope.editingRoadItem.category,
        compRoadLanes,
        compJunctions,
      };

      const transaction = scope.createTransaction(TransactionType.CatmullAltitudeLaneEditCatmullSerieRoadComp, opts);
      scope.commitTransaction(transaction);
    } else {
      const opts = {
        scope,
        laneId: scope.editingRoadLaneItem.laneId,
        laneSide: scope.editingRoadLaneItem.laneSide,
        laneLineSide: LaneLineSide.Outer,
        newLaneLineAltitudeCatmullPoints,
        newLaneLineAltitudeCatmullTangents,
        isStartCatmull: false,
        isEndCatmull: false,
        roadId: scope.editingRoadItem.roadId,
        roadCategory: scope.editingRoadItem.category,
      };
  
      const transaction = scope.createTransaction(TransactionType.CatmullAltitudeLaneEditCatmullSerieRoad, opts);
      scope.commitTransaction(transaction);
    }

    // clear after one down-move-up loop, actionMesh is active only in every loop
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
  }

  onDeliverRoadLaneInnerAddCatmullPoint(pickedPoint: Vector3, laneLineItem: LaneLineItem) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem || !pickedPoint) return;

    const oldAltitudeSeriePoints = scope.calculateLaneLineAltitudeSeriePoints(laneLineItem);
    const virtualPointPostion = scope.resolveNearestVirtualPointPositionViaLineSeriePoints(oldAltitudeSeriePoints, pickedPoint);
    const virtualPoint = scope.resolveNearestVirtualPointViaLineSeriePoints(oldAltitudeSeriePoints, pickedPoint);

    const oldAltitudeCatmullPoints = laneLineItem.altitudeCatmullPoints;
    const oldAltitudeCatmullPointsPosition = oldAltitudeCatmullPoints.map((v: Vector3) => {
      return scope.resolveNearestVirtualPointPositionViaLineSeriePoints(oldAltitudeSeriePoints, v);
    });

    const oldAltitudeCatmullTangents = laneLineItem.altitudeCatmullTangents;

    const sameAltitudeCatmullPointIdx = oldAltitudeCatmullPointsPosition.findIndex((v: number) => {
      return Math.abs(v - virtualPointPostion) <= RendererConfig.scene.minimumGeoPositionDiffAmount;
    });
    if (sameAltitudeCatmullPointIdx > 0) return;

    const nextAltitudeCatmullPointIdx = oldAltitudeCatmullPointsPosition.findIndex((v: number) => {
      return v > virtualPointPostion;
    });
    if (nextAltitudeCatmullPointIdx <= 0) return;

    const newLaneLineAltitudeCatmullPoints = [...oldAltitudeCatmullPoints];
    newLaneLineAltitudeCatmullPoints.splice(nextAltitudeCatmullPointIdx, 0, virtualPoint);

    const generatedRawCatmullTangents = scope.generateHermiteSerieLineCatmullTangentsViaCatmullPoints(newLaneLineAltitudeCatmullPoints);
    const targetTangent = generatedRawCatmullTangents[nextAltitudeCatmullPointIdx];

    const newLaneLineAltitudeCatmullTangents = [...oldAltitudeCatmullTangents];
    newLaneLineAltitudeCatmullTangents.splice(nextAltitudeCatmullPointIdx, 0, targetTangent);

    const opts = {
      scope,
      laneId: scope.editingRoadLaneItem.laneId,
      laneSide: scope.editingRoadLaneItem.laneSide,
      laneLineSide: LaneLineSide.Outer,
      newLaneLineAltitudeCatmullPoints,
      newLaneLineAltitudeCatmullTangents,
      isStartCatmull: false,
      isEndCatmull: false,
      roadId: scope.editingRoadItem.roadId,
      roadCategory: scope.editingRoadItem.category,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullAltitudeLaneEditCatmullSerieRoad, opts);
    scope.commitTransaction(transaction);
  }

  onDeliverRoadLaneInnerRemoveCatmullPoint(pickedPoint: Vector3, laneLineItem: LaneLineItem) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem || !pickedPoint) return;

    const oldAltitudeCatmullPoints = laneLineItem.altitudeCatmullPoints;
    const oldAltitudeCatmullTangents = laneLineItem.altitudeCatmullTangents;

    const sameAltitudeCatmullPointIdx = oldAltitudeCatmullPoints.findIndex((v: Vector3) => {
      return v.subtract(pickedPoint).length() <= RendererConfig.scene.maximumSameCatmullPointDistance;
    });
    if (sameAltitudeCatmullPointIdx < 0) return;

    // not first nor last
    if (sameAltitudeCatmullPointIdx === 0 || (sameAltitudeCatmullPointIdx === oldAltitudeCatmullPoints.length - 1)) {
      scope.notifyInfo('不可删除首尾高程控制点');
      return;
    }

    const newLaneLineAltitudeCatmullPoints = [...oldAltitudeCatmullPoints];
    newLaneLineAltitudeCatmullPoints.splice(sameAltitudeCatmullPointIdx, 1);

    const newLaneLineAltitudeCatmullTangents = [...oldAltitudeCatmullTangents];
    newLaneLineAltitudeCatmullTangents.splice(sameAltitudeCatmullPointIdx, 1);

    const opts = {
      scope,
      laneId: scope.editingRoadLaneItem.laneId,
      laneSide: scope.editingRoadLaneItem.laneSide,
      laneLineSide: LaneLineSide.Outer,
      newLaneLineAltitudeCatmullPoints,
      newLaneLineAltitudeCatmullTangents,
      isStartCatmull: false,
      isEndCatmull: false,
      roadId: scope.editingRoadItem.roadId,
      roadCategory: scope.editingRoadItem.category,
    };

    const transaction = scope.createTransaction(TransactionType.CatmullAltitudeLaneEditCatmullSerieRoad, opts);
    scope.commitTransaction(transaction);
  }

  initEvent() {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);

    scope.registerEvent(EnterRoadLaneAltitudeAdaptorEvent);
    scope.onEvent(EnterRoadLaneAltitudeAdaptorEvent, (params: { payload: Object | string | number | null }) => {
      const comingRoadItem = (params.payload as { roadItem: RoadItem }).roadItem;
      const comingLaneItem = (params.payload as { laneItem: LaneItem }).laneItem;

      if (!scope.editingRoadItem || !scope.editingRoadLaneItem) {
        this.isNewComingRoadLane = true;
      } else if (scope.editingRoadItem.roadId === comingRoadItem.roadId && scope.editingRoadItem.category === comingRoadItem.category && scope.editingRoadLaneItem.laneId === comingLaneItem.laneId) {
        this.isNewComingRoadLane = false;
      } else {
        this.isNewComingRoadLane = true;
      }

      scope.undecorateRoadLaneItemAltitude();
      scope.editingRoadItem = comingRoadItem;
      scope.editingRoadLaneItem = comingLaneItem;
      scope.decorateRoadLaneItemAltitude();
    });

    scope.registerEvent(ExitRoadLaneAltitudeAdaptorEvent);
    scope.onEvent(ExitRoadLaneAltitudeAdaptorEvent, (params: { payload: Object | string | number | null }) => {
      scope.undecorateRoadLaneItemAltitude();
    });

    scope.registerEvent(UpdateRoadLaneAltitudeAxisEvent);
  }

  isActionMesh(pickedMesh: Mesh) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem) return false;

    return !!(pickedMesh?.metadata?.isRoadLaneLineAltitudeActionMesh);
  }

  createActionMesh(
    point: Vector3,
    color: Color3,
    category: RoadLaneAltitudeActionMeshCategory,
    extra: {
      relatedRefLine?: ReferenceLineItem;
      relatedLaneLine?: LaneLineItem;
      relatedLane?: LaneItem;
      isStartCatmull?: boolean;
      isEndCatmull?: boolean;
      catmullIndex?: number;
    },
  ) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
    const contextScene = this.contextScene as Scene;

    const id = `Road_Lane_Altitude_Action_Mesh_${scope.actionMeshIndex}`;
    const actionMesh = scope.createAltitudeMarker(contextScene, point, color, id) as Mesh;
    actionMesh.metadata = {
      isRoadLaneLineAltitudeActionMesh: true,
      point,
      color,
      category,
      relatedRefLine: extra.relatedRefLine,
      relatedLaneLine: extra.relatedLaneLine,
      relatedLane: extra.relatedLane,
      isStartCatmull: extra.isStartCatmull,
      isEndCatmull: extra.isEndCatmull,
      catmullIndex: extra.catmullIndex,
    } as RoadLaneAltitudeActionMeshMetadata;

    scope.actionMeshIndex++;
    scope.actionMeshes[id] = actionMesh;

    scope.makeAltitudeSceneDirty();
  }

  updateActionMesh(id: string, point: Vector3) {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
    const contextScene = this.contextScene as Scene;

    const oldMesh = scope.actionMeshes[id];
    if (!oldMesh) return;
    const oldMetadata = oldMesh.metadata as RoadLaneAltitudeActionMeshMetadata;

    const actionMesh = scope.createAltitudeMarker(contextScene, point, oldMetadata.color, id) as Mesh;
    actionMesh.metadata = {
      isRoadLaneLineAltitudeActionMesh: true,
      point,
      color: oldMetadata.color,
      category: oldMetadata.category,
      relatedRefLine: oldMetadata.relatedRefLine,
      relatedLaneLine: oldMetadata.relatedLaneLine,
      relatedLane: oldMetadata.relatedLane,
      isStartCatmull: oldMetadata.isStartCatmull,
      isEndCatmull: oldMetadata.isEndCatmull,
      catmullIndex: oldMetadata.catmullIndex,
    } as RoadLaneAltitudeActionMeshMetadata;

    oldMesh.dispose();

    scope.currentActionMesh = actionMesh;
    scope.actionMeshes[id] = actionMesh;

    scope.makeAltitudeSceneDirty();
  }

  undecorateRoadLaneItemAltitude() {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
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
    scope.editingRoadLaneItem = null;
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
    scope.actionMeshes = {};

    scope.makeAltitudeSceneDirty();
  }

  async decorateRoadLaneItemAltitude() {
    const scope = this as unknown as (ExtendedNamespace & RoadLaneAltitudeAdaptorPlugin);
    if (!scope.editingRoadItem || !scope.editingRoadLaneItem) return;

    const contextScene = this.contextScene as Scene;

    const outerLaneLineItem = scope.editingRoadLaneItem.laneLines.outerLaneLine;
    const outerLaneLineItemSeriePoints = scope.calculateLaneLineAltitudeSeriePoints(outerLaneLineItem);

    if (this.isNewComingRoadLane) {
      this.pointCloudMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      this.pointCloudMesh = await scope.drawRoadLaneAltitudePointCloud(contextScene, outerLaneLineItem);

      scope.syncAltitudeCamera(contextScene, outerLaneLineItemSeriePoints);
      this.debouncedSyncAltitudeAxis(contextScene);
    }

    // line
    this.lineMesh = scope.drawRoadLaneAltitudeTrendLine(contextScene, outerLaneLineItemSeriePoints, outerLaneLineItem, scope.editingRoadLaneItem, scope.editingRoadItem);

    // points
    const altitudeCatmullPoints = [...outerLaneLineItem.altitudeCatmullPoints];
    const numAltitudeCatmullPoints = altitudeCatmullPoints.length;

    altitudeCatmullPoints.forEach((p: Vector3, catmullIndex: number) => {
      scope.createActionMesh(
        p,
        RendererConfig.mesh.reflineMarkerColor,
        RoadLaneAltitudeActionMeshCategory.LaneLineAltitudeCatmullReformat,
        {
          relatedLaneLine: outerLaneLineItem,
          relatedLane: scope.editingRoadLaneItem as LaneItem,
          isStartCatmull: catmullIndex === 0,
          isEndCatmull: catmullIndex === numAltitudeCatmullPoints - 1,
          catmullIndex: catmullIndex,
        },
      );
    });

    scope.makeAltitudeSceneDirty();
  }
};