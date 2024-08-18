import {
  Vector3,
  Curve3,
  Mesh,
} from "@babylonjs/core";
import RemoveLaneRawCurveRoadTransaction from './removeLaneRawCurveRoad';
import { LineAndCurveCategory, RoadCategory, LaneSide, MarkerSide } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';
import {
  InvokeAddLaneCubicBezierCurveRoadEvent,
  InvokeRemoveLaneCubicBezierCurveRoadEvent,
} from '../event';


export default class RemoveLaneCubicBezierCurveRoadTransaction extends RemoveLaneRawCurveRoadTransaction {
  constructor(options: Object) {
    super(options);
  }

  commit() {
    const result = super.commit();

    this.scope.emitEvent(InvokeRemoveLaneCubicBezierCurveRoadEvent, {
      roadId: this.roadId,
    });

    return result;
  }

  onUndo() {
    super.onUndo();

    this.scope.emitEvent(InvokeAddLaneCubicBezierCurveRoadEvent, {
      roadId: this.roadId,
    });
  }

  onRedo() {
    super.onRedo();

    this.scope.emitEvent(InvokeRemoveLaneCubicBezierCurveRoadEvent, {
      roadId: this.roadId,
    });
  }
};