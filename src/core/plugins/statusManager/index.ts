import {
  Mesh,
  Vector3,
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import {
  FetchAllRoadsEvent,
  DisposeLineAndCurveMarkerEvent,
  StoreLineAndCurveEvent,
  RemoveLineAndCurveEvent,
  DisposeRoadMarkerEvent,
  ResolveRoadByIdAndCategoryEvent,
  StoreRoadEvent,
  RemoveRoadEvent,
  ReformatRoadEvent,
  UpdateOneSideLanesRoadEvent,
  UpdateReferenceLineEditableRoadEvent,
  ResolveJunctionByIdEvent,
  StoreJunctionEvent,
  RemoveJunctionEvent,
  ReformatJunctionEvent,
  FetchAllJunctionsEvent,
  ResolveSignalByIdEvent,
  StoreSignalEvent,
  RemoveSignalEvent,
  ReformatSignalEvent,
  FetchAllSignalsEvent,
  StoreDirtyRoadEvent,
  RemoveDirtyRoadEvent,
  CleanDirtyRoadEvent,
  FetchAllDirtyRoadsEvent,
  StoreDirtyJunctionEvent,
  RemoveDirtyJunctionEvent,
  CleanDirtyJunctionEvent,
  FetchAllDirtyJunctionsEvent,
  StoreDirtySignalEvent,
  RemoveDirtySignalEvent,
  CleanDirtySignalEvent,
  FetchAllDirtySignalsEvent,
} from './constant';
import {
  DirtyRoadInfo,
  DirtyRoadInfoCollection,
  DirtyJunctionInfo,
  DirtyJunctionInfoCollection,
  DirtySignalInfo,
  DirtySignalInfoCollection,
  LineAndCurveCategory,
  LineAndCurveItem,
  DisposeLineAndCurveMarkerOpt,
  LaneSide,
  LaneItem,
  RoadItem,
  RoadCategory,
  DisposeRoadMarkerOpt,
  LaneItemKeyInfo,
  RoadItemKeyInfo,
  JunctionEdgeItem,
  JunctionEdgeItemKeyInfo,
  JunctionItem,
  JunctionItemKeyInfo,
  SignalItem,
  SignalItemKeyInfo,
  SubSignalItem,
  SubSignalItemKeyInfo,
} from './type';

export default class StatusManagerPlugin extends LogicalPlugin {
  private twoStraightLineCollection: LineAndCurveItem[];
  private threeCircleCurveCollection: LineAndCurveItem[];
  private quadraticBezierCurveCollection: LineAndCurveItem[];
  private cubicBezierCurveCollection: LineAndCurveItem[];

  private twoStraightLineRoadCollection: RoadItem[];
  private threeCircleCurveRoadCollection: RoadItem[];
  private quadraticBezierCurveRoadCollection: RoadItem[];
  private cubicBezierCurveRoadCollection: RoadItem[];
  private catmullSerieRoadCollection: RoadItem[];
  private connectionRoadCollection: RoadItem[];

  private junctionCollection: JunctionItem[];

  private signalCollection: SignalItem[];

  private dirtyRoadInfoCollection: DirtyRoadInfoCollection;
  private dirtyJunctionInfoCollection: DirtyJunctionInfoCollection;
  private dirtySignalInfoCollection: DirtySignalInfoCollection;

  constructor(options: PluginOptions) {
    super(options);

    this.twoStraightLineCollection = [];
    this.threeCircleCurveCollection = [];
    this.quadraticBezierCurveCollection = [];
    this.cubicBezierCurveCollection = [];

    this.twoStraightLineRoadCollection = [];
    this.threeCircleCurveRoadCollection = [];
    this.quadraticBezierCurveRoadCollection = [];
    this.cubicBezierCurveRoadCollection = [];
    this.catmullSerieRoadCollection = [];
    this.connectionRoadCollection = [];

    this.junctionCollection = [];

    this.signalCollection = [];

    this.dirtyRoadInfoCollection = {};
    this.dirtyJunctionInfoCollection = {};
    this.dirtySignalInfoCollection = {};
  }

  activate() {
    super.activate();

    this.init();
  }

  init() {
    this.initDisposeLineAndCurveMarkerEvent();
    this.initDisposeRoadMarkerEvent();

    this.initOperateLineAndCurveEvent();
    this.initOperateRoadEvent();
    this.initOperateJunctionEvent();
    this.initOperateSignalEvent();

    this.initOperateDirtyRoadEvent();
    this.initOperateDirtyJunctionEvent();
    this.initOperateDirtySignalEvent();
  }

  initDisposeLineAndCurveMarkerEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(DisposeLineAndCurveMarkerEvent);
    scope.onEvent(DisposeLineAndCurveMarkerEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as DisposeLineAndCurveMarkerOpt;

      if (payload.twoStraightLinePerm) {
        this.twoStraightLineCollection.forEach((item: LineAndCurveItem) => {
          if (!item.markerDisposed) {
            item.pointsMesh.forEach((m: Mesh) => {
              m.dispose();
              scope.makeSceneDirty();
            });
            item.markerDisposed = true;
          }
        });
      }

      if (payload.threeCircleCurvePerm) {
        this.threeCircleCurveCollection.forEach((item: LineAndCurveItem) => {
          if (!item.markerDisposed) {
            item.pointsMesh.forEach((m: Mesh) => {
              m.dispose();
              scope.makeSceneDirty();
            });
            item.markerDisposed = true;
          }
        });
      }

      if (payload.quadraticBezierCurvePerm) {
        this.quadraticBezierCurveCollection.forEach((item: LineAndCurveItem) => {
          if (!item.markerDisposed) {
            item.pointsMesh.forEach((m: Mesh) => {
              m.dispose();
              scope.makeSceneDirty();
            });
            item.markerDisposed = true;
          }
        });
      }

      if (payload.cubicBezierCurvePerm) {
        this.cubicBezierCurveCollection.forEach((item: LineAndCurveItem) => {
          if (!item.markerDisposed) {
            item.pointsMesh.forEach((m: Mesh) => {
              m.dispose();
              scope.makeSceneDirty();
            });
            item.markerDisposed = true;
          }
        });
      }
    });
  }

  initDisposeRoadMarkerEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(DisposeRoadMarkerEvent);
    scope.onEvent(DisposeRoadMarkerEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as DisposeRoadMarkerOpt;

      if (payload.twoStraightLineRoadPerm) {
        this.twoStraightLineRoadCollection.forEach((item: RoadItem) => {
          const referrenceLine = item.referenceLine;

          scope.makeSceneDirty();

          if (!referrenceLine.markerDisposed) {
            referrenceLine.pointsMesh.forEach((m: Mesh) => {
              m.dispose();
              scope.makeSceneDirty();
            });
            referrenceLine.markerDisposed = true;
          }
        });
      }

      if (payload.threeCircleCurveRoadPerm) {
        this.threeCircleCurveRoadCollection.forEach((item: RoadItem) => {
          const referrenceLine = item.referenceLine;

          scope.makeSceneDirty();

          if (!referrenceLine.markerDisposed) {
            referrenceLine.pointsMesh.forEach((m: Mesh) => {
              m.dispose();
              scope.makeSceneDirty();
            });
            referrenceLine.markerDisposed = true;
          }
        });
      }

      if (payload.quadraticBezierCurveRoadPerm) {
        this.quadraticBezierCurveRoadCollection.forEach((item: RoadItem) => {
          const referrenceLine = item.referenceLine;

          scope.makeSceneDirty();

          if (!referrenceLine.markerDisposed) {
            referrenceLine.pointsMesh.forEach((m: Mesh) => {
              m.dispose();
              scope.makeSceneDirty();
            });
            referrenceLine.markerDisposed = true;
          }
        });
      }

      if (payload.cubicBezierCurveRoadPerm) {
        this.cubicBezierCurveRoadCollection.forEach((item: RoadItem) => {
          const referrenceLine = item.referenceLine;

          scope.makeSceneDirty();

          if (!referrenceLine.markerDisposed) {
            referrenceLine.pointsMesh.forEach((m: Mesh) => {
              m.dispose();
              scope.makeSceneDirty();
            });
            referrenceLine.markerDisposed = true;
          }
        });
      }

      if (payload.catmullSerieRoadPerm) {
        this.catmullSerieRoadCollection.forEach((item: RoadItem) => {
          const referrenceLine = item.referenceLine;

          scope.makeSceneDirty();

          if (!referrenceLine.markerDisposed) {
            referrenceLine.pointsMesh.forEach((m: Mesh) => {
              m.dispose();
              scope.makeSceneDirty();
            });
            referrenceLine.markerDisposed = true;
          }
        });
      }
    });
  }

  initOperateLineAndCurveEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(StoreLineAndCurveEvent);
    scope.onEvent(StoreLineAndCurveEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as LineAndCurveItem;

      if (payload.category === LineAndCurveCategory.TwoStraightLine) {
        this.twoStraightLineCollection.push(payload);
      }

      if (payload.category === LineAndCurveCategory.ThreeCircleCurve) {
        this.threeCircleCurveCollection.push(payload);
      }

      if (payload.category === LineAndCurveCategory.QuadraticBezierCurve) {
        this.quadraticBezierCurveCollection.push(payload);
      }

      if (payload.category === LineAndCurveCategory.CubicBezierCurve) {
        this.cubicBezierCurveCollection.push(payload);
      }
    });

    scope.registerEvent(RemoveLineAndCurveEvent);
    scope.onEvent(RemoveLineAndCurveEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { id: string, category: LineAndCurveCategory, callback: Function };
      let removed: LineAndCurveItem | null = null;
      let removedIndex: number | null = null;

      if (payload.category === LineAndCurveCategory.TwoStraightLine) {
        this.twoStraightLineCollection.forEach((item: LineAndCurveItem, idx: number) => {
          if (item.lineAndCurveMesh.id === payload.id) {
            removed = item;
            removedIndex = idx;
          }
        });

        if (removedIndex !== null) this.twoStraightLineCollection.splice(removedIndex, 1);
        if (removed) payload.callback(removed);
      }

      if (payload.category === LineAndCurveCategory.ThreeCircleCurve) {
        this.threeCircleCurveCollection.forEach((item: LineAndCurveItem, idx: number) => {
          if (item.lineAndCurveMesh.id === payload.id) {
            removed = item;
            removedIndex = idx;
          }
        });

        if (removedIndex !== null) this.threeCircleCurveCollection.splice(removedIndex, 1);
        if (removed) payload.callback(removed);
      }

      if (payload.category === LineAndCurveCategory.QuadraticBezierCurve) {
        this.quadraticBezierCurveCollection.forEach((item: LineAndCurveItem, idx: number) => {
          if (item.lineAndCurveMesh.id === payload.id) {
            removed = item;
            removedIndex = idx;
          }
        });

        if (removedIndex !== null) this.quadraticBezierCurveCollection.splice(removedIndex, 1);
        if (removed) payload.callback(removed);
      }

      if (payload.category === LineAndCurveCategory.CubicBezierCurve) {
        this.cubicBezierCurveCollection.forEach((item: LineAndCurveItem, idx: number) => {
          if (item.lineAndCurveMesh.id === payload.id) {
            removed = item;
            removedIndex = idx;
          }
        });

        if (removedIndex !== null) this.cubicBezierCurveCollection.splice(removedIndex, 1);
        if (removed) payload.callback(removed);
      }
    });
  }

  initOperateRoadEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(FetchAllRoadsEvent);
    scope.onEvent(FetchAllRoadsEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        callback: Function,
      };

      payload.callback({
        twoStraightLineRoadCollection: this.twoStraightLineRoadCollection,
        threeCircleCurveRoadCollection: this.threeCircleCurveRoadCollection,
        quadraticBezierCurveRoadCollection: this.quadraticBezierCurveRoadCollection,
        cubicBezierCurveRoadCollection: this.cubicBezierCurveRoadCollection,
        catmullSerieRoadCollection: this.catmullSerieRoadCollection,
        connectionRoadCollection: this.connectionRoadCollection,
      });
    });

    scope.registerEvent(ResolveRoadByIdAndCategoryEvent);
    scope.onEvent(ResolveRoadByIdAndCategoryEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        roadId: string,
        roadCategory: RoadCategory,
        callback: Function,
      };

      payload.callback(scope.innerResolveRoad(payload.roadId, payload.roadCategory) || undefined);
    });

    scope.registerEvent(StoreRoadEvent);
    scope.onEvent(StoreRoadEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as RoadItem;

      if (payload.category === RoadCategory.TwoStraightLineRoad) {
        this.twoStraightLineRoadCollection.push(payload);
      }

      if (payload.category === RoadCategory.ThreeCircleCurveRoad) {
        this.threeCircleCurveRoadCollection.push(payload);
      }

      if (payload.category === RoadCategory.QuadraticBezierCurveRoad) {
        this.quadraticBezierCurveRoadCollection.push(payload);
      }

      if (payload.category === RoadCategory.CubicBezierCurveRoad) {
        this.cubicBezierCurveRoadCollection.push(payload);
      }

      if (payload.category === RoadCategory.CatmullSerieRoad) {
        this.catmullSerieRoadCollection.push(payload);
      }

      if (payload.category === RoadCategory.ConnectionRoad) {
        this.connectionRoadCollection.push(payload);
      }
    });
    scope.registerEvent(RemoveRoadEvent);
    scope.onEvent(RemoveRoadEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { id: string, category: RoadCategory };
      let removed: RoadItem | null = null;
      let removedIndex: number | null = null;

      if (payload.category === RoadCategory.TwoStraightLineRoad) {
        this.twoStraightLineRoadCollection.forEach((item: RoadItem, idx: number) => {
          if (item.roadId === payload.id) {
            removed = item;
            removedIndex = idx;
          }
        });

        if (removedIndex !== null) this.twoStraightLineRoadCollection.splice(removedIndex, 1);
        if (removed) scope.removeRoadAction(removed);
      }

      if (payload.category === RoadCategory.ThreeCircleCurveRoad) {
        this.threeCircleCurveRoadCollection.forEach((item: RoadItem, idx: number) => {
          if (item.roadId === payload.id) {
            removed = item;
            removedIndex = idx;
          }
        });

        if (removedIndex !== null) this.threeCircleCurveRoadCollection.splice(removedIndex, 1);
        if (removed) scope.removeRoadAction(removed);
      }

      if (payload.category === RoadCategory.QuadraticBezierCurveRoad) {
        this.quadraticBezierCurveRoadCollection.forEach((item: RoadItem, idx: number) => {
          if (item.roadId === payload.id) {
            removed = item;
            removedIndex = idx;
          }
        });

        if (removedIndex !== null) this.quadraticBezierCurveRoadCollection.splice(removedIndex, 1);
        if (removed) scope.removeRoadAction(removed);
      }

      if (payload.category === RoadCategory.CubicBezierCurveRoad) {
        this.cubicBezierCurveRoadCollection.forEach((item: RoadItem, idx: number) => {
          if (item.roadId === payload.id) {
            removed = item;
            removedIndex = idx;
          }
        });

        if (removedIndex !== null) this.cubicBezierCurveRoadCollection.splice(removedIndex, 1);
        if (removed) scope.removeRoadAction(removed);
      }

      if (payload.category === RoadCategory.CatmullSerieRoad) {
        this.catmullSerieRoadCollection.forEach((item: RoadItem, idx: number) => {
          if (item.roadId === payload.id) {
            removed = item;
            removedIndex = idx;
          }
        });

        if (removedIndex !== null) this.catmullSerieRoadCollection.splice(removedIndex, 1);
        if (removed) scope.removeRoadAction(removed);
      }

      if (payload.category === RoadCategory.ConnectionRoad) {
        this.connectionRoadCollection.forEach((item: RoadItem, idx: number) => {
          if (item.roadId === payload.id) {
            removed = item;
            removedIndex = idx;
          }
        });

        if (removedIndex !== null) this.connectionRoadCollection.splice(removedIndex, 1);
        if (removed) scope.removeRoadAction(removed);
      }
    });

    scope.registerEvent(ReformatRoadEvent);
    scope.onEvent(ReformatRoadEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        roadId: string,
        roadCategory: RoadCategory,
        roadItemKeyInfo: RoadItemKeyInfo,
        reflineKeyPoints: Vector3[],
      };

      const roadItem = scope.innerResolveRoad(payload.roadId, payload.roadCategory);

      scope.inlineReformatRoadReferenceLine(payload.roadItemKeyInfo, roadItem, payload.reflineKeyPoints);
      scope.inlineReformatRoadSurfaceLines(payload.roadItemKeyInfo, roadItem, payload.reflineKeyPoints);
      scope.inlineReformatRoadLeftAndRightLanes(payload.roadItemKeyInfo, roadItem);
    });

    scope.registerEvent(UpdateOneSideLanesRoadEvent);
    scope.onEvent(UpdateOneSideLanesRoadEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        roadId: string,
        roadCategory: RoadCategory,
        laneSide: LaneSide,
        laneItemsKeyInfo: LaneItemKeyInfo[],
        reflineKeyPoints: Vector3[],
      };

      const roadItem = scope.innerResolveRoad(payload.roadId, payload.roadCategory);

      scope.inlineUpdateRoadLanesInOneSide(payload.laneItemsKeyInfo, payload.laneSide, roadItem);
    });

    scope.registerEvent(UpdateReferenceLineEditableRoadEvent);
    scope.onEvent(UpdateReferenceLineEditableRoadEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        roadId: string,
        roadCategory: RoadCategory,
        referenceLineEditable: boolean,
      };

      const roadItem = scope.innerResolveRoad(payload.roadId, payload.roadCategory);
      roadItem.referenceLineEditable = payload.referenceLineEditable;
    });
  }

  innerResolveRoad(roadId: string, roadCategory: RoadCategory) {
    const scope = this as unknown as ExtendedNamespace;

    if (roadCategory === RoadCategory.TwoStraightLineRoad) {
      const roadItem = this.twoStraightLineRoadCollection.find((roadItem: RoadItem) => {
        return roadItem.roadId === roadId;
      });

      return roadItem || undefined;
    } else if (roadCategory === RoadCategory.ThreeCircleCurveRoad) {
      const roadItem = this.threeCircleCurveRoadCollection.find((roadItem: RoadItem) => {
        return roadItem.roadId === roadId;
      });

      return roadItem || undefined;
    } else if (roadCategory === RoadCategory.QuadraticBezierCurveRoad) {
      const roadItem = this.quadraticBezierCurveRoadCollection.find((roadItem: RoadItem) => {
        return roadItem.roadId === roadId;
      });

      return roadItem || undefined;
    } else if (roadCategory === RoadCategory.CubicBezierCurveRoad) {
      const roadItem = this.cubicBezierCurveRoadCollection.find((roadItem: RoadItem) => {
        return roadItem.roadId === roadId;
      });

      return roadItem || undefined;
    } else if (roadCategory === RoadCategory.CatmullSerieRoad) {
      const roadItem = this.catmullSerieRoadCollection.find((roadItem: RoadItem) => {
        return roadItem.roadId === roadId;
      });

      return roadItem || undefined;
    } else if (roadCategory === RoadCategory.ConnectionRoad) {
      const roadItem = this.connectionRoadCollection.find((roadItem: RoadItem) => {
        return roadItem.roadId === roadId;
      });

      return roadItem || undefined;
    }

    return undefined;
  }

  initOperateJunctionEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(FetchAllJunctionsEvent);
    scope.onEvent(FetchAllJunctionsEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        callback: Function,
      };

      payload.callback({
        junctionCollection: this.junctionCollection,
      });
    });

    scope.registerEvent(ResolveJunctionByIdEvent);
    scope.onEvent(ResolveJunctionByIdEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        junctionId: string,
        callback: Function,
      };

      payload.callback(scope.innerResolveJunction(payload.junctionId) || undefined);
    });

    scope.registerEvent(StoreJunctionEvent);
    scope.onEvent(StoreJunctionEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as JunctionItem;

      this.junctionCollection.push(payload);
    });

    scope.registerEvent(RemoveJunctionEvent);
    scope.onEvent(RemoveJunctionEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { id: string };
      let removed: JunctionItem | null = null;
      let removedIndex: number | null = null;

      this.junctionCollection.forEach((item: JunctionItem, idx: number) => {
        if (item.junctionId === payload.id) {
          removed = item;
          removedIndex = idx;
        }
      });

      if (removedIndex !== null) this.junctionCollection.splice(removedIndex, 1);
      if (removed) scope.removeJunctionAction(removed);
    });

    scope.registerEvent(ReformatJunctionEvent);
    scope.onEvent(ReformatJunctionEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        junctionId: string,
        junctionItemKeyInfo: JunctionItemKeyInfo,
      };

      const junctionItem = scope.innerResolveJunction(payload.junctionId);

      scope.inlineReformatJunction(payload.junctionItemKeyInfo, junctionItem);
    });
  }

  innerResolveJunction(junctionId: string) {
    const scope = this as unknown as ExtendedNamespace;

    const junctionItem = this.junctionCollection.find((jI: JunctionItem) => {
      return jI.junctionId === junctionId;
    });

    return junctionItem || undefined;
  }

  initOperateSignalEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(FetchAllSignalsEvent);
    scope.onEvent(FetchAllSignalsEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        callback: Function,
      };

      payload.callback({
        signalCollection: this.signalCollection,
      });
    });

    scope.registerEvent(ResolveSignalByIdEvent);
    scope.onEvent(ResolveSignalByIdEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        signalId: string,
        callback: Function,
      };

      payload.callback(scope.innerResolveSignal(payload.signalId) || undefined);
    });

    scope.registerEvent(StoreSignalEvent);
    scope.onEvent(StoreSignalEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as SignalItem;

      this.signalCollection.push(payload);
    });

    scope.registerEvent(RemoveSignalEvent);
    scope.onEvent(RemoveSignalEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { id: string };
      let removed: SignalItem | null = null;
      let removedIndex: number | null = null;

      this.signalCollection.forEach((item: SignalItem, idx: number) => {
        if (item.signalId === payload.id) {
          removed = item;
          removedIndex = idx;
        }
      });

      if (removedIndex !== null) this.signalCollection.splice(removedIndex, 1);
      if (removed) scope.removeSignalAction(removed);
    });

    scope.registerEvent(ReformatSignalEvent);
    scope.onEvent(ReformatSignalEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        signalId: string,
        signalItemKeyInfo: SignalItemKeyInfo,
      };

      const signalItem = scope.innerResolveSignal(payload.signalId);

      scope.inlineReformatSignal(payload.signalItemKeyInfo, signalItem);
    });
  }

  innerResolveSignal(signalId: string) {
    const scope = this as unknown as ExtendedNamespace;

    const signalItem = this.signalCollection.find((sI: SignalItem) => {
      return sI.signalId === signalId;
    });

    return signalItem || undefined;
  }

  initOperateDirtyRoadEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(FetchAllDirtyRoadsEvent);
    scope.onEvent(FetchAllDirtyRoadsEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        callback: Function,
      };

      payload.callback(this.dirtyRoadInfoCollection);
    });

    scope.registerEvent(StoreDirtyRoadEvent);
    scope.onEvent(StoreDirtyRoadEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { roadPID: string; roadId: string; roadCategory: RoadCategory };

      this.dirtyRoadInfoCollection[payload.roadId] = {
        roadPID: payload.roadPID,
        roadId: payload.roadId,
        roadCategory: payload.roadCategory,
      };
    });

    scope.registerEvent(RemoveDirtyRoadEvent);
    scope.onEvent(RemoveDirtyRoadEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { roadId: string };

      delete this.dirtyRoadInfoCollection[payload.roadId];
    });

    scope.registerEvent(CleanDirtyRoadEvent);
    scope.onEvent(CleanDirtyRoadEvent, (params: { payload: Object | string | number | null }) => {
      this.dirtyRoadInfoCollection = {};
    });
  }

  initOperateDirtyJunctionEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(FetchAllDirtyJunctionsEvent);
    scope.onEvent(FetchAllDirtyJunctionsEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        callback: Function,
      };

      payload.callback(this.dirtyJunctionInfoCollection);
    });

    scope.registerEvent(StoreDirtyJunctionEvent);
    scope.onEvent(StoreDirtyJunctionEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { junctionPID: string; junctionId: string };

      this.dirtyJunctionInfoCollection[payload.junctionId] = {
        junctionId: payload.junctionId,
        junctionPID: payload.junctionPID,
      };
    });

    scope.registerEvent(RemoveDirtyJunctionEvent);
    scope.onEvent(RemoveDirtyJunctionEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { junctionId: string };

      delete this.dirtyJunctionInfoCollection[payload.junctionId];
    });

    scope.registerEvent(CleanDirtyJunctionEvent);
    scope.onEvent(CleanDirtyJunctionEvent, (params: { payload: Object | string | number | null }) => {
      this.dirtyJunctionInfoCollection = {};
    });
  }

  initOperateDirtySignalEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(FetchAllDirtySignalsEvent);
    scope.onEvent(FetchAllDirtySignalsEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        callback: Function,
      };

      payload.callback(this.dirtySignalInfoCollection);
    });

    scope.registerEvent(StoreDirtySignalEvent);
    scope.onEvent(StoreDirtySignalEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { signalPID: string; signalId: string };

      this.dirtySignalInfoCollection[payload.signalId] = {
        signalId: payload.signalId,
        signalPID: payload.signalPID,
      };
    });

    scope.registerEvent(RemoveDirtySignalEvent);
    scope.onEvent(RemoveDirtySignalEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { signalId: string };

      delete this.dirtySignalInfoCollection[payload.signalId];
    });

    scope.registerEvent(CleanDirtySignalEvent);
    scope.onEvent(CleanDirtySignalEvent, (params: { payload: Object | string | number | null }) => {
      this.dirtySignalInfoCollection = {};
    });
  }
};