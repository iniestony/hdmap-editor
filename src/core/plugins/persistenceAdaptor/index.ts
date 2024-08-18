import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import {
  PersistDirtyHDMapEvent,
} from './constant';
import {
  FetchProjectInfoEvent,
} from '../../../business/plugins/preProcessor/constant';
import {
  FetchAllDirtyRoadsEvent,
  CleanDirtyRoadEvent,
  FetchAllDirtyJunctionsEvent,
  CleanDirtyJunctionEvent,
} from '../statusManager/constant';
import {
  DirtyRoadInfoCollection,
  DirtyJunctionInfoCollection,
} from '../statusManager/type';
import {
  RoadItem,
  LaneItem,
  JunctionItem,
} from '../statusManager/type';

export default class PersistenceAdaptorPlugin extends LogicalPlugin {
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

    scope.registerEvent(PersistDirtyHDMapEvent);
    scope.onEvent(PersistDirtyHDMapEvent, (params: { payload: Object | string | number | null }) => {
      let hdMapId: string | undefined = undefined;

      scope.emitEvent(FetchProjectInfoEvent, {
        callback: (d: {
          hdMapId: string | undefined;
        }) => {
          hdMapId = d.hdMapId;
        }
      });

      if (!hdMapId) return;

      // dirty roads
      const resolvedR = this.resolveAllDirtyRoads();
      const plusRoadItems = resolvedR.plusRoadItems;
      const minusRoadPIDs = resolvedR.minusRoadPIDs;

      // dirty junctions
      const resolvedJ = this.resolveAllDirtyJunctions();
      const plusJunctionItems = resolvedJ.plusJunctionItems;
      const minusJunctionPIDs = resolvedJ.minusJunctionPIDs;

      if (
        plusRoadItems.length === 0 && 
        minusRoadPIDs.length == 0 &&
        plusJunctionItems.length === 0 &&
        minusJunctionPIDs.length === 0
      ) {
        scope.notifyInfo('当前暂无改动');
        return;
      }

      // save roads
      plusRoadItems.forEach((roadItem: RoadItem) => {
        scope.persistPlusRoad(roadItem, hdMapId);
      });

      minusRoadPIDs.forEach((roadPID: string) => {
        scope.persistMinusRoad(roadPID, hdMapId);
      });

      // save junctions
      plusJunctionItems.forEach((junctionItem: JunctionItem) => {
        scope.persistPlusJunction(junctionItem, hdMapId);
      });

      minusJunctionPIDs.forEach((junctionPID: string) => {
        scope.persistMinusJunction(junctionPID, hdMapId);
      });

      scope.notifySuccess(`保存成功！共新增/编辑${plusRoadItems.length}条道路；删除${minusRoadPIDs.length}条道路；新增/编辑${plusJunctionItems.length}条路口；删除${minusJunctionPIDs.length}条路口`);

      scope.emitEvent(CleanDirtyRoadEvent);
      scope.emitEvent(CleanDirtyJunctionEvent);
    });
  }

  resolveAllDirtyRoads() {
    const scope = this as unknown as ExtendedNamespace;

    let dirtyRoadInfoCollection: DirtyRoadInfoCollection | undefined = undefined;
    scope.emitEvent(FetchAllDirtyRoadsEvent, {
      callback: (d: DirtyRoadInfoCollection) => {
        dirtyRoadInfoCollection = d;
      }
    });

    const _d = dirtyRoadInfoCollection as unknown as DirtyRoadInfoCollection;
    const dirtyRoadIds = Object.keys(_d);
    const plusRoadItems = [] as RoadItem[];
    const minusRoadPIDs = [] as string[];

    dirtyRoadIds.forEach((roadId: string) => {
      const dirtyRoadInfo = _d[roadId];
      const roadItem = scope.resolveRoadByRoadIdAndRoadCategory(dirtyRoadInfo.roadId, dirtyRoadInfo.roadCategory);

      if (roadItem) {
        plusRoadItems.push(roadItem);
      } else {
        minusRoadPIDs.push(dirtyRoadInfo.roadPID);
      }
    });

    return {
      plusRoadItems,
      minusRoadPIDs,
    };
  }

  resolveAllDirtyJunctions() {
    const scope = this as unknown as ExtendedNamespace;

    let dirtyJunctionInfoCollection: DirtyJunctionInfoCollection | undefined = undefined;
    scope.emitEvent(FetchAllDirtyJunctionsEvent, {
      callback: (d: DirtyJunctionInfoCollection) => {
        dirtyJunctionInfoCollection = d;
      }
    });

    const _d = dirtyJunctionInfoCollection as unknown as DirtyJunctionInfoCollection;
    const dirtyJunctionIds = Object.keys(_d);
    const plusJunctionItems = [] as JunctionItem[];
    const minusJunctionPIDs = [] as string[];

    dirtyJunctionIds.forEach((junctionId: string) => {
      const dirtyJunctionInfo = _d[junctionId];
      const junctionItem = scope.resolveJunctionByJunctionId(dirtyJunctionInfo.junctionId);

      if (junctionItem) {
        plusJunctionItems.push(junctionItem);
      } else {
        minusJunctionPIDs.push(dirtyJunctionInfo.junctionPID);
      }
    });

    return {
      plusJunctionItems,
      minusJunctionPIDs,
    };
  }
};