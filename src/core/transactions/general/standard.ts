import RawTransaction from './raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import {
  LineAndCurveCategory,
  LineAndCurveItem,
  LaneItem,
  RoadItem,
  RoadCategory,
  LaneSide,
  LaneLineSide,
  MarkerSide,
  LineAndCurveItemKeyInfo,
  LaneLineItemKeyInfo,
  LaneItemKeyInfo,
  RoadItemKeyInfo,
} from '../../plugins/statusManager/type';
import {
  InvokeRoadLaneLineSeriePointsOnlyPostInvalidEvent,
  InvokeRoadLaneLineSeriePointsPreAndPostInvalidEvent,
} from '../event';

export default class StandardTransaction extends RawTransaction {
  private standardScope: ExtendedNamespace;
  protected preTransactionValidRoad: boolean;
  protected postTransactionValidRoad: boolean;

  constructor(options: Object) {
    super(options);

    this.standardScope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.isCompositionTransaction = false;

    this.preTransactionValidRoad = true;
    this.postTransactionValidRoad = true;
  }

  commit() {
    super.commit();
  }

  onUndo() {
    super.onUndo();
  }

  onRedo() {
    super.onRedo();
  }

  preValidateRoad(roadId: string, roadCategory: RoadCategory) {
    this.preTransactionValidRoad = this.standardScope.validateCatmullSerieRoadLaneLineSeriePoints(roadId, roadCategory);
  }

  postValidateRoad(roadId: string, roadCategory: RoadCategory) {
    this.postTransactionValidRoad = this.standardScope.validateCatmullSerieRoadLaneLineSeriePoints(roadId, roadCategory);
  }

  dispatchInvalidRoadEvent(roadId: string, roadCategory: RoadCategory) {
    if (this.postTransactionValidRoad) return;

    if (this.preTransactionValidRoad) {
      this.standardScope.emitEvent(InvokeRoadLaneLineSeriePointsOnlyPostInvalidEvent, {
        roadId,
      });
    } else {
      this.standardScope.emitEvent(InvokeRoadLaneLineSeriePointsPreAndPostInvalidEvent, {
        roadId,
      });
    }
  }
};

