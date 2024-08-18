import {
  Mesh,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  LinesMesh,
  Color4,
  Path3D,
  Space,
  TransformNode,
  Quaternion,
} from "@babylonjs/core";
import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../../core/renderer/config';
import { TransactionType } from "../../../../core/transactions";
import {
  RoadItem,
  LineAndCurveItem,
  ReferenceLineItem,
  LaneLineItem,
  LaneLineSide,
  LaneSide,
  LaneItem,
  LineAndCurveItemKeyInfo,
  ReferenceLineItemKeyInfo,
  LaneLineItemKeyInfo,
  LaneItemKeyInfo,
  RoadItemKeyInfo,
  RoadCategory,
  JunctionItem,
  JunctionEdgeItem,
  SignalItem,
  SubSignalItem,
  SignalItemKeyInfo,
  SubSignalItemKeyInfo,
} from '../../statusManager/type';
import {
  ResolveSignalByIdEvent,
} from "../../statusManager/constant";
import {
  SignalItemAttributeEdit,
} from "../../signalEditor/type";
import {
  AtlasSignInfo,
  AtlasSignal,
  AtlasSubsignal,
} from '../../atlasConverter/type';
import {
  SubSignalColorType,
} from "../../signalDrawer/type";

export function resolveSignalItemKeyInfo(this: ExtendedNamespace, signalItem: SignalItem) {
  const info = {
    signalId: signalItem.signalId,
    signalPID: signalItem.signalPID,
    signalType: signalItem.signalType,
    width: signalItem.width,
    height: signalItem.height,
    position: signalItem.position,
    rotationHorizontal: signalItem.rotationHorizontal,
    rotationVertical: signalItem.rotationVertical,
    vertices: {
      topLeft: signalItem.vertices.topLeft,
      topRight: signalItem.vertices.topRight,
      bottomLeft: signalItem.vertices.bottomLeft,
      bottomRight:signalItem.vertices.bottomRight,
      center: signalItem.vertices.center,
    },
    generalSubSignalIndex: signalItem.generalSubSignalIndex,
    subSignalItems: signalItem.subSignalItems.map((s: SubSignalItem) => {
      return this.resolveSubSignalItemKeyInfo(s);
    }),
  } as SignalItemKeyInfo;

  return info;
};

export function resolveSubSignalItemKeyInfo(this: ExtendedNamespace, subSignalItem: SubSignalItem) {
  const info = {
    subSignalId: subSignalItem.subSignalId,
    subSignalType: subSignalItem.subSignalType,
    subSignalColorType: subSignalItem.subSignalColorType,
    position: subSignalItem.position,
  } as SubSignalItemKeyInfo;

  return info;
};

export function resolveSignalBySignalId(this: ExtendedNamespace, signalId: string) {
  let rawSignalItem: SignalItem | undefined = undefined;

  this.emitEvent(ResolveSignalByIdEvent, {
    signalId: signalId,
    callback: (signalItem: SignalItem | undefined) => {
      rawSignalItem = signalItem;
    }
  });

  return rawSignalItem;
};

export function resolveSignalPlaneCornerVertices(
  this: ExtendedNamespace,
  signalPlane: Mesh,
  original: {
    tl: Vector3;
    bl: Vector3;
    tr: Vector3;
    br: Vector3;
  },
  pivot: Vector3,
) {
  const rotationQuaternion = signalPlane.rotationQuaternion;

  const topLeft = Vector3.Zero();
  const topRight = Vector3.Zero();
  const bottomLeft = Vector3.Zero();
  const bottomRight = Vector3.Zero();
  const center = Vector3.Zero();

  if (!rotationQuaternion) {
    return {
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
      center,
    };
  }

  original.tl.rotateByQuaternionAroundPointToRef(rotationQuaternion, pivot, topLeft);
  original.tr.rotateByQuaternionAroundPointToRef(rotationQuaternion, pivot, topRight);
  original.bl.rotateByQuaternionAroundPointToRef(rotationQuaternion, pivot, bottomLeft);
  original.br.rotateByQuaternionAroundPointToRef(rotationQuaternion, pivot, bottomRight);
  
  return {
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
    center: topLeft.add(bottomRight).multiplyByFloats(0.5, 0.5, 0.5),
  };
};

export function createSignalPlane(this: ExtendedNamespace, opts: {
  id: string,
  width: number,
  height: number,
  position: Vector3,
  rotationHorizontal: number,
  rotationVertical: number,
}) {
  const options = {
    width: opts.width,
    height: opts.height,
    sideOrientation: Mesh.DOUBLESIDE,
  };

  const signalPlane = MeshBuilder.CreatePlane(opts.id, options, this.getSceneManager().getContextScene());

  const mat = new StandardMaterial('mat', this.getSceneManager().getContextScene());
  mat.diffuseColor = RendererConfig.trafficLights.signalPanelColor;
  mat.alpha = RendererConfig.trafficLights.signalPanelAlpha;
  signalPlane.material = mat;

  const pivotPoint = new Vector3(-opts.width / 2, opts.height / 2, 0);
  signalPlane.setPivotPoint(pivotPoint);

  signalPlane.position = new Vector3(opts.position.x, opts.position.y, opts.position.z);

  const initTopLeft = new Vector3(-opts.width / 2 + opts.position.x, opts.height / 2 + opts.position.y, opts.position.z);
  const initBottomLeft = new Vector3(-opts.width / 2 + opts.position.x, -opts.height / 2 + opts.position.y, opts.position.z);
  const initTopRight = new Vector3(opts.width / 2 + opts.position.x, opts.height / 2 + opts.position.y, opts.position.z);
  const initBottomRight = new Vector3(opts.width / 2 + opts.position.x, -opts.height / 2 + opts.position.y, opts.position.z);

  signalPlane.rotationQuaternion = Quaternion.FromEulerAngles(opts.rotationHorizontal, opts.rotationVertical, 0);

  const vertices_final = this.resolveSignalPlaneCornerVertices(signalPlane, {
    tl: initTopLeft,
    bl: initBottomLeft,
    tr: initTopRight,
    br: initBottomRight,
  }, initTopLeft);

  return {
    signalPlane,
    vertices: vertices_final,
  };
};

export function removeSignalAction(
  this: ExtendedNamespace,
  signalItem: SignalItem,
) {
  signalItem.subSignalItems.forEach((subSignalItem: SubSignalItem) => {
    subSignalItem.subSignalMesh.dispose();
  });

  signalItem.signalMesh.dispose();

  this.makeSceneDirty();
};

export function resolveSubSignalColorValue(
  this: ExtendedNamespace,
  subSignalColorType: SubSignalColorType,
) {
  if (subSignalColorType === SubSignalColorType.Red) return Color3.Red();
  if (subSignalColorType === SubSignalColorType.Yellow) return Color3.Yellow();
  if (subSignalColorType === SubSignalColorType.Green) return Color3.Green();
  
  return Color3.Red();
};

export function resolveRegularSubSignals(
  this: ExtendedNamespace,
  vertices: {
    topLeft: Vector3;
    topRight: Vector3;
    bottomLeft: Vector3;
    bottomRight: Vector3;
    center: Vector3;
  },
  signalType: AtlasSignal.Type,
) {
  const topLeft = vertices.topLeft;
  const topRight = vertices.topRight;
  const bottomLeft = vertices.bottomLeft;
  const bottomRight = vertices.bottomRight;

  const halfHorizontal = topLeft.add(topRight).multiplyByFloats(0.5, 0.5, 0.5);
  const halfVertival = topLeft.add(bottomLeft).multiplyByFloats(0.5, 0.5, 0.5);

  const diffHorizontal = topRight.subtract(topLeft);
  const diffVertical = bottomLeft.subtract(topLeft);

  if (signalType === AtlasSignal.Type.MIX_2_HORIZONTAL) {
    return [
      {
        position: halfVertival.add(diffHorizontal.multiplyByFloats(1 / 3, 1 / 3, 1 / 3)),
        color: SubSignalColorType.Red,
      },
      {
        position: halfVertival.add(diffHorizontal.multiplyByFloats(2 / 3, 2 / 3, 2 / 3)),
        color: SubSignalColorType.Green,
      },
    ];
  } else if (signalType === AtlasSignal.Type.MIX_2_VERTICAL) {
    return [
      {
        position: halfHorizontal.add(diffVertical.multiplyByFloats(1 / 3, 1 / 3, 1 / 3)),
        color: SubSignalColorType.Red,
      },
      {
        position: halfHorizontal.add(diffVertical.multiplyByFloats(2 / 3, 2 / 3, 2 / 3)),
        color: SubSignalColorType.Green,
      },
    ];
  } else if (signalType === AtlasSignal.Type.MIX_3_HORIZONTAL) {
    return [
      {
        position: halfVertival.add(diffHorizontal.multiplyByFloats(1 / 4, 1 / 4, 1 / 4)),
        color: SubSignalColorType.Red,
      },
      {
        position: halfVertival.add(diffHorizontal.multiplyByFloats(2 / 4, 2 / 4, 2 / 4)),
        color: SubSignalColorType.Yellow,
      },
      {
        position: halfVertival.add(diffHorizontal.multiplyByFloats(3 / 4, 3 / 4, 3 / 4)),
        color: SubSignalColorType.Green,
      },
    ];
  } else if (signalType === AtlasSignal.Type.MIX_3_VERTICAL) {
    return [
      {
        position: halfHorizontal.add(diffVertical.multiplyByFloats(1 / 4, 1 / 4, 1 / 4)),
        color: SubSignalColorType.Red,
      },
      {
        position: halfHorizontal.add(diffVertical.multiplyByFloats(2 / 4, 2 / 4, 2 / 4)),
        color: SubSignalColorType.Yellow,
      },
      {
        position: halfHorizontal.add(diffVertical.multiplyByFloats(3 / 4, 3 / 4, 3 / 4)),
        color: SubSignalColorType.Green,
      },
    ];
  } else if (signalType === AtlasSignal.Type.SINGLE) {
    return [
      {
        position: vertices.center,
        color: SubSignalColorType.Red,
      },
      
    ];
  } else if (signalType === AtlasSignal.Type.UNKNOWN) {
    return [];
  }

  return [];
};

export function createSubSignalMesh(
  this: ExtendedNamespace,
  pos: Vector3,
  color: Color3,
  id: string,
) {
  const subSignalMesh = MeshBuilder.CreateSphere(id, {
    diameter: RendererConfig.trafficLights.subSignalDiameter,
  }, this.getSceneManager().getContextScene());

  subSignalMesh.position.x = pos.x;
  subSignalMesh.position.y = pos.y;
  subSignalMesh.position.z = pos.z;

  const mat = new StandardMaterial('mat', this.getSceneManager().getContextScene());
  mat.diffuseColor = color;

  subSignalMesh.material = mat;

  return subSignalMesh;
};

export function inlineReformatSignalSubSignals(
  this: ExtendedNamespace,
  signalItem: SignalItem,
) {
  signalItem.generalSubSignalIndex = 0;

  signalItem.subSignalItems.forEach((subSignalItem: SubSignalItem) => {
    subSignalItem.subSignalMesh.dispose();
  });

  signalItem.subSignalItems = [];

  const subSignalPositions = this.resolveRegularSubSignals(signalItem.vertices, signalItem.signalType);

  subSignalPositions.forEach((s: {
    position: Vector3;
    color: SubSignalColorType;
  }) => {
    const subSignalId = `${signalItem.generalSubSignalIndex}`;

    const subSignalMesh = this.createSubSignalMesh(s.position, this.resolveSubSignalColorValue(s.color), `${subSignalId}__SubSignalMesh`);

    signalItem.subSignalItems.push({
      subSignalId,
      subSignalType: AtlasSubsignal.Type.CIRCLE,
      subSignalColorType: s.color,
      position: s.position,
      subSignalMesh,
    });

    signalItem.generalSubSignalIndex++;
  });
};

export function inlineReformatSignal(
  this: ExtendedNamespace,
  signalItemGeometryInfo: {
    width: number;
    height: number;
    position: Vector3;
    rotationHorizontal: number;
    rotationVertical: number;
  },
  signalItem: SignalItem,
) {
  const { signalPlane, vertices } = this.createSignalPlane({
    id: signalItem.signalMesh.id,
    width: signalItemGeometryInfo.width,
    height: signalItemGeometryInfo.height,
    position: signalItemGeometryInfo.position,
    rotationHorizontal: signalItemGeometryInfo.rotationHorizontal,
    rotationVertical: signalItemGeometryInfo.rotationVertical,
  });

  signalItem.signalMesh.dispose();

  signalItem.width = signalItemGeometryInfo.width;
  signalItem.height = signalItemGeometryInfo.height;
  signalItem.position = signalItemGeometryInfo.position;
  signalItem.rotationHorizontal = signalItemGeometryInfo.rotationHorizontal;
  signalItem.rotationVertical = signalItemGeometryInfo.rotationVertical;
  signalItem.vertices = vertices;
  signalItem.signalMesh = signalPlane;

  signalItem.signalMesh.metadata = {
    belongingSignalItem: signalItem,
  };

  this.inlineReformatSignalSubSignals(signalItem);

  this.makeSceneDirty();
};

export function alterSignalItemAttributeEdit(
  this: ExtendedNamespace,
  signalId: string,
  signalItemAttributeEdit: SignalItemAttributeEdit,
) {
  if (signalItemAttributeEdit.signalType !== undefined) {
    const opts = {
      scope: this,
      signalId,
      signalType: signalItemAttributeEdit.signalType,
    };
  
    const transaction = this.createTransaction(TransactionType.ReformatSignalBySignalType, opts);
    this.commitTransaction(transaction);
  } else {
    const opts = {
      scope: this,
      signalId,
      signalItemAttributeEdit,
    };

    const transaction = this.createTransaction(TransactionType.SignalAttributeEdit, opts);
    this.commitTransaction(transaction);
  }
};

export function alterSignalGeometry(
  this: ExtendedNamespace,
  signalId: string,
  options: {
    width?: number;
    height?: number;
    position?: Vector3;
    rotationHorizontal?: number;
    rotationVertical?: number;
  },
) {
  const oldSignalItem = this.resolveSignalBySignalId(signalId) as SignalItem;

  const opts = {
    scope: this,
    signalId,
    width: options.width !== undefined ? options.width : oldSignalItem.width,
    height: options.height !== undefined ? options.height : oldSignalItem.height,
    position: options.position !== undefined ? options.position : oldSignalItem.position,
    rotationHorizontal: options.rotationHorizontal !== undefined ? options.rotationHorizontal : oldSignalItem.rotationHorizontal,
    rotationVertical: options.rotationVertical !== undefined ? options.rotationVertical : oldSignalItem.rotationVertical,
  };

  const transaction = this.createTransaction(TransactionType.ReformatSignalByGeometry, opts);
  this.commitTransaction(transaction);
};

export function alterSubSignalType(
  this: ExtendedNamespace,
  signalId: string,
  subSignalId: string,
  subSignalType: AtlasSubsignal.Type,
) {
  const opts = {
    scope: this,
    signalId,
    subSignalId,
    subSignalType,
  };

  const transaction = this.createTransaction(TransactionType.ReformatSignalBySubSignalType, opts);
  this.commitTransaction(transaction);
};

export function removeSignal(
  this: ExtendedNamespace,
  signalId: string,
) {
  const opts = {
    scope: this,
    signalId,
  };

  const transaction = this.createTransaction(TransactionType.RemoveSignal, opts);
  this.commitTransaction(transaction);
};