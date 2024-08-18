import { ITransaction } from '../../types/renderer/transactionManager';

export default class RawTransaction implements ITransaction {
  protected isCompositionTransaction: boolean;

  constructor(options: Object) {
    this.isCompositionTransaction = false;
  }

  commit() {}

  onUndo() {}

  onRedo() {}
};