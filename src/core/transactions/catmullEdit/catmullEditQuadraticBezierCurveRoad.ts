import {
  Vector3,
  Curve3,
  Mesh,
} from "@babylonjs/core";
import CatmullEditRawCurveRoadTransaction from './catmullEditRawCurveRoad';
import { LineAndCurveCategory, RoadCategory, LaneSide, MarkerSide } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';
import {
  InvokeCatmullEditQuadraticBezierCurveRoadEvent,
} from '../event';


export default class CatmullEditQuadraticBezierCurveRoadTransaction extends CatmullEditRawCurveRoadTransaction {
  constructor(options: Object) {
    super(options);
  }

  commit() {
    const result = super.commit();

    this.scope.emitEvent(InvokeCatmullEditQuadraticBezierCurveRoadEvent, {
      laneId: this.laneId,
    });

    return result;
  }

  onUndo() {
    super.onUndo();

    this.scope.emitEvent(InvokeCatmullEditQuadraticBezierCurveRoadEvent, {
      laneId: this.laneId,
    });
  }

  onRedo() {
    super.onRedo();

    this.scope.emitEvent(InvokeCatmullEditQuadraticBezierCurveRoadEvent, {
      laneId: this.laneId,
    });
  }
};