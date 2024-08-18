import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import { FetchConvertedApolloMapEvent } from './constant';
import { FetchAllRoadsEvent, FetchAllJunctionsEvent } from '../statusManager/constant';
import { FetchProjectInfoEvent } from '../../../business/plugins/preProcessor/constant'
import {
  RoadCollectionData,
  JunctionCollectionData,
  AtlasMap,
  AtlasRoad,
  AtlasLane,
  AtlasJunction,
} from './type';
import { RoadItem, LaneItem } from '../statusManager/type';

export default class AtlasConverterPlugin extends LogicalPlugin {
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

    scope.registerEvent(FetchConvertedApolloMapEvent);
    scope.onEvent(FetchConvertedApolloMapEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { callback: Function };

      let rawRoadCollectionData = {} as RoadCollectionData;
      scope.emitEvent(FetchAllRoadsEvent, {
        callback: (roadCollectionData: RoadCollectionData) => {
          rawRoadCollectionData = roadCollectionData;
        }
      });

      let rawJunctionCollectionData = {} as JunctionCollectionData;
      scope.emitEvent(FetchAllJunctionsEvent, {
        callback: (junctionCollectionData: JunctionCollectionData) => {
          rawJunctionCollectionData = junctionCollectionData;
        }
      });
      let hdMapId: string | undefined = undefined
      scope.emitEvent(FetchProjectInfoEvent, {
        callback: (d: { hdMapId: string | undefined }) => {
          hdMapId = d.hdMapId
        }
      })

      if (!hdMapId) return

      payload.callback(
        hdMapId, scope.convertToAtlasMap(
          rawRoadCollectionData,
          rawJunctionCollectionData
        )
      )
    });
  }

  convertToAtlasMap(roadCollectionData: RoadCollectionData, JunctionCollectionData: JunctionCollectionData) {
    const scope = this as unknown as ExtendedNamespace;

    const atlasMap = new AtlasMap();

    scope.appendHeader(atlasMap);
    scope.appendRoadsAndLanes(atlasMap, roadCollectionData);
    scope.appendJunctions(atlasMap, JunctionCollectionData);

    return atlasMap;
  }

  appendHeader(atlasMap: AtlasMap) {
    const scope = this as unknown as ExtendedNamespace;

    atlasMap.header = scope.generateHeader({
      version: '0',
      projection: '+proj=utm +zone=30 +ellps=WGS84 +datum=WGS84 +units=m +no_defs',
      district: '',
      rev_major: '5',
      rev_minor: '0',
      left: -0.00024227189731826286,
      top: 0.00065054864042275555,
      right: 0.00019376287218723283,
      bottom: -0.000615640007587979,
      vendor: 'HDMapBuilder',
    });
  }

  appendRoadsAndLanes(atlasMap: AtlasMap, roadCollectionData: RoadCollectionData) {
    const scope = this as unknown as ExtendedNamespace;

    const atlasInfo = {
      atlasRoads: [] as AtlasRoad[],
      atlasLanes: [] as AtlasLane[],
    };

    scope.inlineCollectSingleCategoryRoadsIntoAtlasMap(roadCollectionData.catmullSerieRoadCollection, atlasInfo);
    scope.inlineCollectSingleCategoryRoadsIntoAtlasMap(roadCollectionData.connectionRoadCollection, atlasInfo);


    // append
    atlasMap.road = atlasInfo.atlasRoads;
    atlasMap.lane = atlasInfo.atlasLanes;
  }

  appendJunctions(atlasMap: AtlasMap, junctionCollectionData: JunctionCollectionData) {
    const scope = this as unknown as ExtendedNamespace;

    const atlasInfo = {
      atlasJunction: [] as AtlasJunction[],
    };

    scope.inlineCollectSingleCategoryJunctionIntoAtlasMap(junctionCollectionData.junctionCollection, atlasInfo);
    
    atlasMap.junction = atlasInfo.atlasJunction;
  }
};