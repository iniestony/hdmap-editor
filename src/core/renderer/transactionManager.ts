import { ITransactionManager, ITransactionStack } from '../types/renderer/transactionManager';
import { TransactionType, TransactionMap } from '../transactions';
import RawTransaction from '../transactions/general/raw';
import { EventManager } from './eventManager';
import {
  InvokeCreateTwoStraightLineRoadEvent,
  InvokeCreateThreeCircleCurveRoadEvent,
  InvokeCreateQuadraticBezierCurveRoadEvent,
  InvokeCreateCubicBezierCurveRoadEvent,
  InvokeCreateCatmullSerieRoadEvent,
  InvokeCreateConnectionRoadEvent,
  InvokeRemoveTwoStraightLineRoadEvent,
  InvokeRemoveThreeCircleCurveRoadEvent,
  InvokeRemoveQuadraticBezierCurveRoadEvent,
  InvokeRemoveCubicBezierCurveRoadEvent,
  InvokeRemoveCatmullSerieRoadEvent,
  InvokeRemoveConnectionRoadEvent,
  InvokeReformatTwoStraightLineRoadEvent,
  InvokeReformatThreeCircleCurveRoadEvent,
  InvokeReformatQuadraticBezierCurveRoadEvent,
  InvokeReformatCubicBezierCurveRoadEvent,
  InvokeReformatCatmullSerieRoadEvent,
  InvokeReformatConnectionRoadEvent,
  InvokeLaneWidthEditTwoStraightLineRoadEvent,
  InvokeLaneWidthEditThreeCircleCurveRoadEvent,
  InvokeLaneWidthEditQuadraticBezierCurveRoadEvent,
  InvokeLaneWidthEditCubicBezierCurveRoadEvent,
  InvokeLaneWidthEditCatmullSerieRoadEvent,
  InvokeAddLaneTwoStraightLineRoadEvent,
  InvokeAddLaneThreeCircleCurveRoadEvent,
  InvokeAddLaneQuadraticBezierCurveRoadEvent,
  InvokeAddLaneCubicBezierCurveRoadEvent,
  InvokeAddLaneCatmullSerieRoadEvent,
  InvokeAddLaneConnectionRoadEvent,
  InvokeRemoveLaneTwoStraightLineRoadEvent,
  InvokeRemoveLaneThreeCircleCurveRoadEvent,
  InvokeRemoveLaneQuadraticBezierCurveRoadEvent,
  InvokeRemoveLaneCubicBezierCurveRoadEvent,
  InvokeRemoveLaneCatmullSerieRoadEvent,
  InvokeRemoveLaneConnectionRoadEvent,
  InvokeCatmullEditTwoStraightLineRoadEvent,
  InvokeCatmullEditThreeCircleCurveRoadEvent,
  InvokeCatmullEditQuadraticBezierCurveRoadEvent,
  InvokeCatmullEditCubicBezierCurveRoadEvent,
  InvokeCatmullEditCatmullSerieRoadEvent,
  InvokeCatmullEditConnectionRoadEvent,
  InvokeCatmullAlterLaneCatmullSerieRoadEvent,
  InvokeCatmullAlterLaneConnectionRoadEvent,
  InvokeLanePrevNextEditConnectionRoadEvent,
  InvokeCatmullExtendCatmullSerieRoadEvent,
  InvokeCreateJunctionEvent,
  InvokeRemoveJunctionEvent,
  InvokeCatmullEditEdgeJunctionEvent,
  InvokeRoadTransparencyEditEvent,
  InvokeRoadConnectionTransparencyEditEvent,
  InvokeRoadAttributeEditEvent,
  InvokeRoadLaneAttributeEditEvent,
  InvokeRoadLaneLineInnerAttributeEditEvent,
  InvokeRoadLaneLineOuterAttributeEditEvent,
  InvokeRoadConnectionAttributeEditEvent,
  InvokeRoadConnectionLaneAttributeEditEvent,
  InvokeRoadConnectionLaneInnerAttributeEditEvent,
  InvokeRoadConnectionLaneOuterAttributeEditEvent,
  InvokeJunctionAttributeEditEvent,
  InvokeCreateSignalEvent,
  InvokeRemoveSignalEvent,
  InvokeSignalAttributeEditEvent,
  InvokeReformatSignalEvent,
  InvokeRoadLaneLineSeriePointsOnlyPostInvalidEvent,
  InvokeRoadLaneLineSeriePointsPreAndPostInvalidEvent,
} from '../transactions/event';

export class TransactionManager implements ITransactionManager {
  private eventManager: EventManager;

  private currentTransactionStack: TransactionStack;
  private defaultTransactionStack: TransactionStack;

  constructor(options: { eventManager: EventManager }) {
    this.eventManager = options.eventManager;
    this.registerTransactionEvents();

    this.defaultTransactionStack = new TransactionStack();

    // by default, use default stack
    this.currentTransactionStack = this.defaultTransactionStack;
  }

  canUndo() {
    return this.currentTransactionStack.canUndo();
  }

  canRedo() {
    return this.currentTransactionStack.canRedo();
  }

  clean() {
    this.currentTransactionStack.cleanUndo();
    this.currentTransactionStack.cleanRedo();
  }

  createTransaction(type: TransactionType, payload: Object) {
    const Ctor = TransactionMap[type];
    return new Ctor(payload);
  }

  commitTransaction(transaction: RawTransaction) {
    const result = transaction.commit();
    this.currentTransactionStack.cleanRedo();
    this.currentTransactionStack.pushUndo(transaction);
    return result;
  }

  undo() {
    if (!this.canUndo()) return;

    const transaction = this.currentTransactionStack.popUndo();
    if (transaction) {
      transaction.onUndo();
      this.currentTransactionStack.pushRedo(transaction);
    }
  }

  redo() {
    if (!this.canRedo()) return;

    const transaction = this.currentTransactionStack.popRedo();
    if (transaction) {
      transaction.onRedo();
      this.currentTransactionStack.pushUndo(transaction);
    }
  }

  enterTransactionSubEnv() {
    this.currentTransactionStack = new TransactionStack();
  }

  exitTransactionSubEnvInCopy() {
    // drop all default redo
    this.defaultTransactionStack.cleanRedo();

    this.currentTransactionStack.enumerateUndo((t: RawTransaction) => {
      this.defaultTransactionStack.pushUndo(t);
    });

    this.currentTransactionStack.enumerateRedo((t: RawTransaction) => {
      this.defaultTransactionStack.pushRedo(t);
    });

    // into default
    this.currentTransactionStack = this.defaultTransactionStack;
  }

  registerTransactionEvents() {
    // road
    this.eventManager.registerEvent(InvokeCreateTwoStraightLineRoadEvent);
    this.eventManager.registerEvent(InvokeCreateThreeCircleCurveRoadEvent);
    this.eventManager.registerEvent(InvokeCreateQuadraticBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeCreateCubicBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeCreateCatmullSerieRoadEvent);
    this.eventManager.registerEvent(InvokeCreateConnectionRoadEvent);

    this.eventManager.registerEvent(InvokeRemoveTwoStraightLineRoadEvent);
    this.eventManager.registerEvent(InvokeRemoveThreeCircleCurveRoadEvent);
    this.eventManager.registerEvent(InvokeRemoveQuadraticBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeRemoveCubicBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeRemoveCatmullSerieRoadEvent);
    this.eventManager.registerEvent(InvokeRemoveConnectionRoadEvent);

    this.eventManager.registerEvent(InvokeReformatTwoStraightLineRoadEvent);
    this.eventManager.registerEvent(InvokeReformatThreeCircleCurveRoadEvent);
    this.eventManager.registerEvent(InvokeReformatQuadraticBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeReformatCubicBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeReformatCatmullSerieRoadEvent);
    this.eventManager.registerEvent(InvokeReformatConnectionRoadEvent);

    this.eventManager.registerEvent(InvokeLaneWidthEditTwoStraightLineRoadEvent);
    this.eventManager.registerEvent(InvokeLaneWidthEditThreeCircleCurveRoadEvent);
    this.eventManager.registerEvent(InvokeLaneWidthEditQuadraticBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeLaneWidthEditCubicBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeLaneWidthEditCatmullSerieRoadEvent);

    this.eventManager.registerEvent(InvokeAddLaneTwoStraightLineRoadEvent);
    this.eventManager.registerEvent(InvokeAddLaneThreeCircleCurveRoadEvent);
    this.eventManager.registerEvent(InvokeAddLaneQuadraticBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeAddLaneCubicBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeAddLaneCatmullSerieRoadEvent);
    this.eventManager.registerEvent(InvokeAddLaneConnectionRoadEvent);

    this.eventManager.registerEvent(InvokeRemoveLaneTwoStraightLineRoadEvent);
    this.eventManager.registerEvent(InvokeRemoveLaneThreeCircleCurveRoadEvent);
    this.eventManager.registerEvent(InvokeRemoveLaneQuadraticBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeRemoveLaneCubicBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeRemoveLaneCatmullSerieRoadEvent);
    this.eventManager.registerEvent(InvokeRemoveLaneConnectionRoadEvent);

    this.eventManager.registerEvent(InvokeCatmullEditTwoStraightLineRoadEvent);
    this.eventManager.registerEvent(InvokeCatmullEditThreeCircleCurveRoadEvent);
    this.eventManager.registerEvent(InvokeCatmullEditQuadraticBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeCatmullEditCubicBezierCurveRoadEvent);
    this.eventManager.registerEvent(InvokeCatmullEditCatmullSerieRoadEvent);
    this.eventManager.registerEvent(InvokeCatmullEditConnectionRoadEvent);

    this.eventManager.registerEvent(InvokeCatmullAlterLaneCatmullSerieRoadEvent);
    this.eventManager.registerEvent(InvokeCatmullAlterLaneConnectionRoadEvent);

    this.eventManager.registerEvent(InvokeLanePrevNextEditConnectionRoadEvent);

    this.eventManager.registerEvent(InvokeCatmullExtendCatmullSerieRoadEvent);

    // junction
    this.eventManager.registerEvent(InvokeCreateJunctionEvent);
    this.eventManager.registerEvent(InvokeRemoveJunctionEvent);
    this.eventManager.registerEvent(InvokeCatmullEditEdgeJunctionEvent);

    // road property
    this.eventManager.registerEvent(InvokeRoadTransparencyEditEvent);
    this.eventManager.registerEvent(InvokeRoadConnectionTransparencyEditEvent);
    this.eventManager.registerEvent(InvokeRoadAttributeEditEvent);
    this.eventManager.registerEvent(InvokeRoadLaneAttributeEditEvent);
    this.eventManager.registerEvent(InvokeRoadLaneLineInnerAttributeEditEvent);
    this.eventManager.registerEvent(InvokeRoadLaneLineOuterAttributeEditEvent);
    this.eventManager.registerEvent(InvokeRoadConnectionAttributeEditEvent);
    this.eventManager.registerEvent(InvokeRoadConnectionLaneAttributeEditEvent);
    this.eventManager.registerEvent(InvokeRoadConnectionLaneInnerAttributeEditEvent);
    this.eventManager.registerEvent(InvokeRoadConnectionLaneOuterAttributeEditEvent);

    // junction property
    this.eventManager.registerEvent(InvokeJunctionAttributeEditEvent);

    // signal
    this.eventManager.registerEvent(InvokeCreateSignalEvent);
    this.eventManager.registerEvent(InvokeRemoveSignalEvent);
    this.eventManager.registerEvent(InvokeSignalAttributeEditEvent);
    this.eventManager.registerEvent(InvokeReformatSignalEvent);

    // validation
    this.eventManager.registerEvent(InvokeRoadLaneLineSeriePointsOnlyPostInvalidEvent);
    this.eventManager.registerEvent(InvokeRoadLaneLineSeriePointsPreAndPostInvalidEvent);
  }
};

class TransactionStack implements ITransactionStack {
  private undoCollection: Array<RawTransaction>;
  private redoCollection: Array<RawTransaction>;

  constructor() {
    this.undoCollection = [];
    this.redoCollection = [];
  }

  canUndo() {
    return this.undoCollection.length > 0;
  }

  canRedo() {
    return this.redoCollection.length > 0;
  }

  pushUndo(transaction: RawTransaction) {
    this.undoCollection.push(transaction);
  }

  popUndo() {
    return this.undoCollection.pop();
  }

  cleanUndo() {
    this.undoCollection = [];
  }

  enumerateUndo(callback: Function) {
    for (let i = 0; i < this.undoCollection.length; i++) {
      const t = this.undoCollection[i] as RawTransaction;
      callback(t);
    }
  }

  pushRedo(transaction: RawTransaction) {
    this.redoCollection.unshift(transaction);
  }

  popRedo() {
    return this.redoCollection.shift();
  }

  cleanRedo() {
    this.redoCollection = [];
  }

  enumerateRedo(callback: Function) {
    for (let i = this.redoCollection.length - 1; i >= 0; i--) {
      const t = this.redoCollection[i] as RawTransaction;
      callback(t);
    };
  }
};