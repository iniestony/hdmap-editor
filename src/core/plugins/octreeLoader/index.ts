import {
  BoundingInfo,
  Mesh,
  Vector3,
  PointsCloudSystem,
  Color4,
  Color3,
  CloudPoint,
  Octree,
  AbstractMesh,
  OctreeBlock,
  Scene,
  MeshBuilder,
  StandardMaterial,
  Frustum,
  BoundingBox,
  SmartArrayNoDuplicate,
  Plane,
  SmartArray,
  DeepImmutable,
  Viewport,
  ArcRotateCamera,
  PointerInfo,
} from "@babylonjs/core";
import { LogicalPlugin } from "../raw/logical";
import { PluginOptions } from "../../types/plugins/raw";
import { ExtendedNamespace } from "../../types/plugins/raw";
import RendererConfig from '../../renderer/config';
import { OctreePointCloud } from "./octree";
import {
  MouseInteractionMode
} from '../mouseInteractor/type';
import {
  InteractionMode
} from '../interactorManager/type';
import {
  RoadCategory,
  RoadItem,
} from '../statusManager/type';
import {
  LoadOctreePointCloud,
  TriggerOctreeNodeVisibleChangeEvent,
  AlterLASIntensitySectionEvent,
  AlterLASEnableEvent,
  AlterLASVizOptionEvent,
  AlterLASPointSizeEvent,
  SyncPickedOctreePCSMeshEvent,
  InitAlignOctreeInfoEvent,
  FetchAltitudeSurroundingNodePcdInfoEvent,
  FetchTrafficLightsSurroundingOctreePCSMeshEvent,
} from "./constant";
import {
  OctreeInfo,
  LASIntensitySection,
  LASVizOption,
  LasPoint2Dand3D,
  LasPoint2D,
  Point2D,
  SorptionPointInfo,
} from './type';
import {
  ReceivePointAlignCurrentLasPointEvent,
  InitPointAlignOctreeInfoEvent,
} from '../pointAlignDrawer/constant';
import {
  ReceiveSegmentAlignCurrentLasPointEvent,
  InitSegmentAlignOctreeInfoEvent,
} from '../segmentAlignDrawer/constant';
import {
  ReceiveSignalPositionEvent,
} from "../signalDrawer/constant";
import {
  AlterGroundAltitudeEvent,
} from '../mouseInteractor/constant';


export default class OctreePointCloudLoaderPlugin extends LogicalPlugin {
  lasIntensityRanges: number[] = [];
  lasIntensitySection: LASIntensitySection = { min: RendererConfig.scene.pointCloudColorIntensityMin, max: RendererConfig.scene.pointCloudColorIntensityMax };
  lasPointSize: number = 1;
  lasVizOption: LASVizOption = LASVizOption.Intensity;
  sorptionPointInfoList: SorptionPointInfo[] = [];

  octreePointCloud?: OctreePointCloud;
  octreeInfo?: OctreeInfo;

  constructor(options: PluginOptions) {
    super(options);
  }

  activate() {
    super.activate();

    this.init();
  }

  init() {
    this.initEvent();
  }

  initEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(LoadOctreePointCloud);
    scope.onEvent(
      LoadOctreePointCloud,
      async (params: { payload: Object | string | number | null }) => {
        const payload = params.payload as {
          octreeInfo: OctreeInfo;
        };

        // use octreeInfo.octree
        const { octreeInfo } = payload;

        this.octreeInfo = octreeInfo;
        this.lasIntensityRanges = scope.genLasColorSections(this.lasIntensitySection.min, this.lasIntensitySection.max);

        scope.setPointCloudInfo({
          lasIntensityRanges: this.lasIntensityRanges,
          lasIntensitySection: this.lasIntensitySection,
          lasPointSize: this.lasPointSize,
          lasVizOption: this.lasVizOption,
          octreeInfo: this.octreeInfo,
        });

        // boundingBox
        const { min, max } = octreeInfo.octree.bbox;
        const boundingBox = new BoundingBox(
          // switch y and z
          new Vector3(min.x, min.z, min.y),
          new Vector3(max.x, max.z, max.y)
        );

        // candidateNodePointsMap
        const candidateNodePointsMap = new Map<number, number>();
        octreeInfo.octree.visibleNodes.forEach((id, idx) => {
          candidateNodePointsMap.set(id, octreeInfo.octree.visibleNodePoints[idx]);
        });

        // adapt camera
        const contextScene = scope.getSceneManager().getContextScene();
        const activeCamera = contextScene.activeCamera as ArcRotateCamera;

        // activeCamera.target = new Vector3(boundingBox.center._x - RendererConfig.orbitCamera.box.transferX, min.z - RendererConfig.orbitCamera.box.transferZ, boundingBox.center._y - RendererConfig.orbitCamera.box.transferY)

        // activeCamera.beta = RendererConfig.orbitCamera.birdEyeCamera.beta;
        // activeCamera.alpha = RendererConfig.orbitCamera.dueNorthView.alpha;

        const { x: xcenter, y: ycenter, z: zcenter } = boundingBox.center;
        const { x: xmax, y: ymax, z: zmax } = boundingBox.maximum;
        const { x: xmin, y: ymin, z: zmin } = boundingBox.minimum;

        activeCamera.target = new Vector3(xcenter, ycenter, zcenter);

        activeCamera.setPosition(new Vector3(
          xcenter,
          ymax + 80,
          zmin - 120,
        ));

        const initRadius = activeCamera.radius;
        activeCamera.lowerRadiusLimit = initRadius * 0.001;
        activeCamera.upperRadiusLimit = initRadius * 2;

        scope.emitEvent(AlterGroundAltitudeEvent, RendererConfig.scene.groundDefaultAltitude);

        const octreePointCloud = new OctreePointCloud(
          boundingBox,
          octreeInfo.octree.levels,
          candidateNodePointsMap,
          contextScene,
          scope,
        );

        octreePointCloud.setLoadPCDFunction((id: number) => {
          return scope.loadOctreeNode(id);
        });

        // load & render root node
        octreePointCloud.renderNodeMesh(1);

        this.octreePointCloud = octreePointCloud;
      }
    );

    scope.registerEvent(TriggerOctreeNodeVisibleChangeEvent);
    scope.onEvent(
      TriggerOctreeNodeVisibleChangeEvent,
      async (params: { payload: Object | string | number | null }) => {
        const contextScene: Scene = scope.getSceneManager().getContextScene();
        const camera = contextScene.activeCamera;

        if (camera) {
          this.octreePointCloud?.updateVisible(
            camera.getTransformationMatrix(),
            new Viewport(
              0,
              0,
              contextScene.getEngine().getRenderWidth(),
              contextScene.getEngine().getRenderHeight()
            ),
            camera.position,
            camera.fov
          );
        }
      }
    );

    scope.registerEvent(AlterLASIntensitySectionEvent);
    scope.onEvent(AlterLASIntensitySectionEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { lasIntensitySection: LASIntensitySection };
      this.lasIntensityRanges = scope.genLasColorSections(payload.lasIntensitySection.min, payload.lasIntensitySection.max);
      this.lasIntensitySection = payload.lasIntensitySection;

      scope.setPointCloudInfo({
        lasIntensityRanges: this.lasIntensityRanges,
        lasIntensitySection: this.lasIntensitySection,
        lasPointSize: this.lasPointSize,
        lasVizOption: this.lasVizOption,
        octreeInfo: this.octreeInfo,
      });

      this.octreePointCloud?.reRenderOctree();
    });

    scope.registerEvent(AlterLASVizOptionEvent);
    scope.onEvent(AlterLASVizOptionEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { lasVizOption: LASVizOption };
      this.lasVizOption = payload.lasVizOption;

      scope.setPointCloudInfo({
        lasIntensityRanges: this.lasIntensityRanges,
        lasIntensitySection: this.lasIntensitySection,
        lasPointSize: this.lasPointSize,
        lasVizOption: this.lasVizOption,
        octreeInfo: this.octreeInfo,
      });

      this.octreePointCloud?.reRenderOctree();
    });

    scope.registerEvent(AlterLASPointSizeEvent);
    scope.onEvent(AlterLASPointSizeEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { size: number };
      this.lasPointSize = payload.size;

      scope.setPointCloudInfo({
        lasIntensityRanges: this.lasIntensityRanges,
        lasIntensitySection: this.lasIntensitySection,
        lasPointSize: this.lasPointSize,
        lasVizOption: this.lasVizOption,
        octreeInfo: this.octreeInfo,
      });

      this.octreePointCloud?.reRenderOctree();
    });

    scope.registerEvent(AlterLASEnableEvent);
    scope.onEvent(AlterLASEnableEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { enable: boolean };

      if (payload.enable) {
        this.octreePointCloud?.allShow();
      } else {
        this.octreePointCloud?.allHide();
      }

      scope.makeSceneDirty();
    });

    // point/segment align
    scope.registerEvent(InitAlignOctreeInfoEvent);
    scope.onEvent(InitAlignOctreeInfoEvent, async (params: { payload: Object | string | number | null }) => {
      const interactionMode = (params.payload as { interactionMode: InteractionMode }).interactionMode;

      if (interactionMode === InteractionMode.DrawPointAlign) {
        scope.emitEvent(InitPointAlignOctreeInfoEvent, { octreeInfo: this.octreeInfo });
      } else if (interactionMode === InteractionMode.DrawSegmentAlign) {
        scope.emitEvent(InitSegmentAlignOctreeInfoEvent, { octreeInfo: this.octreeInfo });
      }
    });

    // point/segment align
    scope.registerEvent(SyncPickedOctreePCSMeshEvent);
    scope.onEvent(SyncPickedOctreePCSMeshEvent, async (params: { payload: Object | string | number | null }) => {
      const pointerInfo = (params.payload as { pointerInfo: PointerInfo }).pointerInfo;
      const pickedPCSMeshs = (params.payload as { pickedPCSMeshs: Mesh[] }).pickedPCSMeshs;
      const mouseInteractionMode = (params.payload as { mouseInteractionMode: MouseInteractionMode }).mouseInteractionMode;

      if (!pickedPCSMeshs || pickedPCSMeshs.length === 0) return;

      const clientX = pointerInfo.event.clientX;
      const clientY = pointerInfo.event.clientY;

      const point2D = { clientX: clientX, clientY: clientY };

      // gen sorption
      this.sorptionPointInfoList = [];
      pickedPCSMeshs.forEach((m: Mesh) => {
        this.fillSorption(m.metadata.positions, point2D);
      });

      this.sorptionPointInfoList.sort((prev: SorptionPointInfo, next: SorptionPointInfo) => {
        return prev.distance - next.distance;
      });
      
      if (this.sorptionPointInfoList.length > 0) {
        const firstSorp = this.sorptionPointInfoList[0];
        const lasPoint2Dand3D = {
          position: firstSorp.position,
          lasPoint2D: firstSorp.lasPoint2D,
        };
        
        if (mouseInteractionMode === MouseInteractionMode.DrawPointAlign) {
          scope.emitEvent(ReceivePointAlignCurrentLasPointEvent, { lasPoint2Dand3D: lasPoint2Dand3D });
        } else if (mouseInteractionMode === MouseInteractionMode.DrawSegmentAlign) {
          scope.emitEvent(ReceiveSegmentAlignCurrentLasPointEvent, { lasPoint2Dand3D: lasPoint2Dand3D });
        }
      }
    });

    // altitude
    scope.registerEvent(FetchAltitudeSurroundingNodePcdInfoEvent);
    scope.onEvent(FetchAltitudeSurroundingNodePcdInfoEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { keyPoints: Vector3[], callback: Function };
      
      if (!this.octreePointCloud) return;
      const altitudeSurroundingNodePcdInfo = this.octreePointCloud.getAllAltitudeProjectionWithInPcdInfoOctreeNodes(payload.keyPoints);

      payload.callback(altitudeSurroundingNodePcdInfo);
    });

    // traffic lights
    scope.registerEvent(FetchTrafficLightsSurroundingOctreePCSMeshEvent);
    scope.onEvent(FetchTrafficLightsSurroundingOctreePCSMeshEvent, async (params: { payload: Object | string | number | null }) => {
      const pointerInfo = (params.payload as { pointerInfo: PointerInfo }).pointerInfo;
      const pickedPCSMeshs = (params.payload as { pickedPCSMeshs: Mesh[] }).pickedPCSMeshs;

      if (!pickedPCSMeshs || pickedPCSMeshs.length === 0) return;

      const clientX = pointerInfo.event.clientX;
      const clientY = pointerInfo.event.clientY;

      const point2D = { clientX: clientX, clientY: clientY };

      // gen sorption
      this.sorptionPointInfoList = [];
      pickedPCSMeshs.forEach((m: Mesh) => {
        this.fillSorption(m.metadata.positions, point2D);
      });

      this.sorptionPointInfoList.sort((prev: SorptionPointInfo, next: SorptionPointInfo) => {
        return prev.distance - next.distance;
      });
      
      if (this.sorptionPointInfoList.length > 0) {
        const firstSorp = this.sorptionPointInfoList[0];

        scope.emitEvent(ReceiveSignalPositionEvent, { position: firstSorp.position });
      }
    });
  }

  fillSorption(positions: Float32Array, point2D: Point2D) {
    const scope = this as unknown as ExtendedNamespace;

    if (this.sorptionPointInfoList.length > 10) return;
    
    for (let i = 0; i < positions.length; i+=3) {
      const position = new Vector3(positions[i + 0], positions[i + 2], positions[i + 1]);
      const lasPoint2D = scope.resolveACloudPoint2D(position);

      if (lasPoint2D) {
        const dx = Math.abs(point2D.clientX - lasPoint2D.pixelX);
        const dy = Math.abs(point2D.clientY - lasPoint2D.pixelY);

        const distance = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));

        if (distance < RendererConfig.pointAlign.maximumDistanceQuantity) {
          this.sorptionPointInfoList.push({
            distance,
            position,
            lasPoint2D,
          });
        }
      }
    }
  }
}
