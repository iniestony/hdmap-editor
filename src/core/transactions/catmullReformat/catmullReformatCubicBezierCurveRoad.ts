import {
  Vector3,
  Curve3,
  Mesh,
} from "@babylonjs/core";
import CatmullReformatRawCurveRoadTransaction from './catmullReformatRawCurveRoad';
import { LineAndCurveCategory, RoadCategory, LaneSide, MarkerSide } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';
import {
  InvokeReformatCubicBezierCurveRoadEvent,
} from '../event';

export default class CatmullReformatCubicBezierCurveRoadTransaction extends CatmullReformatRawCurveRoadTransaction {
  constructor(options: Object) {
    super(options);
  }

  commit() {
    const result = super.commit();

    const reflineKeyPoints = [...(this.reflinePoints as Vector3[])];
    this.scope.emitEvent(InvokeReformatCubicBezierCurveRoadEvent, {
      reflinePoints: reflineKeyPoints,
    });

    return result;
  }

  onUndo() {
    super.onUndo();

    const reflineKeyPoints = [...(this.reflinePoints as Vector3[])];
    this.scope.emitEvent(InvokeReformatCubicBezierCurveRoadEvent, {
      reflinePoints: reflineKeyPoints,
    });
  }

  onRedo() {
    super.onRedo();

    const reflineKeyPoints = [...(this.reflinePoints as Vector3[])];
    this.scope.emitEvent(InvokeReformatCubicBezierCurveRoadEvent, {
      reflinePoints: reflineKeyPoints,
    });
  }
};