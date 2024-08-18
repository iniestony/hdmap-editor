export interface ITransaction {
  commit(): unknown,
  onUndo(): unknown,
  onRedo(): unknown,
};

export interface ITransactionStack {
  canUndo(): boolean,
  canRedo(): boolean,
};

export interface ITransactionManager {
  canUndo(): boolean,
  canRedo(): boolean,
};