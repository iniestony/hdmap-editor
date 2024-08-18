import {
  Vector3,
  Curve3,
  Mesh,
} from "@babylonjs/core";
import AddLaneRawCurveRoadTransaction from './addLaneRawCurveRoad';
import { LineAndCurveCategory, RoadCategory, LaneSide, MarkerSide } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';
import {
  InvokeAddLaneQuadraticBezierCurveRoadEvent,
  InvokeRemoveLaneQuadraticBezierCurveRoadEvent,
} from '../event';


export default class AddLaneQuadraticBezierCurveRoadTransaction extends AddLaneRawCurveRoadTransaction {
  constructor(options: Object) {
    super(options);
  }

  commit() {
    const result = super.commit();

    this.scope.emitEvent(InvokeAddLaneQuadraticBezierCurveRoadEvent, {
      roadId: this.roadId,
    });

    return result;
  }

  onUndo() {
    super.onUndo();

    this.scope.emitEvent(InvokeRemoveLaneQuadraticBezierCurveRoadEvent, {
      roadId: this.roadId,
    });
  }

  onRedo() {
    super.onRedo();

    this.scope.emitEvent(InvokeAddLaneQuadraticBezierCurveRoadEvent, {
      roadId: this.roadId,
    });
  }
};