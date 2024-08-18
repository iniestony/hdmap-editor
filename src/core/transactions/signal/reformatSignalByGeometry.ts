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

export default class ReformatSignalByGeometryTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;

  private signalId: string;
  private width: number;
  private height: number;
  private position: Vector3;
  private rotationHorizontal: number;
  private rotationVertical: number;
  
  private signalItem?: SignalItem;
  private oldSignalItemGeometryInfo?: {
    width: number;
    height: number;
    position: Vector3;
    rotationHorizontal: number;
    rotationVertical: number;
  };
  private newSignalItemGeometryInfo?: {
    width: number;
    height: number;
    position: Vector3;
    rotationHorizontal: number;
    rotationVertical: number;
  };

  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.signalId = (options as unknown as { signalId: string }).signalId;
    this.width = (options as unknown as { width: number }).width;
    this.height = (options as unknown as { height: number }).height;
    this.position = (options as unknown as { position: Vector3 }).position;
    this.rotationHorizontal = (options as unknown as { rotationHorizontal: number }).rotationHorizontal;
    this.rotationVertical = (options as unknown as { rotationVertical: number }).rotationVertical;
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

    this.oldSignalItemGeometryInfo = {
      width: this.signalItem.width,
      height: this.signalItem.height,
      position: this.signalItem.position,
      rotationHorizontal: this.signalItem.rotationHorizontal,
      rotationVertical: this.signalItem.rotationVertical,
    };
    
    this.newSignalItemGeometryInfo = {
      width: this.width,
      height: this.height,
      position: this.position,
      rotationHorizontal: this.rotationHorizontal,
      rotationVertical: this.rotationVertical,
    };
  }

  reformatNewSignal() {
    const signalItem = this.signalItem as SignalItem;
    const signalItemGeometryInfo = this.newSignalItemGeometryInfo;

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
    const signalItemGeometryInfo = this.oldSignalItemGeometryInfo;

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