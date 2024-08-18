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
import {
  RoadItem,
  LineAndCurveItem,
  LineAndCurveCategory,
  LaneLineSide,
  LaneSide,
  LaneItem,
  LaneItemKeyInfo,
} from '../../statusManager/type';
import {
  ActionMeshCategory as LaneActionMeshCategory,
  ActionMeshMetadata as LaneActionMeshMetadata,
} from '../../../plugins/roadLaneEditor/type';

export function resolveCatmullStartAndEndEditTargetPointViaActionMesh(
  this: ExtendedNamespace,
  roadItem: RoadItem,
  actionMeshMetadata: LaneActionMeshMetadata,
  currentCatmullPoint: Vector3,
  pickedPoint: Vector3,
) {
  const actionMeshCategory = actionMeshMetadata.category;
  const actionMeshIsStartCatmull = actionMeshMetadata.isStartCatmull as boolean;
  const actionMeshIsEndCatmull = actionMeshMetadata.isEndCatmull as boolean;

  const reflineStartNormal = roadItem.startPointNormal;
  const reflineEndNormal = roadItem.endPointNormal;

  let targetNormal = Vector3.One();

  if ((actionMeshCategory === LaneActionMeshCategory.LeftLaneCatmullEdit) && actionMeshIsStartCatmull) {
    targetNormal = reflineEndNormal.multiplyByFloats(-1, -1, -1).normalize();
  } else if ((actionMeshCategory === LaneActionMeshCategory.LeftLaneCatmullEdit) && actionMeshIsEndCatmull) {
    targetNormal = reflineStartNormal.multiplyByFloats(-1, -1, -1).normalize();
  } else if ((actionMeshCategory === LaneActionMeshCategory.RightLaneCatmullEdit) && actionMeshIsStartCatmull) {
    targetNormal = reflineStartNormal.normalize();
  } else if ((actionMeshCategory === LaneActionMeshCategory.RightLaneCatmullEdit) && actionMeshIsEndCatmull) {
    targetNormal = reflineEndNormal.normalize();
  }
  
  const moveDirection = pickedPoint.subtract(currentCatmullPoint);
  const projectionRatio = Vector3.Dot(targetNormal, moveDirection);

  const targetPoint = currentCatmullPoint.add(targetNormal.multiplyByFloats(projectionRatio, projectionRatio, projectionRatio));
  targetPoint.y = pickedPoint.y;

  return targetPoint;
};

export function generateSeriePointsViaCatmullPoints(
  this: ExtendedNamespace,
  catmullPoints: Vector3[],
) {
  const seriePoints = Curve3.CreateCatmullRomSpline(catmullPoints, RendererConfig.mesh.catmullStepSize, false).getPoints();
  
  return seriePoints;
};

export function isMostInnerLaneInRoad(
  this: ExtendedNamespace,
  roadItem: RoadItem,
  laneItem: LaneItem,
) {
  const leftLanes = roadItem.laneItems.leftLanes;
  const rightLanes = roadItem.laneItems.rightLanes;

  const leftIndex = leftLanes.findIndex((l: LaneItem) => {
    return l.laneId === laneItem.laneId;
  });

  const rightIndex = rightLanes.findIndex((l: LaneItem) => {
    return l.laneId === laneItem.laneId;
  });
  
  return leftIndex === 0 || rightIndex === 0;
};

export function isMostOuterLaneInRoad(
  this: ExtendedNamespace,
  roadItem: RoadItem,
  laneItem: LaneItem,
) {
  const leftLanes = roadItem.laneItems.leftLanes;
  const rightLanes = roadItem.laneItems.rightLanes;

  const leftLanesCount = leftLanes.length;
  const rightLanesCount = rightLanes.length;

  const leftIndex = leftLanes.findIndex((l: LaneItem) => {
    return l.laneId === laneItem.laneId;
  });

  const rightIndex = rightLanes.findIndex((l: LaneItem) => {
    return l.laneId === laneItem.laneId;
  });
  
  return (leftLanesCount > 0 && leftIndex === leftLanesCount - 1) || (rightLanesCount > 0 && rightIndex === rightLanesCount - 1);
};