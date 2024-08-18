import {
  Vector3,
  Curve3,
  Mesh,
} from "@babylonjs/core";
import LaneWidthEditRawCurveRoadTransaction from './laneWidthEditRawCurveRoad';
import { LineAndCurveCategory, RoadCategory, LaneSide, MarkerSide } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';
import {
  InvokeLaneWidthEditQuadraticBezierCurveRoadEvent,
} from '../event';


export default class LaneWidthEditQuadraticBezierCurveRoadTransaction extends LaneWidthEditRawCurveRoadTransaction {
  constructor(options: Object) {
    super(options);
  }

  commit() {
    const result = super.commit();

    this.scope.emitEvent(InvokeLaneWidthEditQuadraticBezierCurveRoadEvent, {
      laneId: this.laneId,
    });

    return result;
  }

  onUndo() {
    super.onUndo();

    this.scope.emitEvent(InvokeLaneWidthEditQuadraticBezierCurveRoadEvent, {
      laneId: this.laneId,
    });
  }

  onRedo() {
    super.onRedo();

    this.scope.emitEvent(InvokeLaneWidthEditQuadraticBezierCurveRoadEvent, {
      laneId: this.laneId,
    });
  }
};