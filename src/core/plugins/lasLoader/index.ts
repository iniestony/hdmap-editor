import {
  BoundingInfo,
  Mesh,
  Vector3,
  PointsCloudSystem,
  Color4,
  Color3,
  CloudPoint,
  StandardMaterial,
  PointerInfo,
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  MouseInteractionMode
} from '../mouseInteractor/type';
import {
  LoadLASEvent,
  ColorSinglePointsCloudSystem,
  AlterLASEnableEvent,
  AlterLASVizOptionEvent,
  AlterLASIntensitySectionEvent,
  AlterLASPointSizeEvent,
  TriggerLASLevelChangeEvent,
  TriggerLASTargetChangeEvent,
  FetchCurrentLASInfo,
  AddCrossFrameTaskEvent,
  ClearCrossFrameTaskEvent,
  CurrentResolveLASPointCloud2DEvent,
  CurrentMouseMoveResolveLASPointCloud2DEvent,
  ResolveLASPointsCloud2DEvent,
} from './constant';
import {
  LASTileInfo,
  LASInfo,
  LASVizOption,
  LASIntensitySection,
  LasPoint2D,
  LasPoint2Dand3D,
} from './type';
import {
  PcdInfo,
} from '../pcdLoader/type';
import {
  TriggerLoadPCSCrossFrameTaskEvent,
  TriggerColorPCSCrossFrameTaskEvent,
} from '../crossFrameRenderer/constant';
import {
  PointAlign2D
} from '../pointAlignDrawer/type'
import {
  ReceivePointAlignCurrentLasPointEvent,
  CurrentPointAlignMoseMoveLASPointCloud2DEvent,
} from '../pointAlignDrawer/constant';
import {
  ReceiveSegmentAlignCurrentLasPointEvent,
  CurrentSegmentAlignMoseMoveLASPointCloud2DEvent,
} from '../segmentAlignDrawer/constant';
import { clamp, lerp, scaleLinear } from "@/core/utils/math";

export default class LASLoaderPlugin extends LogicalPlugin {
  currentLasInfo?: LASInfo;
  cachedTilePcdInfo: Map<string, PcdInfo> = new Map();

  currentPointsCloudSystemCollection: Map<string, PointsCloudSystem> = new Map();

  currentPointsCloudSystemCollection2D: Map<number, LasPoint2Dand3D> = new Map();

  enableLAS: boolean = true;
  lasVizOption: LASVizOption = LASVizOption.Intensity;
  lasIntensitySection: LASIntensitySection = { min: RendererConfig.scene.pointCloudColorIntensityMin, max: RendererConfig.scene.pointCloudColorIntensityMax }
  lasIntensitySections: number[] = []
  lasPointSize: number = 1;

  // query variables
  currentLevel?: number;
  targetTileX?: number;
  targetTileY?: number;

  // cross frame rendering
  crossFramePCSSerieEnrichTasks: Array<() => Promise<void>> = [];
  crossFramePCSSerieColorTasks: Array<() => void> = [];

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

    scope.registerEvent(LoadLASEvent);
    scope.onEvent(LoadLASEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as unknown as { lasId: string };
      this.lasIntensitySections = scope.genLasColorSections(this.lasIntensitySection.min, this.lasIntensitySection.max)
      const res = await scope.getLasPointCloudInfo(payload.lasId);

      if (res?.isSuccess) {
        if (res.data) {
          this.currentLasInfo = res.data as LASInfo;

          this.currentLasInfo.pointRange.xcenter = (this.currentLasInfo.pointRange.xmin + this.currentLasInfo.pointRange.xmax) / 2;
          this.currentLasInfo.pointRange.ycenter = (this.currentLasInfo.pointRange.ymin + this.currentLasInfo.pointRange.ymax) / 2;
          this.currentLasInfo.pointRange.zcenter = (this.currentLasInfo.pointRange.zmin + this.currentLasInfo.pointRange.zmax) / 2;
        }

        if (this.currentLasInfo) {
          // adjust camera
          scope.alterOrbitCameraViewOnLasInfo(this.currentLasInfo);

          this.currentLevel = scope.resolveLevelViaLasInfo(this.currentLasInfo);

          if (this.currentLevel !== undefined) {
            const tileInfo = scope.resolveTileXYViaLasInfoAndLevelInfo(this.currentLasInfo, this.currentLevel);
            this.targetTileX = tileInfo?.tileX;
            this.targetTileY = tileInfo?.tileY;

            await scope.createLASPointCloudMesh(
              this.cachedTilePcdInfo,
              this.currentPointsCloudSystemCollection,
              this.currentLasInfo,
              {
                level: this.currentLevel,
                tileX: this.targetTileX,
                tileY: this.targetTileY,
              },
              this.lasPointSize,
            );

            scope.invokeCrossFramePCSSerieEnrichTasks();
          }
        }
      }
    });

    scope.registerEvent(TriggerLASLevelChangeEvent);
    scope.onEvent(TriggerLASLevelChangeEvent, async (params: { payload: Object | string | number | null }) => {
      if (!this.enableLAS) return;

      const lasInfo = this.currentLasInfo;
      if (!lasInfo) return;

      const newLevel = scope.resolveLevelViaLasInfo(lasInfo);
      if (newLevel === this.currentLevel) return;

      this.currentLevel = newLevel;

      const tileInfo = scope.resolveTileXYViaLasInfoAndLevelInfo(this.currentLasInfo, this.currentLevel);
      this.targetTileX = tileInfo?.tileX;
      this.targetTileY = tileInfo?.tileY;

      scope.clearPointsCloudSystemCollection();

      await scope.createLASPointCloudMesh(
        this.cachedTilePcdInfo,
        this.currentPointsCloudSystemCollection,
        this.currentLasInfo,
        {
          level: this.currentLevel,
          tileX: this.targetTileX,
          tileY: this.targetTileY,
        },
        this.lasPointSize,
      );

      scope.invokeCrossFramePCSSerieEnrichTasks();
    });

    scope.registerEvent(TriggerLASTargetChangeEvent);
    scope.onEvent(TriggerLASTargetChangeEvent, async (params: { payload: Object | string | number | null }) => {
      if (!this.enableLAS) return;
      const lasInfo = this.currentLasInfo;
      if (!lasInfo) return;

      const tileInfo = scope.resolveTileXYViaLasInfoAndLevelInfo(lasInfo, this.currentLevel);

      if (this.targetTileX === tileInfo.tileX && this.targetTileY === tileInfo.tileY) return;

      this.targetTileX = tileInfo.tileX;
      this.targetTileY = tileInfo.tileY;

      await scope.createLASPointCloudMesh(
        this.cachedTilePcdInfo,
        this.currentPointsCloudSystemCollection,
        this.currentLasInfo,
        {
          level: this.currentLevel,
          tileX: this.targetTileX,
          tileY: this.targetTileY,
        },
        this.lasPointSize,
      );

      scope.invokeCrossFramePCSSerieEnrichTasks();
    });

    scope.registerEvent(FetchCurrentLASInfo);
    scope.onEvent(FetchCurrentLASInfo, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        callback: Function,
      };

      payload.callback(this.currentLasInfo);
    });

    scope.registerEvent(ColorSinglePointsCloudSystem);
    scope.onEvent(ColorSinglePointsCloudSystem, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as unknown as { pcs: PointsCloudSystem };

      scope.colorLASPointsCloudViaVizOption(payload.pcs);
    });

    scope.registerEvent(AlterLASVizOptionEvent);
    scope.onEvent(AlterLASVizOptionEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { lasVizOption: LASVizOption };

      this.lasVizOption = payload.lasVizOption;
      scope.colorPointsCloudSystemCollection();
    });

    scope.registerEvent(AlterLASIntensitySectionEvent);
    scope.onEvent(AlterLASIntensitySectionEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { lasIntensitySection: LASIntensitySection };
      this.lasIntensitySection = payload.lasIntensitySection;
      this.lasIntensitySections = scope.genLasColorSections(payload.lasIntensitySection.min, payload.lasIntensitySection.max)
      scope.colorPointsCloudSystemCollection();
    });


    scope.registerEvent(AlterLASEnableEvent);
    scope.onEvent(AlterLASEnableEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { enable: boolean };

      this.enableLAS = payload.enable;

      if (this.enableLAS) {
        const lasInfo = this.currentLasInfo;
        if (!lasInfo) return;

        const newLevel = scope.resolveLevelViaLasInfo(lasInfo);
        this.currentLevel = newLevel;

        const tileInfo = scope.resolveTileXYViaLasInfoAndLevelInfo(this.currentLasInfo, this.currentLevel);
        this.targetTileX = tileInfo?.tileX;
        this.targetTileY = tileInfo?.tileY;

        scope.clearPointsCloudSystemCollection();

        await scope.createLASPointCloudMesh(
          this.cachedTilePcdInfo,
          this.currentPointsCloudSystemCollection,
          this.currentLasInfo,
          {
            level: this.currentLevel,
            tileX: this.targetTileX,
            tileY: this.targetTileY,
          },
          this.lasPointSize,
        );

        scope.invokeCrossFramePCSSerieEnrichTasks();
      } else {
        scope.clearPointsCloudSystemCollection();
      }
    });

    scope.registerEvent(AlterLASPointSizeEvent);
    scope.onEvent(AlterLASPointSizeEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { size: number };

      this.lasPointSize = payload.size;

      scope.clearPointsCloudSystemCollection();

      await scope.createLASPointCloudMesh(
        this.cachedTilePcdInfo,
        this.currentPointsCloudSystemCollection,
        this.currentLasInfo,
        {
          level: this.currentLevel,
          tileX: this.targetTileX,
          tileY: this.targetTileY,
        },
        this.lasPointSize,
      );

      scope.invokeCrossFramePCSSerieEnrichTasks();
    });



    scope.registerEvent(ClearCrossFrameTaskEvent);
    scope.onEvent(ClearCrossFrameTaskEvent, async (params: { payload: Object | string | number | null }) => {
      this.crossFramePCSSerieEnrichTasks = [];
    });

    scope.registerEvent(AddCrossFrameTaskEvent);
    scope.onEvent(AddCrossFrameTaskEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { task: () => Promise<void> };

      this.crossFramePCSSerieEnrichTasks.push(payload.task);
    });

    scope.registerEvent(ResolveLASPointsCloud2DEvent);
    scope.onEvent(ResolveLASPointsCloud2DEvent, async (params: { payload: Object | string | number | null }) => {

      this.currentPointsCloudSystemCollection2D.clear();
      this.currentPointsCloudSystemCollection.forEach((v: PointsCloudSystem) => {
        this.resolveLASPointsCloud2D(v);
      })

      if (this.currentPointsCloudSystemCollection2D.size > RendererConfig.align.mouse.move.las2DSize) {
        scope.emitEvent(CurrentPointAlignMoseMoveLASPointCloud2DEvent, {
          cloudPointPosition: null
        });
        scope.emitEvent(CurrentSegmentAlignMoseMoveLASPointCloud2DEvent, {
          cloudPointPosition: null
        });
      }
    })
    scope.registerEvent(CurrentResolveLASPointCloud2DEvent);
    scope.onEvent(CurrentResolveLASPointCloud2DEvent, async (params: { payload: Object | string | number | null }) => {
      const pointAlign2D = (params.payload as { pointAlign2D: PointAlign2D }).pointAlign2D;
      const lasPoint2Dand3D = this.currentResolveLASPointsCloud2D(pointAlign2D);

      if (!lasPoint2Dand3D) return null;

      const mouseInteractionMode = (params.payload as { mouseInteractionMode: MouseInteractionMode }).mouseInteractionMode;

      if (mouseInteractionMode === MouseInteractionMode.DrawPointAlign) {
        scope.emitEvent(ReceivePointAlignCurrentLasPointEvent, { lasPoint2Dand3D: lasPoint2Dand3D });
      } else if (mouseInteractionMode === MouseInteractionMode.DrawSegmentAlign) {
        scope.emitEvent(ReceiveSegmentAlignCurrentLasPointEvent, { lasPoint2Dand3D: lasPoint2Dand3D });
      }

    });

    scope.registerEvent(CurrentMouseMoveResolveLASPointCloud2DEvent);
    scope.onEvent(CurrentMouseMoveResolveLASPointCloud2DEvent, async (params: { payload: Object | string | number | null }) => {
      if (this.currentPointsCloudSystemCollection2D.size > RendererConfig.align.mouse.move.las2DSize) return;

      const pointerInfo = (params.payload as { pointerInfo: PointerInfo }).pointerInfo;
      const clientX = pointerInfo.event.clientX;
      const clientY = pointerInfo.event.clientY;
      const pointAlign2D = { clientX: clientX, clientY: clientY };
      const lasPoint2Dand3D = this.currentResolveLASPointsCloud2D(pointAlign2D);

      if (!lasPoint2Dand3D) return null;

      const mouseInteractionMode = (params.payload as { mouseInteractionMode: MouseInteractionMode }).mouseInteractionMode;

      if (mouseInteractionMode === MouseInteractionMode.DrawPointAlign) {
        scope.emitEvent(CurrentPointAlignMoseMoveLASPointCloud2DEvent, {
          cloudPointPosition: lasPoint2Dand3D?.cloudPoint.position
        });
      } else if (mouseInteractionMode === MouseInteractionMode.DrawSegmentAlign) {
        scope.emitEvent(CurrentSegmentAlignMoseMoveLASPointCloud2DEvent, {
          cloudPointPosition: lasPoint2Dand3D?.cloudPoint.position
        });
      }


    });

  }

  clearPointsCloudSystemCollection() {
    const scope = this as unknown as ExtendedNamespace;

    this.currentPointsCloudSystemCollection.forEach((v: PointsCloudSystem) => {
      v.dispose();
    });

    this.currentPointsCloudSystemCollection = new Map();

    scope.makeSceneDirty();
  }

  colorPointsCloudSystemCollection() {
    const scope = this as unknown as ExtendedNamespace;

    this.crossFramePCSSerieColorTasks = [];
    this.currentPointsCloudSystemCollection.forEach((v: PointsCloudSystem) => {
      this.crossFramePCSSerieColorTasks.push(() => {
        scope.colorLASPointsCloudViaVizOption(v);
      });
    });

    scope.emitEvent(TriggerColorPCSCrossFrameTaskEvent, { tasks: this.crossFramePCSSerieColorTasks });

    scope.makeSceneDirty();
  }

  colorLASPointsCloudViaVizOption(v: PointsCloudSystem) {
    const scope = this as unknown as ExtendedNamespace;

    if (!this.currentLasInfo) return;
    if (this.currentLevel === undefined) return;

    const currentLasInfo = this.currentLasInfo as LASInfo;

    const colors = scope.genLasColorGradient(this.lasVizOption);
    const pointRange = currentLasInfo.pointRange;
    const minHeight = pointRange.zmin - pointRange.zcenter;
    const maxHeight = pointRange.zmax - pointRange.zcenter;

    const intensities = v?.vars?.pcdIntensities;

    v.updateParticle = (cloudPoint: CloudPoint) => {
      if (this.lasVizOption === LASVizOption.Intensity) {
        if (intensities) {
          const intensity = intensities[cloudPoint.idx];
          const bars = this.lasIntensitySections
          let idx = 0;
          if (intensity > this.lasIntensitySection.max) {
            idx = bars.length - 1
          } else if (intensity < this.lasIntensitySection.min) {
            idx = 0
          } else {
            for (let i = 0; i < bars.length - 2; i++) {
              if (intensity >= bars[i] && intensity < bars[i + 1]) {
                idx = i;
                break;
              }
            }
          }
          const color3 = Color3.FromHexString(colors[idx]);
          cloudPoint.color = new Color4(color3.r, color3.g, color3.b, 1);
        }
      } else if (this.lasVizOption === LASVizOption.Height) {
        const height = cloudPoint.position.y;

        let ratio = (height - minHeight) / (maxHeight - minHeight);
        ratio = Math.floor(ratio * RendererConfig.scene.pointCloudColorLinearRangeNum);

        const idx = clamp(ratio, 0, RendererConfig.scene.pointCloudColorLinearRangeNum - 1);

        const color3 = Color3.FromHexString(colors[idx]);
        cloudPoint.color = new Color4(color3.r, color3.g, color3.b, 1);
      }
      return cloudPoint;
    };


    v.setParticles(0, v.nbParticles, true);

    scope.makeSceneDirty();
  }

  resolveLASPointsCloud2D(v: PointsCloudSystem) {
    const scope = this as unknown as ExtendedNamespace;

    v.updateParticle = (cloudPoint: CloudPoint) => {

      const point = scope.resolveACloudPoint2D(cloudPoint.position);
      if (point) {
        this.currentPointsCloudSystemCollection2D.set(Math.random(), { cloudPoint: cloudPoint, lasPoint2D: point });
      }
      return cloudPoint;
    };

    v.setParticles(0, v.nbParticles, true);

    scope.makeSceneDirty();
  }

  currentResolveLASPointsCloud2D(pointAlign2D: PointAlign2D) {
    const scope = this as unknown as ExtendedNamespace;
    const keys = this.currentPointsCloudSystemCollection2D.keys();
    const arrDis: { dis: number, key: number }[] = [];

    for (const key of keys) {
      this.nearestPoint(key, pointAlign2D, arrDis);
    }
    let minDis = arrDis[0]?.dis;
    let minIndex = 0;
    for (let i = 0; i < arrDis.length; i++) {
      if (minDis > arrDis[i].dis) {
        minDis = arrDis[i].dis;
        minIndex = i;
      }
    }

    if (arrDis[minIndex]) {
      const lasPoint2Dand3D = this.currentPointsCloudSystemCollection2D.get(arrDis[minIndex].key);
      return lasPoint2Dand3D;
    }
    return null;
  }

  async nearestPoint(key: number, pointAlign2D: PointAlign2D, arrDis: { dis: number, key: number }[]) {
    const lasPoint2Dand3D = this.currentPointsCloudSystemCollection2D.get(key);
    const lasPoint2D = lasPoint2Dand3D?.lasPoint2D;
    if (!lasPoint2D) return;

    const dx = Math.abs(pointAlign2D.clientX - lasPoint2D.pixelX);
    const dy = Math.abs(pointAlign2D.clientY - lasPoint2D.pixelY);

    const dis = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
    if (dis < RendererConfig.pointAlign.maximumDistanceQuantity) {
      arrDis.push(
        {
          dis: dis,
          key: key,
        }
      )
    }
  }

  invokeCrossFramePCSSerieEnrichTasks() {
    const scope = this as unknown as ExtendedNamespace;

    scope.emitEvent(TriggerLoadPCSCrossFrameTaskEvent, { tasks: this.crossFramePCSSerieEnrichTasks });
  }
};