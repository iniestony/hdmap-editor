import {
  Curve3,
} from "@babylonjs/core";
import CreateRawCurveTransaction from './createRawCurve';
import { LineAndCurveCategory } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';

export default class CreateCubicBezierCurveTransaction extends CreateRawCurveTransaction {
  constructor(options: Object) {
    super(options);

    this.curve = Curve3.CreateCubicBezier(
      this.points[0], // origin
      this.points[2], // control1
      this.points[3], // control2
      this.points[1], // destination
      RendererConfig.lineAndCurve.serieSteps,
    );

    this.curveCategory = LineAndCurveCategory.CubicBezierCurve;
  }

  commit() {
    return super.commit();
  }

  onUndo() {
    super.onUndo();
  }

  onRedo() {
    super.onRedo();
  }
};