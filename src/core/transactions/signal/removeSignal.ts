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
  StoreSignalEvent,
  RemoveSignalEvent,
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
  InvokeCreateSignalEvent,
  InvokeRemoveSignalEvent,
} from '../event';

export default class RemoveSignalTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;

  private signalId: string;
  
  private signalItem?: SignalItem;
  private oldSignalItemKeyInfo?: SignalItemKeyInfo;

  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.signalId = (options as unknown as { signalId: string }).signalId;
  }

  commit() {
    super.commit();

    this.resolveNecessaryInfo();
    this.removeSignal();

    return { signalId: this.signalId };
  }

  onUndo() {
    super.onUndo();
    this.createSignal();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.removeSignal();
  }

  resolveNecessaryInfo() {
    this.signalItem = this.scope.resolveSignalBySignalId(this.signalId) as SignalItem;
    this.oldSignalItemKeyInfo = this.scope.resolveSignalItemKeyInfo(this.signalItem) as SignalItemKeyInfo;
  }

  removeSignal() {
    const signalItem = this.signalItem as SignalItem;
     
    this.scope.emitEvent(RemoveSignalEvent, {
      id: signalItem.signalId,
    });

    this.scope.emitEvent(StoreDirtySignalEvent, {
      signalId: signalItem.signalId,
      signalPID: signalItem.signalPID,
    });

    this.scope.emitEvent(InvokeRemoveSignalEvent, {
      signalId: this.signalId,
    });
  }

  createSignal() {
    const signalItemKeyInfo = this.oldSignalItemKeyInfo as SignalItemKeyInfo;

    const { signalPlane, vertices } = this.scope.createSignalPlane({
      id: `${signalItemKeyInfo.signalId}__SignalMesh`,
      width: signalItemKeyInfo.width,
      height: signalItemKeyInfo.height,
      position: signalItemKeyInfo.position,
      rotationHorizontal: signalItemKeyInfo.rotationHorizontal,
      rotationVertical: signalItemKeyInfo.rotationVertical,
    });

    const signalItem = {
      signalId: signalItemKeyInfo.signalId,
      signalPID: signalItemKeyInfo.signalPID,
      signalType: signalItemKeyInfo.signalType,
      width: signalItemKeyInfo.width,
      height: signalItemKeyInfo.height,
      position: signalItemKeyInfo.position,
      rotationHorizontal: signalItemKeyInfo.rotationHorizontal,
      rotationVertical: signalItemKeyInfo.rotationVertical,
      signalMesh: signalPlane,
      vertices,
      generalSubSignalIndex: signalItemKeyInfo.generalSubSignalIndex,
      subSignalItems: [],
    } as SignalItem;

    signalItem.signalMesh.metadata = {
      belongingSignalItem: signalItem,
    };

    signalItem.subSignalItems = signalItemKeyInfo.subSignalItems.map((subSignalItemKeyInfo: SubSignalItemKeyInfo) => {
      const subSignalMesh = this.scope.createSubSignalMesh(subSignalItemKeyInfo.position, this.scope.resolveSubSignalColorValue(subSignalItemKeyInfo.subSignalColorType), `${subSignalItemKeyInfo.subSignalId}__SubSignalMesh`);

      return {
        subSignalId: subSignalItemKeyInfo.subSignalId,
        subSignalType: subSignalItemKeyInfo.subSignalType,
        subSignalColorType: subSignalItemKeyInfo.subSignalColorType,
        position: subSignalItemKeyInfo.position,
        subSignalMesh,
      }
    });

    this.scope.emitEvent(StoreSignalEvent, signalItem);

    this.scope.emitEvent(StoreDirtySignalEvent, {
      signalId: signalItem.signalId,
      signalPID: signalItem.signalPID,
    });

    this.scope.emitEvent(InvokeCreateSignalEvent, {
      signalId: this.signalId,
    });

    this.scope.makeSceneDirty();

    return signalItem;
  }
};