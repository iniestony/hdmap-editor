import {
  Vector3,
  Curve3,
  Mesh,
} from "@babylonjs/core";
import RemoveLaneRawCurveRoadTransaction from './removeLaneRawCurveRoad';
import { LineAndCurveCategory, RoadCategory, LaneSide, MarkerSide } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';
import {
  InvokeAddLaneThreeCircleCurveRoadEvent,
  InvokeRemoveLaneThreeCircleCurveRoadEvent,
} from '../event';


export default class RemoveLaneThreeCircleCurveRoadTransaction extends RemoveLaneRawCurveRoadTransaction {
  constructor(options: Object) {
    super(options);
  }

  commit() {
    const result = super.commit();

    this.scope.emitEvent(InvokeRemoveLaneThreeCircleCurveRoadEvent, {
      roadId: this.roadId,
    });

    return result;
  }

  onUndo() {
    super.onUndo();

    this.scope.emitEvent(InvokeAddLaneThreeCircleCurveRoadEvent, {
      roadId: this.roadId,
    });
  }

  onRedo() {
    super.onRedo();

    this.scope.emitEvent(InvokeRemoveLaneThreeCircleCurveRoadEvent, {
      roadId: this.roadId,
    });
  }
};