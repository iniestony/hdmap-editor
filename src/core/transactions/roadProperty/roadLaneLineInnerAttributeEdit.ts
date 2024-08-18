import {
  RoadLaneLineAttributeEdit
} from '../../plugins/roadLaneEditor/type';
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
  InvokeRoadLaneLineInnerAttributeEditEvent,
} from '../event';
import RendererConfig from '../../../core/renderer/config';

export default class RoadLaneLineInnerAttributeEditTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private roadId: string;
  private landId: string;
  private roadCategory: RoadCategory;

  private roadLaneLineAttributeEdit: RoadLaneLineAttributeEdit;
  private oldRoadLaneLineAttributeEdit: RoadLaneLineAttributeEdit;

  private roadItem?: RoadItem;
  private laneItem?: LaneItem;
  private laneLineItem?: LaneLineItem;

  constructor(options: Object) {
    super(options);
    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.landId = (options as unknown as { landId: string }).landId;

    this.roadLaneLineAttributeEdit = (options as unknown as { roadLaneLineAttributeEdit: RoadLaneLineAttributeEdit }).roadLaneLineAttributeEdit;
    this.oldRoadLaneLineAttributeEdit = {
      ...this.roadLaneLineAttributeEdit
    } as RoadLaneLineAttributeEdit;
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
    this.laneLineItem = this.laneItem.laneLines.innerLaneLine;

    for (let key in this.roadLaneLineAttributeEdit) {
      if (this.hasOwnProperty(this.oldRoadLaneLineAttributeEdit, key) && this.hasOwnProperty(this.laneLineItem, key)) {
        this.oldRoadLaneLineAttributeEdit[key] = this.laneLineItem[key];
      }
    };
  }

  reformatNewRoad() {
    const laneItem = this.laneItem as LaneItem;
    const roadItem = this.roadItem as RoadItem;
    const laneLineItem = laneItem.laneLines.innerLaneLine;

    for (let key in this.roadLaneLineAttributeEdit) {
      if (this.hasOwnProperty(laneLineItem, key) && this.hasOwnProperty(this.roadLaneLineAttributeEdit, key)) {
        laneLineItem[key] = this.roadLaneLineAttributeEdit[key];
      }
    };

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadLaneLineInnerAttributeEditEvent, {
      landId: this.landId,
    });
  }

  reformatOldRoad() { 
    const roadItem = this.roadItem as RoadItem;
    const laneItem = this.laneItem as LaneItem;
    const laneLineItem = laneItem.laneLines.innerLaneLine;

    for (let key in this.roadLaneLineAttributeEdit) {
      if (this.hasOwnProperty(laneLineItem, key) && this.hasOwnProperty(this.roadLaneLineAttributeEdit, key) && this.hasOwnProperty(this.oldRoadLaneLineAttributeEdit, key)) {
        laneLineItem[key] = this.oldRoadLaneLineAttributeEdit[key];
      }
    };

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadLaneLineInnerAttributeEditEvent, {
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