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

export default class CreateSignalTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;

  private signalId: string;
  private width: number;
  private height: number;
  private position: Vector3;
  private rotationHorizontal: number;
  private rotationVertical: number;
  
  private createdSignalItem?: SignalItem;

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
    const entity = this.createSignal();

    return { entity };
  }

  onUndo() {
    super.onUndo();
    this.removeSignal();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.createSignal();
  }

  resolveNecessaryInfo() {
    
  }

  createSignal() {
    const { signalPlane, vertices } = this.scope.createSignalPlane({
      id: `${this.signalId}__SignalMesh`,
      width: this.width,
      height: this.height,
      position: this.position,
      rotationHorizontal: this.rotationHorizontal,
      rotationVertical: this.rotationVertical,
    });

    const signalItem = {
      signalId: this.signalId,
      signalPID: this.scope.generatePersistenceID() as string,
      signalType: AtlasSignal.Type.MIX_3_VERTICAL,
      width: this.width,
      height: this.height,
      position: this.position,
      rotationHorizontal: this.rotationHorizontal,
      rotationVertical: this.rotationVertical,
      signalMesh: signalPlane,
      vertices,
      generalSubSignalIndex: 0,
      subSignalItems: [],
    } as SignalItem;

    signalItem.signalMesh.metadata = {
      belongingSignalItem: signalItem,
    };

    const subSignalPositions = this.scope.resolveRegularSubSignals(signalItem.vertices, signalItem.signalType);

    subSignalPositions.forEach((s: {
      position: Vector3;
      color: SubSignalColorType;
    }) => {
      const subSignalId = `${signalItem.generalSubSignalIndex}`;

      const subSignalMesh = this.scope.createSubSignalMesh(s.position, this.scope.resolveSubSignalColorValue(s.color), `${subSignalId}__SubSignalMesh`);

      signalItem.subSignalItems.push({
        subSignalId,
        subSignalType: AtlasSubsignal.Type.CIRCLE,
        subSignalColorType: s.color,
        position: s.position,
        subSignalMesh,
      });

      signalItem.generalSubSignalIndex++;
    });

    this.createdSignalItem = signalItem;

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

  removeSignal() {
    const createdSignalItem = this.createdSignalItem as SignalItem;
     
    this.scope.emitEvent(RemoveSignalEvent, {
      id: createdSignalItem.signalId,
    });

    this.scope.emitEvent(StoreDirtySignalEvent, {
      signalId: createdSignalItem.signalId,
      signalPID: createdSignalItem.signalPID,
    });

    this.scope.emitEvent(InvokeRemoveSignalEvent, {
      signalId: this.signalId,
    });
  }
};