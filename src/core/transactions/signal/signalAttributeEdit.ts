import { ExtendedNamespace } from '../../types/plugins/raw';
import {
  AtlasSignal,
} from '../../plugins/atlasConverter/type';
import {
  SignalItemAttributeEdit,
} from '../../plugins/signalEditor/type'
import {
  RoadItem,
  LaneItemKeyInfo,
  LaneItem,
  RoadCategory,
  SignalItem,
} from '../../plugins/statusManager/type';
import {
  StoreDirtySignalEvent,
} from '../../plugins/statusManager/constant';
import {
  InvokeSignalAttributeEditEvent,
} from '../event';
import StandardTransaction from '../general/standard';

export default class SignalAttributeEditTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private signalId: string;

  private signalItemAttributeEdit: SignalItemAttributeEdit;
  private oldSignalItemAttributeEdit: SignalItemAttributeEdit;

  private signalItem?: SignalItem;

  constructor(options: Object) {
    super(options);
    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.signalId = (options as unknown as { signalId: string }).signalId;
    this.signalItemAttributeEdit = (options as unknown as { signalItemAttributeEdit: SignalItemAttributeEdit }).signalItemAttributeEdit;
    this.oldSignalItemAttributeEdit = {};
  }

  commit() {
    super.commit();

    this.resolveNecessaryInfo();
    this.reformatNewSignal();

    return { signalId: this.signalId };
  }

  onUndo() {
    super.onUndo();

    this.reformatOldSignal();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.reformatNewSignal();
  }

  resolveNecessaryInfo() {
    this.signalItem = this.scope.resolveSignalBySignalId(this.signalId) as SignalItem;

    for (let n in this.signalItemAttributeEdit) {
      const signalItemAttributeEdit = this.signalItemAttributeEdit;
      const key = n as keyof typeof signalItemAttributeEdit;

      this.oldSignalItemAttributeEdit[key] = this.signalItem[key];
    };
  }

  reformatNewSignal() {
    const signalItem = this.signalItem as SignalItem;

    for (let n in this.signalItemAttributeEdit) {
      const signalItemAttributeEdit = this.signalItemAttributeEdit;
      const key = n as keyof typeof signalItemAttributeEdit;

      if (signalItemAttributeEdit[key] !== undefined) {
        signalItem[key] = signalItemAttributeEdit[key];
      };
    };
    
    this.scope.emitEvent(StoreDirtySignalEvent, {
      signalPID: signalItem.signalPID,
      signalId: signalItem.signalId,
    });

    this.scope.emitEvent(InvokeSignalAttributeEditEvent, {
      signalId: this.signalId,
    });
  }

  reformatOldSignal() {
    const signalItem = this.signalItem as SignalItem;

    for (let n in this.oldSignalItemAttributeEdit) {
      const oldSignalItemAttributeEdit = this.oldSignalItemAttributeEdit;
      const key = n as keyof typeof oldSignalItemAttributeEdit;

      if (oldSignalItemAttributeEdit[key] !== undefined) {
        signalItem[key] = oldSignalItemAttributeEdit[key];
      };
    };

    this.scope.emitEvent(StoreDirtySignalEvent, {
      signalPID: signalItem.signalPID,
      signalId: signalItem.signalId,
    });

    this.scope.emitEvent(InvokeSignalAttributeEditEvent, {
      signalId: this.signalId,
    });
  }
}