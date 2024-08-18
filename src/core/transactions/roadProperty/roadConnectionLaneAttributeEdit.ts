import {
  RoadConnectionLaneAttributeEdit,
} from '../../plugins/roadConnectionLaneEditor/type'
import {
  RoadItem,
  LaneItemKeyInfo,
  LaneItem,
  RoadCategory,
  LaneLineItem,
} from '../../plugins/statusManager/type';
import {
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import {
  AtlasLaneBoundaryType,
  AtlasLane,
} from '../../plugins/atlasConverter/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import StandardTransaction from '../general/standard';
import {
  InvokeRoadConnectionLaneAttributeEditEvent,
} from '../event';
import RendererConfig from '../../renderer/config';
export default class RoadConnectionLaneAttributeEditTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private roadId: string;
  private landId: string;
  private roadCategory: RoadCategory;

  private roadConnectionLaneAttributeEdit: RoadConnectionLaneAttributeEdit;
  private oldRoadConnectionLaneAttributeEdit: RoadConnectionLaneAttributeEdit;

  private roadItem?: RoadItem;
  private laneItem?: LaneItem;


  constructor(options: Object) {
    super(options);
    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.landId = (options as unknown as { landId: string }).landId;

    this.roadConnectionLaneAttributeEdit = (options as unknown as { roadConnectionLaneAttributeEdit: RoadConnectionLaneAttributeEdit }).roadConnectionLaneAttributeEdit;

    this.oldRoadConnectionLaneAttributeEdit = {
      atlasLaneSpeedLimit: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneSpeedLimit,
      atlasLaneType: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneType,
      atlasLaneTurn: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneTurn,
      atlasLaneDirection: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneDirection,
    } as RoadConnectionLaneAttributeEdit;

  }

  commit() {
    super.commit();
    this.resolveNecessaryInfo();
    this.reformatNewRoad();
    return { roadId: this.roadId };
  }

  onUndo() {
    super.onUndo();
    this.reformatOldRoad();
  }

  onRedo() {
    super.onRedo();
    this.resolveNecessaryInfo();
    this.reformatNewRoad();
  }

  resolveNecessaryInfo() {
    this.laneItem = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(this.landId, this.roadId, this.roadCategory) as LaneItem;
    this.roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;

    for (let key in this.roadConnectionLaneAttributeEdit) {
      if (this.hasOwnProperty(this.oldRoadConnectionLaneAttributeEdit, key) && this.hasOwnProperty(this.laneItem, key)) {
        this.oldRoadConnectionLaneAttributeEdit[key] = this.laneItem[key];
      }
    };
  }

  reformatNewRoad() {
    const laneItem = this.laneItem as LaneItem;
    const roadItem = this.roadItem as RoadItem;
    for (let key in this.roadConnectionLaneAttributeEdit) {
      if (this.hasOwnProperty(laneItem, key) && this.hasOwnProperty(this.roadConnectionLaneAttributeEdit, key)) {
        laneItem[key] = this.roadConnectionLaneAttributeEdit[key];
      }
    };


    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadConnectionLaneAttributeEditEvent, {
      landId: this.landId,
    });
  }


  reformatOldRoad() {
    const roadItem = this.roadItem as RoadItem;
    const laneItem = this.laneItem as LaneItem;
    for (let key in this.roadConnectionLaneAttributeEdit) {
      if (this.hasOwnProperty(laneItem, key) && this.hasOwnProperty(this.roadConnectionLaneAttributeEdit, key) && this.hasOwnProperty(this.oldRoadConnectionLaneAttributeEdit, key)) {
        laneItem[key] = this.oldRoadConnectionLaneAttributeEdit[key];
      }
    };

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadConnectionLaneAttributeEditEvent, {
      landId: this.landId,
    });
  }

  hasOwnProperty<T, K extends PropertyKey>(
    obj: T,
    prop: K
  ): obj is T & Record<K, unknown> {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  }

}