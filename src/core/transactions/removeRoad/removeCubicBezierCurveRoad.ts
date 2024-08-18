import {
  Vector3,
  Curve3,
  Mesh,
} from "@babylonjs/core";
import RemoveRawCurveRoadTransaction from './removeRawCurveRoad';
import { LineAndCurveCategory, RoadCategory, LaneSide, MarkerSide } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';
import {
  InvokeCreateCubicBezierCurveRoadEvent,
  InvokeRemoveCubicBezierCurveRoadEvent,
  InvokeReformatCubicBezierCurveRoadEvent,
} from '../event';

export default class RemoveCubicBezierCurveRoadTransaction extends RemoveRawCurveRoadTransaction {
  constructor(options: Object) {
    super(options);
  }

  commit() {
    const result = super.commit();

    this.scope.emitEvent(InvokeRemoveCubicBezierCurveRoadEvent, {
      roadId: this.roadId,
    });

    return result;
  }

  onUndo() {
    super.onUndo();

    this.scope.emitEvent(InvokeCreateCubicBezierCurveRoadEvent, {
      roadId: this.roadId,
    });

    const reflineKeyPoints = [...(this.oldReflinePoints as Vector3[])];
    this.scope.emitEvent(InvokeReformatCubicBezierCurveRoadEvent, {
      reflinePoints: reflineKeyPoints,
    });
  }

  onRedo() {
    super.onRedo();

    this.scope.emitEvent(InvokeRemoveCubicBezierCurveRoadEvent, {
      roadId: this.roadId,
    });
  }
};