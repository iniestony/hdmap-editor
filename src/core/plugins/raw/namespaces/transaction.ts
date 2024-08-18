import { ExtendedNamespace } from '../../../types/plugins/raw';
import { TransactionType } from '../../../transactions';
import RawTransaction from '../../../transactions/general/raw';

export function createTransaction(this: ExtendedNamespace, type: TransactionType, payload: Object) {
  const transactionManager = this.getTransactionManager();

  return transactionManager.createTransaction(type, payload);
};

export function commitTransaction(this: ExtendedNamespace, transaction: RawTransaction) {
  const transactionManager = this.getTransactionManager();

  return transactionManager.commitTransaction(transaction);
};

export function performTransactionUndo(this: ExtendedNamespace) {
  const transactionManager = this.getTransactionManager();

  transactionManager.undo();
};

export function performTransactionRedo(this: ExtendedNamespace) {
  const transactionManager = this.getTransactionManager();

  transactionManager.redo();
};

export function performTransactionReset(this: ExtendedNamespace) {
  const transactionManager = this.getTransactionManager();

  transactionManager.clean();
};

export function performEnterTransactionSubEnv(this: ExtendedNamespace) {
  const transactionManager = this.getTransactionManager();

  transactionManager.enterTransactionSubEnv();
};

export function performExitTransactionSubEnvInCopy(this: ExtendedNamespace) {
  const transactionManager = this.getTransactionManager();

  transactionManager.exitTransactionSubEnvInCopy();
};