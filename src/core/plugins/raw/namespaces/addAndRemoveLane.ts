import {
  Mesh,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  LinesMesh,
  Color4,
  Curve3,
} from "@babylonjs/core";
import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../renderer/config';
import { TransactionType } from '../../../transactions';
import {
  RoadItem,
  RoadCategory,
  LineAndCurveItem,
  LineAndCurveCategory,
  LaneLineSide,
  LaneSide,
  LaneItem,
  LaneItemKeyInfo,
  AddLaneSide,
} from '../../statusManager/type';

export function addLane(
  this: ExtendedNamespace,
  roadId: string,
  roadCategory: RoadCategory,
  laneSide: LaneSide,
  laneIndex: number,
  addLaneSide: AddLaneSide,
) {
  const roadItem = this.resolveRoadByRoadIdAndRoadCategory(roadId, roadCategory) as RoadItem;

  // for connected road, can only add lane to outer most
  if (roadItem.prevRoads.length > 0 || roadItem.nextRoads.length > 0) {
    const currentLanesCount = laneSide === LaneSide.Left ? roadItem.laneItems.leftLanes.length : roadItem.laneItems.rightLanes.length;

    if (
      (
        laneIndex < 0 && currentLanesCount > 0
      ) || (
        laneIndex >= 0 && (laneIndex !== currentLanesCount - 1 || addLaneSide !== AddLaneSide.Right)
      )
    ) {
      this.notifyFailure('当前道路存在前后关联道路，仅可在最外侧车道的右侧新增车道');
      return;
    }
  }

  if (roadCategory === RoadCategory.TwoStraightLineRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
      laneSide,
      laneIndex,
      addLaneSide,
    };

    const transaction = this.createTransaction(TransactionType.AddLaneTwoStraightLineRoad, opts);
    this.commitTransaction(transaction);
  } else if (roadCategory === RoadCategory.ThreeCircleCurveRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
      laneSide,
      laneIndex,
      addLaneSide,
    };

    const transaction = this.createTransaction(TransactionType.AddLaneThreeCircleCurveRoad, opts);
    this.commitTransaction(transaction);
  } else if (roadCategory === RoadCategory.QuadraticBezierCurveRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
      laneSide,
      laneIndex,
      addLaneSide,
    };

    const transaction = this.createTransaction(TransactionType.AddLaneQuadraticBezierCurveRoad, opts);
    this.commitTransaction(transaction);
  } else if (roadCategory === RoadCategory.CubicBezierCurveRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
      laneSide,
      laneIndex,
      addLaneSide,
    };

    const transaction = this.createTransaction(TransactionType.AddLaneCubicBezierCurveRoad, opts);
    this.commitTransaction(transaction);
  } else if (roadCategory === RoadCategory.CatmullSerieRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
      laneSide,
      laneIndex,
      addLaneSide,
    };

    const transaction = this.createTransaction(TransactionType.AddLaneCatmullSerieRoad, opts);
    this.commitTransaction(transaction);
  }
};

export function removeLane(
  this: ExtendedNamespace,
  roadId: string,
  roadCategory: RoadCategory,
  laneSide: LaneSide,
  laneId: string,
) {
  const roadItem = this.resolveRoadByRoadIdAndRoadCategory(roadId, roadCategory) as RoadItem;
  const laneItem = this.resolveLaneByLaneRoadIdAndRoadCategory(laneId, roadId, roadCategory) as LaneItem;

  // no lanes in current lane side
  if (laneSide === LaneSide.Left && roadItem.laneItems.leftLanes.length === 0) return;
  if (laneSide === LaneSide.Right && roadItem.laneItems.rightLanes.length === 0) return;

  // only lane in this road, remove road
  if ((
    laneSide === LaneSide.Left && roadItem.laneItems.leftLanes.length === 1 && roadItem.laneItems.rightLanes.length === 0
  ) || (
      laneSide === LaneSide.Right && roadItem.laneItems.rightLanes.length === 1 && roadItem.laneItems.leftLanes.length === 0
    )) {
    this.removeRoad(roadId, roadCategory);
    return;
  }

  // for connected road, only outer most lane can be removed
  if (roadItem.prevRoads.length > 0 || roadItem.nextRoads.length > 0) {
    const isMostOuter = this.isMostOuterLaneInRoad(roadItem, laneItem);

    if (!isMostOuter) {
      this.notifyFailure('当前道路存在前后关联道路，仅可删除最外侧车道');
      return;
    }
  }

  if (roadCategory === RoadCategory.TwoStraightLineRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
      laneSide,
      laneId,
    };

    const transaction = this.createTransaction(TransactionType.RemoveLaneTwoStraightLineRoad, opts);
    this.commitTransaction(transaction);
  } else if (roadCategory === RoadCategory.ThreeCircleCurveRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
      laneSide,
      laneId,
    };

    const transaction = this.createTransaction(TransactionType.RemoveLaneThreeCircleCurveRoad, opts);
    this.commitTransaction(transaction);
  } else if (roadCategory === RoadCategory.QuadraticBezierCurveRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
      laneSide,
      laneId,
    };

    const transaction = this.createTransaction(TransactionType.RemoveLaneQuadraticBezierCurveRoad, opts);
    this.commitTransaction(transaction);
  } else if (roadCategory === RoadCategory.CubicBezierCurveRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
      laneSide,
      laneId,
    };

    const transaction = this.createTransaction(TransactionType.RemoveLaneCubicBezierCurveRoad, opts);
    this.commitTransaction(transaction);
  } else if (roadCategory === RoadCategory.CatmullSerieRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
      laneSide,
      laneId,
    };

    const transaction = this.createTransaction(TransactionType.RemoveLaneCatmullSerieRoad, opts);
    this.commitTransaction(transaction);
  }
};

export function removeConnectionLane(
  this: ExtendedNamespace,
  roadId: string,
  roadCategory: RoadCategory,
  laneSide: LaneSide,
  laneId: string,
) {
  const roadItem = this.resolveRoadByRoadIdAndRoadCategory(roadId, roadCategory) as RoadItem;
  const laneItem = this.resolveLaneByLaneRoadIdAndRoadCategory(laneId, roadId, roadCategory) as LaneItem;

  // no lanes in current lane side
  if (laneSide === LaneSide.Left && roadItem.laneItems.leftLanes.length === 0) return;
  if (laneSide === LaneSide.Right && roadItem.laneItems.rightLanes.length === 0) return;

  // only lane in this road, remove road
  if ((
    laneSide === LaneSide.Left && roadItem.laneItems.leftLanes.length === 1 && roadItem.laneItems.rightLanes.length === 0
  ) || (
      laneSide === LaneSide.Right && roadItem.laneItems.rightLanes.length === 1 && roadItem.laneItems.leftLanes.length === 0
    )) {
    this.removeRoadConnection(roadId, roadCategory);
    return;
  }

  const opts = {
    scope: this,
    roadId,
    roadCategory,
    laneSide,
    laneId,
  };

  const transaction = this.createTransaction(TransactionType.RemoveLaneConnectionRoad, opts);
  this.commitTransaction(transaction);
};

export function removeRoadAction(
  this: ExtendedNamespace,
  roadItem: RoadItem,
) {
  const referenceLine = roadItem.referenceLine;

  referenceLine.lineAndCurveMesh.dispose();
  if (!referenceLine.markerDisposed) {
    referenceLine.pointsMesh.forEach((m: Mesh) => {
      m.dispose();
    });
  }

  const surfaceLines = roadItem.surfaceLines;

  surfaceLines.forEach((s: LineAndCurveItem) => {
    s.lineAndCurveMesh.dispose();
    if (!s.markerDisposed) {
      s.pointsMesh.forEach((m: Mesh) => {
        m.dispose();
      });
    }
  });

  const allLaneItems = roadItem.laneItems.leftLanes.concat(roadItem.laneItems.rightLanes);

  allLaneItems.forEach((lane: LaneItem) => {
    lane.laneMesh.dispose();
    lane.laneDirectionMeshs.forEach((m: Mesh) => {
      m.dispose();
    });

    const innerLaneLine = lane.laneLines.innerLaneLine;
    innerLaneLine.lineAndCurveMesh.forEach((m: Mesh) => {
      m.dispose()
    })
    if (!innerLaneLine.markerDisposed) {
      innerLaneLine.pointsMesh.forEach((m: Mesh) => {
        m.dispose();
      });
    }

    const outerLaneLine = lane.laneLines.outerLaneLine;
    outerLaneLine.lineAndCurveMesh.forEach((m: Mesh) => {
      m.dispose();
    })

    if (!outerLaneLine.markerDisposed) {
      outerLaneLine.pointsMesh.forEach((m: Mesh) => {
        m.dispose();
      });
    }

    const laneConnectorStart = lane.laneConnectors.laneConnectorStart;
    laneConnectorStart.lineAndCurveMesh.forEach((m: Mesh) => {
      m.dispose();
    })
    if (!laneConnectorStart.markerDisposed) {
      laneConnectorStart.pointsMesh.forEach((m: Mesh) => {
        m.dispose();
      });
    }

    const laneConnectorEnd = lane.laneConnectors.laneConnectorEnd;
    laneConnectorEnd.lineAndCurveMesh.forEach((m: Mesh) => {
      m.dispose();
    })

    if (!laneConnectorEnd.markerDisposed) {
      laneConnectorEnd.pointsMesh.forEach((m: Mesh) => {
        m.dispose();
      });
    }
  });

  this.makeSceneDirty();
};

export function removeRoad(
  this: ExtendedNamespace,
  roadId: string,
  roadCategory: RoadCategory,
) {
  if (roadCategory === RoadCategory.TwoStraightLineRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
    };

    const transaction = this.createTransaction(TransactionType.RemoveTwoStraightLineRoad, opts);
    this.commitTransaction(transaction);
  } else if (roadCategory === RoadCategory.ThreeCircleCurveRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
    };

    const transaction = this.createTransaction(TransactionType.RemoveThreeCircleCurveRoad, opts);
    this.commitTransaction(transaction);
  } else if (roadCategory === RoadCategory.QuadraticBezierCurveRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
    };

    const transaction = this.createTransaction(TransactionType.RemoveQuadraticBezierCurveRoad, opts);
    this.commitTransaction(transaction);
  } else if (roadCategory === RoadCategory.CubicBezierCurveRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
    };

    const transaction = this.createTransaction(TransactionType.RemoveCubicBezierCurveRoad, opts);
    this.commitTransaction(transaction);
  } else if (roadCategory === RoadCategory.CatmullSerieRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
    };

    const transaction = this.createTransaction(TransactionType.RemoveCatmullSerieRoad, opts);
    this.commitTransaction(transaction);
  }
};

export function removeRoadConnection(
  this: ExtendedNamespace,
  roadId: string,
  roadCategory: RoadCategory,
) {
  if (roadCategory === RoadCategory.ConnectionRoad) {
    const opts = {
      scope: this,
      roadId,
      roadCategory,
    };

    const transaction = this.createTransaction(TransactionType.RemoveConnectionRoad, opts);
    this.commitTransaction(transaction);
  }
};