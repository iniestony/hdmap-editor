import {
  RoadLaneAttributeEdit,
} from '../../plugins/roadLaneEditor/type'
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
  InvokeRoadLaneAttributeEditEvent,
} from '../event';
import RendererConfig from '../../renderer/config';
export default class RoadLaneAttributeEditTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private roadId: string;
  private landId: string;
  private roadCategory: RoadCategory;

  private roadLaneAttributeEdit: RoadLaneAttributeEdit;
  private oldRoadLaneAttributeEdit: RoadLaneAttributeEdit;

  private roadItem?: RoadItem;
  private laneItem?: LaneItem;


  constructor(options: Object) {
    super(options);
    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.landId = (options as unknown as { landId: string }).landId;

    this.roadLaneAttributeEdit = (options as unknown as { roadLaneAttributeEdit: RoadLaneAttributeEdit }).roadLaneAttributeEdit;

    this.oldRoadLaneAttributeEdit = {
      atlasLaneSpeedLimit: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneSpeedLimit,
      atlasLaneType: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneType,
      atlasLaneTurn: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneTurn,
      atlasLaneDirection: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneDirection,
    } as RoadLaneAttributeEdit;

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

    for (let key in this.roadLaneAttributeEdit) {
      if (this.hasOwnProperty(this.oldRoadLaneAttributeEdit, key) && this.hasOwnProperty(this.laneItem, key)) {
        this.oldRoadLaneAttributeEdit[key] = this.laneItem[key];
      }
    };
  }

  reformatNewRoad() {
    const laneItem = this.laneItem as LaneItem;
    const roadItem = this.roadItem as RoadItem;
    for (let key in this.roadLaneAttributeEdit) {
      if (this.hasOwnProperty(laneItem, key) && this.hasOwnProperty(this.roadLaneAttributeEdit, key)) {
        laneItem[key] = this.roadLaneAttributeEdit[key];
      }
    };


    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadLaneAttributeEditEvent, {
      landId: this.landId,
    });
  }


  reformatOldRoad() {
    const roadItem = this.roadItem as RoadItem;
    const laneItem = this.laneItem as LaneItem;
    for (let key in this.roadLaneAttributeEdit) {
      if (this.hasOwnProperty(laneItem, key) && this.hasOwnProperty(this.roadLaneAttributeEdit, key) && this.hasOwnProperty(this.oldRoadLaneAttributeEdit, key)) {
        laneItem[key] = this.oldRoadLaneAttributeEdit[key];
      }
    };

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadLaneAttributeEditEvent, {
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