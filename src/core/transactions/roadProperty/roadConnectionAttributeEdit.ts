import { ExtendedNamespace } from '../../types/plugins/raw';
import {
  AtlasRoad,
} from '../../../core/plugins/atlasConverter/type';
import {
  RoadItemConnectionAttributeEdit,
} from '../../../core/plugins/roadConnectionEditor/type'
import {
  RoadItem,
  LaneItemKeyInfo,
  LaneItem,
  RoadCategory,
} from '../../plugins/statusManager/type';
import {
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import {
  InvokeRoadConnectionAttributeEditEvent,
} from '../event';
import StandardTransaction from '../general/standard';

export default class RoadConnectionAttributeEditTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private roadId: string;
  private roadCategory: RoadCategory;
  private roadItemConnectionAttributeEdit: RoadItemConnectionAttributeEdit;
  private oldRoadItemConnectionAttributeEdit: RoadItemConnectionAttributeEdit;

  private roadItem?: RoadItem;

  constructor(options: Object) {
    super(options);
    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadItemConnectionAttributeEdit = (options as unknown as { roadItemConnectionAttributeEdit: RoadItemConnectionAttributeEdit }).roadItemConnectionAttributeEdit;
    this.oldRoadItemConnectionAttributeEdit = {};
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
    this.roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;

    for (let n in this.roadItemConnectionAttributeEdit) {
      const roadItemConnectionAttributeEdit = this.roadItemConnectionAttributeEdit;
      const key = n as keyof typeof roadItemConnectionAttributeEdit;
      this.oldRoadItemConnectionAttributeEdit[key] = this.roadItem[key];
    };

  }


  reformatNewRoad() {
    const roadItem = this.roadItem as RoadItem;

    for (let n in this.roadItemConnectionAttributeEdit) {
      const roadItemConnectionAttributeEdit = this.roadItemConnectionAttributeEdit;
      const key = n as keyof typeof roadItemConnectionAttributeEdit;
      if (roadItemConnectionAttributeEdit[key] !== undefined) {
        roadItem[key] = roadItemConnectionAttributeEdit[key];
      };
    };

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadConnectionAttributeEditEvent, {
      roadId: this.roadId,
    });
  }

  reformatOldRoad() {
    const roadItem = this.roadItem as RoadItem;

    for (let n in this.oldRoadItemConnectionAttributeEdit) {
      const oldRoadItemConnectionAttributeEdit = this.oldRoadItemConnectionAttributeEdit;
      const key = n as keyof typeof oldRoadItemConnectionAttributeEdit;
      if (oldRoadItemConnectionAttributeEdit[key] !== undefined) {
        roadItem[key] = oldRoadItemConnectionAttributeEdit[key];
      };
    };

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadConnectionAttributeEditEvent, {
      roadId: this.roadId,
    });
  }
}