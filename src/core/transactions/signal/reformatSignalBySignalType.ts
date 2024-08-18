import {
  Vector3,
  Color3,
  MeshBuilder,
  LinesMesh,
  Mesh,
  Curve3,
  Path3D,
} from "@babylonjs/core";
import StandardTransaction from '../general/standard';
import {
  LineAndCurveCategory,
  LineAndCurveItem,
  LaneItem,
  RoadItem,
  RoadCategory,
  LaneSide,
  LaneLineSide,
  MarkerSide,
  LaneLineItem,
  ReferenceLineItem,
  LaneItemKeyInfo,
  RoadItemKeyInfo,
  JunctionItem,
  JunctionItemKeyInfo,
  JunctionEdgeItem,
  JunctionEdgeItemKeyInfo,
  SignalItem,
  SignalItemKeyInfo,
  SubSignalItem,
  SubSignalItemKeyInfo,
} from '../../plugins/statusManager/type';
import {
  ReformatSignalEvent,
  StoreDirtySignalEvent,
} from '../../plugins/statusManager/constant';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  AtlasRoad,
  AtlasLane,
  AtlasJunction,
  AtlasSignInfo,
  AtlasSignal,
  AtlasSubsignal,
} from '../../plugins/atlasConverter/type';
import {
  SubSignalColorType,
} from "../../plugins/signalDrawer/type";
import {
  InvokeReformatSignalEvent,
} from '../event';

export default class ReformatSignalBySignalTypeTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;

  private signalId: string;
  private signalType: AtlasSignal.Type;
  
  private signalItem?: SignalItem;
  private oldSignalType?: AtlasSignal.Type;

  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.signalId = (options as unknown as { signalId: string }).signalId;
    this.signalType = (options as unknown as { signalType: AtlasSignal.Type }).signalType;
  }

  commit() {
    super.commit();

    this.resolveNecessaryInfo();
    this.reformatNewSignal();

    return {
      signalId: this.signalId,
    };
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
    this.oldSignalType = this.signalItem.signalType;
  }

  reformatNewSignal() {
    const signalItem = this.signalItem as SignalItem;
    signalItem.signalType = this.signalType;

    const signalItemGeometryInfo = {
      width: signalItem.width,
      height: signalItem.height,
      position: signalItem.position,
      rotationHorizontal: signalItem.rotationHorizontal,
      rotationVertical: signalItem.rotationVertical,
    };

    this.scope.inlineReformatSignal(signalItemGeometryInfo, signalItem);

    this.scope.emitEvent(StoreDirtySignalEvent, {
      signalId: signalItem.signalId,
      signalPID: signalItem.signalPID,
    });

    this.scope.emitEvent(InvokeReformatSignalEvent, {
      signalId: this.signalId,
    });

    this.scope.makeSceneDirty();
  }

  reformatOldSignal() {
    const signalItem = this.signalItem as SignalItem;
    signalItem.signalType = this.oldSignalType!;
    
    const signalItemGeometryInfo = {
      width: signalItem.width,
      height: signalItem.height,
      position: signalItem.position,
      rotationHorizontal: signalItem.rotationHorizontal,
      rotationVertical: signalItem.rotationVertical,
    };

    this.scope.inlineReformatSignal(signalItemGeometryInfo, signalItem);

    this.scope.emitEvent(StoreDirtySignalEvent, {
      signalId: signalItem.signalId,
      signalPID: signalItem.signalPID,
    });

    this.scope.emitEvent(InvokeReformatSignalEvent, {
      signalId: this.signalId,
    });

    this.scope.makeSceneDirty();
  }
};