import {
  Vector3,
  Color3,
  Mesh,
  MeshBuilder,
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import { TransactionType } from '../../transactions';
import {
  SignalDrawerConfig,
} from './type';
import {
  ReceiveSignalPositionEvent,
} from './constant';

export default class SignalDrawerPlugin extends LogicalPlugin {
  private drawerConfig: SignalDrawerConfig;

  constructor(options: PluginOptions) {
    super(options);

    this.drawerConfig = {
      signalHeight: RendererConfig.trafficLights.defaultSignalHeight,
      signalWidth: RendererConfig.trafficLights.defaultSignalWidth,
    };
  }

  activate() {
    super.activate();
    
    this.init();
  }

  init() {
    this.initEvent();
  }

  initEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(ReceiveSignalPositionEvent);
    scope.onEvent(ReceiveSignalPositionEvent, (params: { payload: Object | string | number | null }) => {
      const position = (params.payload as { position: Vector3 }).position;

      this.drawSignal(position);
    });
  }

  drawSignal(position: Vector3) {
    const scope = this as unknown as ExtendedNamespace;

    const opts = {
      scope,
      signalId: scope.resolveNextCandidateEntityId(),
      width: this.drawerConfig.signalWidth,
      height: this.drawerConfig.signalHeight,
      position,
      rotationHorizontal: 0,
      rotationVertical: 0,
    };

    const transaction = scope.createTransaction(TransactionType.CreateSignal, opts);
    const signalItem = scope.commitTransaction(transaction).entity;

    scope.enterEditSignal(signalItem);

    scope.makeSceneDirty();
  }
};