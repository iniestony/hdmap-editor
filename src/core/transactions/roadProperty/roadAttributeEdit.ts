import { ExtendedNamespace } from '../../types/plugins/raw';
import {
  AtlasRoad,
} from '../../../core/plugins/atlasConverter/type';
import {
  RoadItemAttributeEdit,
} from '../../../core/plugins/roadEditor/type'
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
  InvokeRoadAttributeEditEvent,
} from '../event';
import StandardTransaction from '../general/standard';

export default class RoadAttributeEditTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private roadId: string;
  private roadCategory: RoadCategory;
  private roadItemAttributeEdit: RoadItemAttributeEdit;
  private oldRoadItemAttributeEdit: RoadItemAttributeEdit;

  private roadItem?: RoadItem;

  constructor(options: Object) {
    super(options);
    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadItemAttributeEdit = (options as unknown as { roadItemAttributeEdit: RoadItemAttributeEdit }).roadItemAttributeEdit;
    this.oldRoadItemAttributeEdit = {};
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

    for (let n in this.roadItemAttributeEdit) {
      const roadItemAttributeEdit = this.roadItemAttributeEdit;
      const key = n as keyof typeof roadItemAttributeEdit;
      this.oldRoadItemAttributeEdit[key] = this.roadItem[key];
    };

  }


  reformatNewRoad() {
    const roadItem = this.roadItem as RoadItem;

    for (let n in this.roadItemAttributeEdit) {
      const roadItemAttributeEdit = this.roadItemAttributeEdit;
      const key = n as keyof typeof roadItemAttributeEdit;
      if (roadItemAttributeEdit[key] !== undefined) {
        roadItem[key]  = roadItemAttributeEdit[key];
      };
    };
    
    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadAttributeEditEvent, {
      roadId: this.roadId,
    });
  }

  reformatOldRoad() {
    const roadItem = this.roadItem as RoadItem;

    for (let n in this.oldRoadItemAttributeEdit) {
      const oldRoadItemAttributeEdit = this.oldRoadItemAttributeEdit;
      const key = n as keyof typeof oldRoadItemAttributeEdit;
      if (oldRoadItemAttributeEdit[key] !== undefined) {
        roadItem[key] = oldRoadItemAttributeEdit[key];
      };
    };

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRoadAttributeEditEvent, {
      roadId: this.roadId,
    });
  }
}