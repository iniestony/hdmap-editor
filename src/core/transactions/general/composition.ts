import RawTransaction from './raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import {
  LineAndCurveCategory,
  LineAndCurveItem,
  LaneItem,
  RoadItem,
  RoadCategory,
  LaneSide,
  LaneLineSide,
  MarkerSide,
  LineAndCurveItemKeyInfo,
  LaneLineItemKeyInfo,
  LaneItemKeyInfo,
  RoadItemKeyInfo,
} from '../../plugins/statusManager/type';

export default class CompositionTransaction extends RawTransaction {
  private compositionScope: ExtendedNamespace;
  protected subTransactions: Array<RawTransaction>;

  constructor(options: Object) {
    super(options);

    this.compositionScope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.isCompositionTransaction = true;

    this.subTransactions = [];
  }

  commit() {
    super.commit();

    [...this.subTransactions].forEach((t: RawTransaction) => {
      t.commit();
    });
  }

  onUndo() {
    super.onUndo();

    [...this.subTransactions].reverse().forEach((t: RawTransaction) => {
      t.onUndo();
    });
  }

  onRedo() {
    super.onRedo();

    [...this.subTransactions].forEach((t: RawTransaction) => {
      t.onRedo();
    });
  }
};

