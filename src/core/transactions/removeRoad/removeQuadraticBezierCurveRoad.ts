import {
  Vector3,
  Curve3,
  Mesh,
} from "@babylonjs/core";
import RemoveRawCurveRoadTransaction from './removeRawCurveRoad';
import { LineAndCurveCategory, RoadCategory, LaneSide, MarkerSide } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';
import {
  InvokeCreateQuadraticBezierCurveRoadEvent,
  InvokeRemoveQuadraticBezierCurveRoadEvent,
  InvokeReformatQuadraticBezierCurveRoadEvent,
} from '../event';

export default class RemoveQuadraticBezierCurveRoadTransaction extends RemoveRawCurveRoadTransaction {
  constructor(options: Object) {
    super(options);
  }

  commit() {
    const result = super.commit();

    this.scope.emitEvent(InvokeRemoveQuadraticBezierCurveRoadEvent, {
      roadId: this.roadId,
    });

    return result;
  }

  onUndo() {
    super.onUndo();

    this.scope.emitEvent(InvokeCreateQuadraticBezierCurveRoadEvent, {
      roadId: this.roadId,
    });

    const reflineKeyPoints = [...(this.oldReflinePoints as Vector3[])];
    this.scope.emitEvent(InvokeReformatQuadraticBezierCurveRoadEvent, {
      reflinePoints: reflineKeyPoints,
    });
  }

  onRedo() {
    super.onRedo();

    this.scope.emitEvent(InvokeRemoveQuadraticBezierCurveRoadEvent, {
      roadId: this.roadId,
    });
  }
};