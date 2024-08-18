import {
  Curve3,
} from "@babylonjs/core";
import CreateRawCurveTransaction from './createRawCurve';
import { LineAndCurveCategory } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';

export default class CreateThreeCircleCurveTransaction extends CreateRawCurveTransaction {
  constructor(options: Object) {
    super(options);

    this.curve = Curve3.ArcThru3Points(
      this.points[0],
      this.points[1],
      this.points[2],
      RendererConfig.lineAndCurve.serieSteps,
    );

    this.curveCategory = LineAndCurveCategory.ThreeCircleCurve;
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