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
  JunctionItemAttributeEdit
} from '../../junctionEditor/type'


export function alterJunctionItemAttributeEdit(
  this: ExtendedNamespace,
  junctionId: string,
  junctionItemAttributeEdit: JunctionItemAttributeEdit
) {
  const opts = {
    scope: this,
    junctionId,
    junctionItemAttributeEdit,
  };
  const transaction = this.createTransaction(TransactionType.JunctionAttributeEdit, opts);
  this.commitTransaction(transaction);
};