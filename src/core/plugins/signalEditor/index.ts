import {
  Vector3,
  Color3,
  Mesh,
  PointerInfo,
  PickingInfo,
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  EnterEditingSignalItemEvent,
  ExitEditingSignalItemEvent,
} from './constant';
import {
  ActionMeshCategory,
  ActionMeshMetadata,
} from './type';
import {
  LineAndCurveCategory,
  LineAndCurveItem,
  ReferenceLineItem,
  LaneLineItem,
  LaneItem,
  RoadItem,
  RoadCategory,
  LaneSide,
  LaneLineSide,
  SignalItem,
} from '../statusManager/type';
import { TransactionType } from '../../transactions';
import {
  InvokeRemoveSignalEvent,
  InvokeSignalAttributeEditEvent,
  InvokeReformatSignalEvent,
} from '../../transactions/event';

export default class SignalEditorPlugin extends LogicalPlugin {
  private editingSignalItem: SignalItem | null;
  private currentActionMesh: Mesh | null;
  private currentActionMeshInitPosition: Vector3 | null;
  private actionMeshes: { [id: string]: Mesh };
  private actionMeshIndex: number;

  constructor(options: PluginOptions) {
    super(options);

    this.editingSignalItem = null;
    this.currentActionMesh = null;
    this.currentActionMeshInitPosition = null;
    this.actionMeshes = {};
    this.actionMeshIndex = 0;
  }

  activate() {
    super.activate();

    this.init();
  }

  init() {
    this.initEvent();
    this.initTransactionInvokedEvent();
  }

  initEvent() {
    const scope = this as unknown as (ExtendedNamespace & SignalEditorPlugin);

    scope.registerEvent(EnterEditingSignalItemEvent);
    scope.onEvent(EnterEditingSignalItemEvent, (params: { payload: Object | string | number | null }) => {
      scope.undecorateEditingSignalItem();

      scope.editingSignalItem = (params.payload as { signalItem: SignalItem }).signalItem;
      
      scope.decorateEditingSignalItem();
    });

    scope.registerEvent(ExitEditingSignalItemEvent);
    scope.onEvent(ExitEditingSignalItemEvent, (params: { payload: Object | string | number | null }) => {
      scope.undecorateEditingSignalItem();
    });
  }

  initTransactionInvokedEvent() {
    const scope = this as unknown as (ExtendedNamespace & SignalEditorPlugin);

    // exit if editing signal is removed
    const clearSignalDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingSignalItem) return;

      const signalId = (params.payload as { signalId: string }).signalId;

      if (scope.editingSignalItem.signalId === signalId) {
        scope.exitEditSignal();
      }
    };

    scope.onEvent(InvokeRemoveSignalEvent, clearSignalDecorationCallback);


    // after editing, refresh decoration
    const refreshSignalDecorationCallback = (params: { payload: Object | string | number | null }) => {
      if (!scope.editingSignalItem) return;

      scope.emitEvent(EnterEditingSignalItemEvent, {
        signalItem: scope.resolveSignalBySignalId(scope.editingSignalItem.signalId) as SignalItem,
      });
    };

    
    scope.onEvent(InvokeSignalAttributeEditEvent, refreshSignalDecorationCallback);
    scope.onEvent(InvokeReformatSignalEvent, refreshSignalDecorationCallback);
  }  

  undecorateEditingSignalItem() {
    const scope = this as unknown as (ExtendedNamespace & SignalEditorPlugin);

    const ids = Object.keys(scope.actionMeshes);
    ids.forEach((id: string) => {
      scope.actionMeshes[id].dispose();
    });

    scope.editingSignalItem = null;
    scope.currentActionMesh = null;
    scope.currentActionMeshInitPosition = null;
    scope.actionMeshes = {};

    scope.makeSceneDirty();
  }

  decorateEditingSignalItem() {
    const scope = this as unknown as (ExtendedNamespace & SignalEditorPlugin);
    if (!scope.editingSignalItem) return;

    scope.makeSceneDirty();
  }
};