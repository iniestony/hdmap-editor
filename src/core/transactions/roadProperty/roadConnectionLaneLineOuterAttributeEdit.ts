import {
  RoadLaneLineAttributeEdit,
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
  InvokeRoadConnectionLaneOuterAttributeEditEvent,
} from '../event';
import RendererConfig from '../../renderer/config';

export default class RoadConnectionLaneLineOuterAttributeEditTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private roadId: string;
  private landId: string;
  private roadCategory: RoadCategory;

  private roadConnectionLaneLineAttributeEdit: RoadLaneLineAttributeEdit;
  private oldRoadConnectionLaneLineAttributeEdit: RoadLaneLineAttributeEdit;

  private roadItem?: RoadItem;
  private laneItem?: LaneItem;

  private laneLineItem?: LaneLineItem;

  constructor(options: Object) {
    super(options);
    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.landId = (options as unknown as { landId: string }).landId;

    this.roadConnectionLaneLineAttributeEdit = (options as unknown as { roadLaneLineAttributeEdit: RoadLaneLineAttributeEdit }).roadLaneLineAttributeEdit;
    this.oldRoadConnectionLaneLineAttributeEdit = {
      ...this.roadConnectionLaneLineAttributeEdit
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
    this.laneLineItem = this.laneItem.laneLines.outerLaneLine;

    for (let key in this.roadConnectionLaneLineAttributeEdit) {
      if (this.hasOwnProperty(this.oldRoadConnectionLaneLineAttributeEdit, key) && this.hasOwnProperty(this.laneLineItem, key)) {
        this.oldRoadConnectionLaneLineAttributeEdit[key] = this.laneLineItem[key];
      }
    };
  }

  reformatNewRoad() {
    const laneItem = this.laneItem as LaneItem;
    const roadItem = this.roadItem as RoadItem;
    const laneLineItem = laneItem.laneLines.outerLaneLine;

    for (let key in this.roadConnectionLaneLineAttributeEdit) {
      if (this.hasOwnProperty(laneLineItem, key) && this.hasOwnProperty(this.roadConnectionLaneLineAttributeEdit, key)) {
        laneLineItem[key] = this.roadConnectionLaneLineAttributeEdit[key];
      }
    };

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadConnectionLaneOuterAttributeEditEvent, {
      landId: this.landId,
    });
  }

  reformatOldRoad() {
    const roadItem = this.roadItem as RoadItem;
    const laneItem = this.laneItem as LaneItem;
    const laneLineItem = laneItem.laneLines.outerLaneLine;

    for (let key in this.roadConnectionLaneLineAttributeEdit) {
      if (this.hasOwnProperty(laneLineItem, key) && this.hasOwnProperty(this.roadConnectionLaneLineAttributeEdit, key) && this.hasOwnProperty(this.oldRoadConnectionLaneLineAttributeEdit, key)) {
        laneLineItem[key] = this.oldRoadConnectionLaneLineAttributeEdit[key];
      }
    };

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadConnectionLaneOuterAttributeEditEvent, {
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