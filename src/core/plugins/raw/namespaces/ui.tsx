import {
  Mesh,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  LinesMesh,
  Color4,
  Curve3,
  Path3D,
} from "@babylonjs/core";
import { ExclamationCircleFilled } from '@ant-design/icons';
import { Button, Modal, Space, message } from 'antd';
import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../renderer/config';

export function notifyInfo(
  this: ExtendedNamespace,
  msg: string,
) {
  message.info(msg);
};

export function notifySuccess(
  this: ExtendedNamespace,
  msg: string,
) {
  message.success(msg);
};

export function notifyFailure(
  this: ExtendedNamespace,
  msg: string,
) {
  message.error(msg);
};

export function clearAllAlerts(
  this: ExtendedNamespace,
) {
  Modal.destroyAll();
};

export function alertUnexpectedRoadLaneLineSeriePointsOnlyPost(
  this: ExtendedNamespace,
) {
  this.clearAllAlerts();

  Modal.confirm({
    title: `道路异常`,
    icon: <ExclamationCircleFilled />,
    keyboard: false,
    mask: true,
    maskClosable: false,
    wrapClassName: 'alert_unexpected_road_lane_line',
    content: `当前道路可能存在非预期折叠，是否要撤回当前操作？`,
    okText: `是`,
    cancelText: `否`,
    onOk: () => {
      this.performTransactionUndo();
    },
    onCancel: () => {},
  });
};

export function alertUnexpectedRoadLaneLineSeriePointsPreAndPost(
  this: ExtendedNamespace,
) {
  this.clearAllAlerts();

  Modal.warn({
    title: `道路异常`,
    icon: <ExclamationCircleFilled />,
    keyboard: false,
    mask: true,
    maskClosable: false,
    wrapClassName: 'alert_unexpected_road_lane_line',
    content: `当前操作并未修复道路的非预期折叠，当前操作将被撤回，请重新操作。`,
    okText: `确认`,
    onOk: () => {
      this.performTransactionUndo();
    },
  });
};