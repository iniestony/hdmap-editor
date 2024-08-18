import {
  Vector3,
  Curve3,
  Mesh,
} from "@babylonjs/core";
import RemoveLaneRawCurveRoadTransaction from './removeLaneRawCurveRoad';
import { LineAndCurveCategory, RoadCategory, LaneSide, MarkerSide } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';
import {
  InvokeAddLaneQuadraticBezierCurveRoadEvent,
  InvokeRemoveLaneQuadraticBezierCurveRoadEvent,
} from '../event';


export default class RemoveLaneQuadraticBezierCurveRoadTransaction extends RemoveLaneRawCurveRoadTransaction {
  constructor(options: Object) {
    super(options);
  }

  commit() {
    const result = super.commit();

    this.scope.emitEvent(InvokeRemoveLaneQuadraticBezierCurveRoadEvent, {
      roadId: this.roadId,
    });

    return result;
  }

  onUndo() {
    super.onUndo();

    this.scope.emitEvent(InvokeAddLaneQuadraticBezierCurveRoadEvent, {
      roadId: this.roadId,
    });
  }

  onRedo() {
    super.onRedo();

    this.scope.emitEvent(InvokeRemoveLaneQuadraticBezierCurveRoadEvent, {
      roadId: this.roadId,
    });
  }
};