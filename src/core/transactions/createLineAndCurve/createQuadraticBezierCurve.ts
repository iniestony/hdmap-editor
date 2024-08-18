import {
  Curve3,
} from "@babylonjs/core";
import CreateRawCurveTransaction from './createRawCurve';
import { LineAndCurveCategory } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';

export default class CreateQuadraticBezierCurveTransaction extends CreateRawCurveTransaction {
  constructor(options: Object) {
    super(options);

    this.curve = Curve3.CreateQuadraticBezier(
      this.points[0], // origin
      this.points[2], // control
      this.points[1], // destination
      RendererConfig.lineAndCurve.serieSteps,
    );

    this.curveCategory = LineAndCurveCategory.QuadraticBezierCurve;
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