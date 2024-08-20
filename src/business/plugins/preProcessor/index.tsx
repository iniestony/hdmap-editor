import {
  Color3,
} from "@babylonjs/core";
import qs from 'qs';
import { LogicalPlugin } from '../../../core/plugins/raw/logical';
import { PluginOptions } from '../../../core/types/plugins/raw';
import { ExtendedNamespace } from '../../../core/types/plugins/raw';
import RendererConfig from '../../../core/renderer/config';
import {
  FetchProjectInfoEvent,
  FetchGlobalRoadMatAlphaEvent,
  AlterGlobalRoadMatAlphaEvent,
} from './constant';

export default class PreProcessorPlugin extends LogicalPlugin {
  hdMapId: string = 'demo_hd_map_id';
  pointCloudId: string = 'demo_point_cloud_id';

  globalRoadMatAlpha: number = RendererConfig.scene.defaultRoadMatAlpha;
  
  constructor(options: PluginOptions) {
    super(options);
  }

  activate() {
    super.activate();

    this.initEvent();
    this.init();
  }

  initEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(FetchProjectInfoEvent);
    scope.onEvent(FetchProjectInfoEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { callback: Function };

      payload.callback({
        hdMapId: this.hdMapId,
        pointCloudId: this.pointCloudId,
      });
    });

    scope.registerEvent(FetchGlobalRoadMatAlphaEvent);
    scope.onEvent(FetchGlobalRoadMatAlphaEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { callback: Function };

      payload.callback(this.globalRoadMatAlpha);
    });

    scope.registerEvent(AlterGlobalRoadMatAlphaEvent);
    scope.onEvent(AlterGlobalRoadMatAlphaEvent, (params: { payload: Object | string | number | null }) => {
      this.globalRoadMatAlpha = params.payload as number;
    });
  }

  init() {
    this.processLoadingProject();
  }

  async processLoadingProject() {
    const scope = this as unknown as ExtendedNamespace;

    // scope.loadPCDPointCloudWithPath('/demo.pcd');
    scope.loadOctreePointCloud();
    scope.loadHDMap(`demo`);
  }
};