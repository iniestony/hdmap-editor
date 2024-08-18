import StandardTransaction from '../general/standard';
import {
  JunctionItem,
} from '../../plugins/statusManager/type';
import {
  StoreDirtyJunctionEvent,
} from '../../plugins/statusManager/constant';
import {
  JunctionItemAttributeEdit,
} from '../../plugins/junctionEditor/type'
import { ExtendedNamespace } from '../../types/plugins/raw';
import {
  InvokeJunctionAttributeEditEvent,
} from '../event';

export default class JunctionAttributeEditTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;

  private junctionId: string;
  private junctionItem?: JunctionItem;

  private junctionItemAttributeEdit: JunctionItemAttributeEdit;
  private oldjunctionItemAttributeEdit: JunctionItemAttributeEdit;
  

  constructor(options: Object) {
    super(options);
    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.junctionId = (options as unknown as { junctionId: string }).junctionId;
    this.junctionItemAttributeEdit = (options as unknown as { junctionItemAttributeEdit: JunctionItemAttributeEdit }).junctionItemAttributeEdit;
    this.oldjunctionItemAttributeEdit = {};
  }

  commit() {
    super.commit();
    this.resolveNecessaryInfo();
    this.reformatNewJunction();
    return { junctionId: this.junctionId };
  }

  onUndo() {
    super.onUndo();
    this.reformatOldJunction();
  }

  onRedo() {
    super.onRedo();
    this.resolveNecessaryInfo();
    this.reformatNewJunction();
  }

  resolveNecessaryInfo() {
    this.junctionItem = this.scope.resolveJunctionByJunctionId(this.junctionId) as JunctionItem;

    for (let n in this.junctionItemAttributeEdit) {
      const junctionItemAttributeEdit = this.junctionItemAttributeEdit;
      const key = n as keyof typeof junctionItemAttributeEdit;
      this.oldjunctionItemAttributeEdit[key] = this.junctionItem[key];
    };

  };
  reformatNewJunction() {
    const junctionItem = this.junctionItem as JunctionItem;

    for (let n in this.junctionItemAttributeEdit) {
      const junctionItemAttributeEdit = this.junctionItemAttributeEdit;
      const key = n as keyof typeof junctionItemAttributeEdit;
      if (junctionItemAttributeEdit[key] !== undefined) {
        junctionItem[key] = junctionItemAttributeEdit[key];
      };
    };

    this.scope.emitEvent(StoreDirtyJunctionEvent, {
      junctionId: junctionItem.junctionId,
      junctionPID: junctionItem.junctionPID,
    });

    this.scope.emitEvent(InvokeJunctionAttributeEditEvent, {
      junctionId: this.junctionId,
    });
  };
  reformatOldJunction() {
    const junctionItem = this.junctionItem as JunctionItem;

    for (let n in this.oldjunctionItemAttributeEdit) {
      const oldjunctionItemAttributeEdit = this.oldjunctionItemAttributeEdit;
      const key = n as keyof typeof oldjunctionItemAttributeEdit;
      if (oldjunctionItemAttributeEdit[key] !== undefined) {
        junctionItem[key] = oldjunctionItemAttributeEdit[key];
      };
    };

    this.scope.emitEvent(StoreDirtyJunctionEvent, {
      junctionId: junctionItem.junctionId,
      junctionPID: junctionItem.junctionPID,
    });

    this.scope.emitEvent(InvokeJunctionAttributeEditEvent, {
      junctionId: this.junctionId,
    });
  };
}