import {
  Mesh,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  LinesMesh,
  Color4,
} from "@babylonjs/core";

import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../../core/renderer/config';
import { TransactionType } from '../../../transactions';
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
} from '../../statusManager/type';
import {
  RoadItemAttributeEdit
} from '../../roadEditor/type';
import {
  RoadItemConnectionAttributeEdit
} from '../../roadConnectionEditor/type';
import {
  RoadLaneAttributeEdit,
  RoadLaneLineAttributeEdit,
} from '../../roadLaneEditor/type';
import {
  RoadConnectionLaneAttributeEdit,
  RoadConnectionLaneLineAttributeEdit,
} from '../../roadConnectionLaneEditor/type'
import {
  AtlasLaneBoundaryType,
} from '../../../../core/plugins/atlasConverter/type';
export function alterTransparentRoad(
  this: ExtendedNamespace,
  roadId: string,
  roadCategory: RoadCategory,
  matAlpha: number,
) {
  const opts = {
    scope: this,
    roadId,
    roadCategory,
    matAlpha,
  };
  const transaction = this.createTransaction(TransactionType.RoadTransparencyEdit, opts);
  this.commitTransaction(transaction);
};

export function alterTransparentRoadConnection(
  this: ExtendedNamespace,
  roadId: string,
  roadCategory: RoadCategory,
  matAlpha: number,
) {
  const opts = {
    scope: this,
    roadId,
    roadCategory,
    matAlpha,
  };
  const transaction = this.createTransaction(TransactionType.RoadConnectionTransparencyEdit, opts);
  this.commitTransaction(transaction);
};

export function alterRoadItemAttributeEdit(
  this: ExtendedNamespace,
  roadId: string,
  roadCategory: RoadCategory,
  roadItemAttributeEdit: RoadItemAttributeEdit
) {
  const opts = {
    scope: this,
    roadId,
    roadCategory,
    roadItemAttributeEdit,
  };

  const transaction = this.createTransaction(TransactionType.RoadAttributeEdit, opts);
  this.commitTransaction(transaction);
};

export function alterRoadItemConnectionAttributeEdit(
  this: ExtendedNamespace,
  roadId: string,
  roadCategory: RoadCategory,
  roadItemConnectionAttributeEdit: RoadItemConnectionAttributeEdit
) {
  const opts = {
    scope: this,
    roadId,
    roadCategory,
    roadItemConnectionAttributeEdit,
  };

  const transaction = this.createTransaction(TransactionType.RoadConnectionAttributeEdit, opts);
  this.commitTransaction(transaction);
};

export function alterRoadLaneItemAttributeEdit(
  this: ExtendedNamespace,
  landId: string,
  roadId: string,
  roadCategory: RoadCategory,
  roadLaneAttributeEdit: RoadLaneAttributeEdit
) {
  const opts = {
    scope: this,
    landId,
    roadId,
    roadCategory,
    roadLaneAttributeEdit,
  };

  const transaction = this.createTransaction(TransactionType.RoadLaneAttributeEdit, opts);
  this.commitTransaction(transaction);
}


export function alterRoadLaneLineItemAttributeEdit(
  this: ExtendedNamespace,
  landId: string,
  roadId: string,
  roadCategory: RoadCategory,
  roadLaneLineAttributeEdit: RoadLaneLineAttributeEdit,
  laneLineSide: LaneLineSide
) {

  const opts = {
    scope: this,
    landId,
    roadId,
    roadCategory,
    roadLaneLineAttributeEdit,
  };

  if (laneLineSide === LaneLineSide.Inner) {
    const transaction = this.createTransaction(TransactionType.RoadLaneLineInnerAttributeEdit, opts);
    this.commitTransaction(transaction);
  } else if (laneLineSide === LaneLineSide.Outer) {
    const transaction = this.createTransaction(TransactionType.RoadLaneLineOuterAttributeEdit, opts);
    this.commitTransaction(transaction);
  }

}

export function alterRoadLaneLineItemLaneBoundaryTypeEdit(
  this: ExtendedNamespace,
  landId: string,
  roadId: string,
  roadCategory: RoadCategory,
  atlasLaneBoundaryType: AtlasLaneBoundaryType.Type,
  atlasLaneBoundaryVirtual: boolean,
  laneLineSide: LaneLineSide
) {

  const opts = {
    scope: this,
    landId,
    roadId,
    roadCategory,
    atlasLaneBoundaryType,
    atlasLaneBoundaryVirtual,
    laneLineSide,
  };

  const transaction = this.createTransaction(TransactionType.RoadLaneLineItemLaneBoundaryTypeEdit, opts);
  this.commitTransaction(transaction);
}


export function alterRoadConnectionLaneItemAttributeEdit(
  this: ExtendedNamespace,
  landId: string,
  roadId: string,
  roadCategory: RoadCategory,
  roadConnectionLaneAttributeEdit: RoadConnectionLaneAttributeEdit
) {
  const opts = {
    scope: this,
    landId,
    roadId,
    roadCategory,
    roadConnectionLaneAttributeEdit,
  };

  const transaction = this.createTransaction(TransactionType.RoadConnectionLaneAttributeEdit, opts);
  this.commitTransaction(transaction);
}

export function alterRoadConnectionLaneLineItemAttributeEdit(
  this: ExtendedNamespace,
  landId: string,
  roadId: string,
  roadCategory: RoadCategory,
  roadConnectionLaneLineAttributeEdit: RoadConnectionLaneLineAttributeEdit,
  laneLineSide: LaneLineSide
) {

  const opts = {
    scope: this,
    landId,
    roadId,
    roadCategory,
    roadConnectionLaneLineAttributeEdit,
  };

  if (laneLineSide === LaneLineSide.Inner) {
    const transaction = this.createTransaction(TransactionType.RoadConnectionLaneLineInnerAttributeEdit, opts);
    this.commitTransaction(transaction);
  } else if (laneLineSide === LaneLineSide.Outer) {
    const transaction = this.createTransaction(TransactionType.RoadConnectionLaneLineOuterAttributeEdit, opts);
    this.commitTransaction(transaction);
  }

}

export function alterRoadConnectionLaneLineItemLaneBoundaryTypeEdit(
  this: ExtendedNamespace,
  landId: string,
  roadId: string,
  roadCategory: RoadCategory,
  atlasLaneBoundaryType: AtlasLaneBoundaryType.Type,
  atlasLaneBoundaryVirtual: boolean,
  laneLineSide: LaneLineSide
) {

  const opts = {
    scope: this,
    landId,
    roadId,
    roadCategory,
    atlasLaneBoundaryType,
    atlasLaneBoundaryVirtual,
    laneLineSide,
  };

  const transaction = this.createTransaction(TransactionType.RoadConnectionLaneLineItemLaneBoundaryTypeEdit, opts);
  this.commitTransaction(transaction);
}