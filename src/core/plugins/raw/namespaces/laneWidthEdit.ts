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
import earcut from "earcut";
import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../renderer/config';
import {
  RoadItem,
  RoadItemKeyInfo,
  LineAndCurveItem,
  LineAndCurveCategory,
  LaneLineSide,
  LaneSide,
  LaneItem,
  LaneItemKeyInfo,
} from '../../statusManager/type';

export function isLaneWidthEditable(this: ExtendedNamespace, roadItem: RoadItem) {
  const laneItmes = roadItem.laneItems.leftLanes.concat(roadItem.laneItems.rightLanes);

  return laneItmes.every((laneItem: LaneItem) => {
    return laneItem.laneWidthEditable;
  });
};

export function resolveCenterVirtualPointOnPathViaSeriePoints(
  this: ExtendedNamespace,
  seriePoints: Vector3[],
) {
  const path = new Path3D(seriePoints);

  return path.getPointAt(0.5);
};

export function resolveCenterNormalVirtualPointOnPathViaSeriePoints(
  this: ExtendedNamespace,
  seriePoints: Vector3[],
) {
  const path = new Path3D(seriePoints);

  return path.getNormalAt(0.5);
};

export function resolveLaneWidthEditTargetPointViaActionMesh(
  this: ExtendedNamespace,
  roadItem: RoadItem,
  actionMeshRelatedLane: LaneItem,
  pickedPoint: Vector3,
) {
  const laneSide = actionMeshRelatedLane.laneSide;

  const refLineCenterNormal = this.resolveCenterNormalVirtualPointOnPathViaSeriePoints(roadItem.referenceLine.seriePoints).normalize();
  const outerCenter = this.resolveCenterVirtualPointOnPathViaSeriePoints(actionMeshRelatedLane.laneLines.outerLaneLine.seriePoints);

  const sideRatio = laneSide === LaneSide.Left ? -1 : 1;
  const projectionNormal = refLineCenterNormal.multiplyByFloats(sideRatio, sideRatio, sideRatio);

  const moveDirection = pickedPoint.subtract(outerCenter);
  const projectionRatio = Vector3.Dot(projectionNormal, moveDirection);

  const targetPoint = outerCenter.add(projectionNormal.multiplyByFloats(projectionRatio, projectionRatio, projectionRatio));
  targetPoint.y = pickedPoint.y;

  return {
    targetPoint,
    targetDistance: projectionRatio,
  };
};

export function inlineUpdateRoadLanesInOneSide(
  this: ExtendedNamespace,
  laneItemsKeyInfo: LaneItemKeyInfo[],
  laneSide: LaneSide,
  roadItem: RoadItem,
) {
  if (laneSide === LaneSide.Left) {
    const leftLanes = laneItemsKeyInfo.map((laneItemKeyInfo: LaneItemKeyInfo) => {
      return this.reformatRoadLane(
        laneItemKeyInfo,
        LaneSide.Left,
        roadItem,
      );
    });

    // dispose old
    roadItem.laneItems.leftLanes.forEach((laneItem: LaneItem) => {
      laneItem.laneMesh.dispose();
      laneItem.laneDirectionMeshs.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneLines.innerLaneLine.lineAndCurveMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneLines.innerLaneLine.pointsMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneLines.outerLaneLine.lineAndCurveMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneLines.outerLaneLine.pointsMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneConnectors.laneConnectorStart.lineAndCurveMesh.forEach((m: Mesh) => {
        m.dispose();
      });


      laneItem.laneConnectors.laneConnectorStart.pointsMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneConnectors.laneConnectorEnd.lineAndCurveMesh.forEach((m: Mesh) => {
        m.dispose();
      });


      laneItem.laneConnectors.laneConnectorEnd.pointsMesh.forEach((m: Mesh) => {
        m.dispose();
      });
    });

    // inline new
    roadItem.laneItems.leftLanes = leftLanes;
  } else {
    const rightLanes = laneItemsKeyInfo.map((laneItemKeyInfo: LaneItemKeyInfo) => {
      return this.reformatRoadLane(
        laneItemKeyInfo,
        LaneSide.Right,
        roadItem,
      );
    });

    // dispose old
    roadItem.laneItems.rightLanes.forEach((laneItem: LaneItem) => {
      laneItem.laneMesh.dispose();
      laneItem.laneDirectionMeshs.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneLines.innerLaneLine.lineAndCurveMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneLines.innerLaneLine.pointsMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneLines.outerLaneLine.lineAndCurveMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneLines.outerLaneLine.pointsMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneConnectors.laneConnectorStart.lineAndCurveMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneConnectors.laneConnectorStart.pointsMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneConnectors.laneConnectorEnd.lineAndCurveMesh.forEach((m: Mesh) => {
        m.dispose();
      });

      laneItem.laneConnectors.laneConnectorEnd.pointsMesh.forEach((m: Mesh) => {
        m.dispose();
      });
    });

    // inline new
    roadItem.laneItems.rightLanes = rightLanes;
  }
};


export function resolveNeighborForwardId(
  this: ExtendedNamespace,
  roadItemKeyInfo: RoadItemKeyInfo,
  laneItemKeyInfo: LaneItemKeyInfo,
) {
  if(!roadItemKeyInfo && !laneItemKeyInfo) return;
  let leftNeighborId = null;
  let rightNeighborId = null;
  if (laneItemKeyInfo.laneSide === LaneSide.Left) {
    const leftLaneIndex = roadItemKeyInfo.laneItems.leftLanes.findIndex((lane: LaneItemKeyInfo) => {
      return lane.laneId === laneItemKeyInfo.laneId;
    });
    const leftNeighborIndex = leftLaneIndex - 1;
    const rightNeighborIndex = leftLaneIndex + 1;
    const leftLanes = roadItemKeyInfo.laneItems.leftLanes;

    if (leftLanes[leftNeighborIndex]) {
      const id = leftLanes[leftNeighborIndex].laneId;
      leftNeighborId = id;
    }

    if (leftLanes[rightNeighborIndex]) {
      const id = leftLanes[rightNeighborIndex].laneId;
      rightNeighborId = id;
    }
  } else if (laneItemKeyInfo.laneSide === LaneSide.Right) {
    const rightLaneIndex = roadItemKeyInfo.laneItems.rightLanes.findIndex((lane: LaneItemKeyInfo) => {
      return lane.laneId === laneItemKeyInfo.laneId;
    })
    const leftNeighborIndex = rightLaneIndex - 1;
    const rightNeighborIndex = rightLaneIndex + 1;
    const rightLanes = roadItemKeyInfo.laneItems.rightLanes;

    if (rightLanes[leftNeighborIndex]) {
      const id = rightLanes[leftNeighborIndex].laneId;
      leftNeighborId = id;
    }

    if (rightLanes[rightNeighborIndex]) {
      const id = rightLanes[rightNeighborIndex].laneId;
      rightNeighborId = id;
    }
  }
  return {
    leftNeighborForwardLaneId: leftNeighborId,
    rightNeighborForwardLaneId: rightNeighborId
  }
}

export function resolveNeighborReverseId(
  this: ExtendedNamespace,
  roadItemKeyInfo: RoadItemKeyInfo,
  laneItemKeyInfo: LaneItemKeyInfo,
) {
  if(!roadItemKeyInfo && !laneItemKeyInfo) return;
  let leftNeighborId = null;
  let rightNeighborId = null;
  if (laneItemKeyInfo.laneSide === LaneSide.Left) {
    const leftLaneIndex = roadItemKeyInfo.laneItems.leftLanes.findIndex((lane: LaneItemKeyInfo) => {
      return lane.laneId === laneItemKeyInfo.laneId;
    })
    const leftNeighborIndex = leftLaneIndex - 1;
    const rightNeighborIndex = leftLaneIndex + 1;
    const leftLanes = roadItemKeyInfo.laneItems.leftLanes;
    const leftNowDirection = laneItemKeyInfo.atlasLaneDirection;
    if (leftLanes[leftNeighborIndex]) {
      const leftDirection = roadItemKeyInfo.laneItems.leftLanes[leftNeighborIndex].atlasLaneDirection;
      if (leftNowDirection !== leftDirection) {
        const id = leftLanes[leftNeighborIndex].laneId;
        leftNeighborId = id;
      }
    } else {
      const rightLanes = roadItemKeyInfo.laneItems.rightLanes[0];
      if (rightLanes) {
        const rightDirction = rightLanes.atlasLaneDirection;
        if (leftNowDirection !== rightDirction) {
          const id = rightLanes.laneId;
          leftNeighborId = id;
        }
      }
    }

    if (leftLanes[rightNeighborIndex]) {
      const leftDirection = roadItemKeyInfo.laneItems.leftLanes[rightNeighborIndex].atlasLaneDirection;
      if (leftNowDirection !== leftDirection) {
        const id = leftLanes[rightNeighborIndex].laneId;
        rightNeighborId = id;
      }
    }
  } else if (laneItemKeyInfo.laneSide === LaneSide.Right) {
    const rightLaneIndex = roadItemKeyInfo.laneItems.rightLanes.findIndex((lane: LaneItemKeyInfo) => {
      return lane.laneId === laneItemKeyInfo.laneId;
    })
    const leftNeighborIndex = rightLaneIndex - 1;
    const rightNeighborIndex = rightLaneIndex + 1;
    const rightLanes = roadItemKeyInfo.laneItems.rightLanes;
    const rightNowDirection = laneItemKeyInfo.atlasLaneDirection;
    if (rightLanes[leftNeighborIndex]) {
      const rightDirection = roadItemKeyInfo.laneItems.rightLanes[leftNeighborIndex].atlasLaneDirection;
      if (rightNowDirection !== rightDirection) {
        const id = rightLanes[leftNeighborIndex].laneId;
        leftNeighborId = id;
      };
    } else {
      const leftLanes = roadItemKeyInfo.laneItems.leftLanes[0];
      if (leftLanes) {
        const rightDirction = leftLanes.atlasLaneDirection;
        if (rightNowDirection !== rightDirction) {
          const id = leftLanes.laneId;
          leftNeighborId = id;
        }
      }
    }
    if (rightLanes[rightNeighborIndex]) {
      const rightDirection = roadItemKeyInfo.laneItems.rightLanes[rightNeighborIndex].atlasLaneDirection;
      if (rightNowDirection !== rightDirection) {
        const id = rightLanes[rightNeighborIndex].laneId;
        rightNeighborId = id;
      };
    }
  }
  return {
    leftNeighborReverseLaneId: leftNeighborId,
    rightNeighborReverseLaneId: rightNeighborId
  }
}