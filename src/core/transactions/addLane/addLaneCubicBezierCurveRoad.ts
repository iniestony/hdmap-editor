import {
  Vector3,
  Curve3,
  Mesh,
} from "@babylonjs/core";
import AddLaneRawCurveRoadTransaction from './addLaneRawCurveRoad';
import { LineAndCurveCategory, RoadCategory, LaneSide, MarkerSide } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';
import {
  InvokeAddLaneCubicBezierCurveRoadEvent,
  InvokeRemoveLaneCubicBezierCurveRoadEvent,
} from '../event';


export default class AddLaneCubicBezierCurveRoadTransaction extends AddLaneRawCurveRoadTransaction {
  constructor(options: Object) {
    super(options);
  }

  commit() {
    const result = super.commit();

    this.scope.emitEvent(InvokeAddLaneCubicBezierCurveRoadEvent, {
      roadId: this.roadId,
    });

    return result;
  }

  onUndo() {
    super.onUndo();

    this.scope.emitEvent(InvokeRemoveLaneCubicBezierCurveRoadEvent, {
      roadId: this.roadId,
    });
  }

  onRedo() {
    super.onRedo();

    this.scope.emitEvent(InvokeAddLaneCubicBezierCurveRoadEvent, {
      roadId: this.roadId,
    });
  }
};