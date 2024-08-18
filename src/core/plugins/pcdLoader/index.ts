import {
  BoundingInfo,
  Mesh,
  Vector3,
  PointsCloudSystem,
  Color4,
  Color3,
  CloudPoint,
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../../core/renderer/config';
import {
  LoadPCDEvent,
  SetPCDInfoEvent,
  AlterPCDVizOption,
} from './constant';
import {
  PcdHeader,
  PcdInfo,
  PcdVizOption,
} from './type';

export default class PCDLoaderPlugin extends LogicalPlugin {
  pointsCloudSystem?: PointsCloudSystem;
  pcdMesh?: Mesh;
  pcdInfo?: PcdInfo;

  pcdVizOption: PcdVizOption = PcdVizOption.Height;
  pcdRangeInfo: {
    maxIntensity: number,
    minIntensity: number,
    maxHeight: number,
    minHeight: number,
  } = {
    maxIntensity: 0,
    minIntensity: 0,
    maxHeight: 0,
    minHeight: 0,
  };

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

    scope.registerEvent(LoadPCDEvent);
    scope.onEvent(LoadPCDEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { path: string };

      const pcdInfo = await scope.loadPcdWithIntensity(payload.path);
      scope.createPCDPointCloudMeshWithIntensity(pcdInfo);
    });

    scope.registerEvent(SetPCDInfoEvent);
    scope.onEvent(SetPCDInfoEvent, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        pointsCloudSystem: PointsCloudSystem,
        pcdMesh: Mesh,
        pcdInfo: PcdInfo,
      };

      this.pointsCloudSystem = payload.pointsCloudSystem;
      this.pcdMesh = payload.pcdMesh;
      this.pcdInfo = payload.pcdInfo;

      scope.calculatePcdRangeInfo();
      scope.colorPointsCloudViaVizOption();

      scope.alterOrbitCameraViewOnBoundingInfo(this.pcdMesh.getBoundingInfo());
    });

    scope.registerEvent(AlterPCDVizOption);
    scope.onEvent(AlterPCDVizOption, async (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { pcdVizOption: PcdVizOption };

      this.pcdVizOption = payload.pcdVizOption;
      scope.colorPointsCloudViaVizOption();
    });
  }

  calculatePcdRangeInfo() {
    const boundingInfo = (this.pcdMesh as Mesh).getBoundingInfo();

    this.pcdRangeInfo.maxHeight = boundingInfo.boundingBox.maximumWorld.y;
    this.pcdRangeInfo.minHeight = boundingInfo.boundingBox.minimumWorld.y;

    const intensities = (this.pcdInfo as PcdInfo).intensities as Float32Array;

    let maxIntensity = intensities[0];
    let minIntensity = intensities[0];

    for(let i = 1; i < intensities.length; i++) {
      if (intensities[i] > maxIntensity) maxIntensity = intensities[i];
      if (intensities[i] < minIntensity) minIntensity = intensities[i];
    }

    this.pcdRangeInfo.maxIntensity = maxIntensity;
    this.pcdRangeInfo.minIntensity = minIntensity;
  }

  colorPointsCloudViaVizOption() {
    const scope = this as unknown as ExtendedNamespace;

    const pointsCloudSystem = this.pointsCloudSystem as PointsCloudSystem;
    const pcdInfo = this.pcdInfo as PcdInfo;

    const intensities = pcdInfo.intensities as Float32Array;

    if (this.pcdVizOption === PcdVizOption.Intensity) {
      const colors = scope.genPcdColorGradient(PcdVizOption.Intensity);

      pointsCloudSystem.updateParticle = (cloudPoint: CloudPoint) => {
        const intensity = intensities[cloudPoint.idx];
        const ratio = (intensity - this.pcdRangeInfo.minIntensity) / (this.pcdRangeInfo.maxIntensity - this.pcdRangeInfo.minIntensity);

        const idx = Math.min(Math.floor(ratio * 10), RendererConfig.scene.pointCloudColorLinearRangeNum - 1);

        const color3 = Color3.FromHexString(colors[idx]);

        cloudPoint.color = new Color4(color3.r, color3.g, color3.b, 1);

        return cloudPoint;
      };
    } else if (this.pcdVizOption === PcdVizOption.Height) {
      const colors = scope.genPcdColorGradient(PcdVizOption.Height);

      pointsCloudSystem.updateParticle = (cloudPoint: CloudPoint) => {
        const height = cloudPoint.position.y;
        const ratio = (height - this.pcdRangeInfo.minHeight) / (this.pcdRangeInfo.maxHeight - this.pcdRangeInfo.minHeight);

        const idx = Math.min(Math.floor(ratio * 10), RendererConfig.scene.pointCloudColorLinearRangeNum - 1);

        const color3 = Color3.FromHexString(colors[idx]);

        cloudPoint.color = new Color4(color3.r, color3.g, color3.b, 1);

        return cloudPoint;
      };
    }

    pointsCloudSystem.setParticles(0, pointsCloudSystem.nbParticles, true);
    scope.makeSceneDirty();
  }
};