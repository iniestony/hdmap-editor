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
import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../../core/renderer/config';
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
import { ResolveRoadByIdAndCategoryEvent } from '../../../plugins/statusManager/constant';

export function generateCatmullSerieSegmentSeriePointsViaFourPoints(
  this: ExtendedNamespace,
  rawPreCatmullA: Vector3,
  rawCatmullA: Vector3,
  rawCatmullB: Vector3,
  rawPostCatmullB: Vector3,
  segmentStepSize: number, // include catmullA, exclude catmullB
) {
  // make points reasonable without loop back
  const segmentStraightDistance = rawCatmullA.subtract(rawCatmullB).length();
  const preDistance = rawPreCatmullA.subtract(rawCatmullA).length();
  const postDistance = rawCatmullB.subtract(rawPostCatmullB).length();

  let preCatmullA = rawPreCatmullA;
  let catmullA = rawCatmullA;
  let catmullB = rawCatmullB;
  let postCatmullB = rawPostCatmullB;

  if (preDistance > RendererConfig.catmullSerie.overHandlePreAndPostDistanceOnSegmentDistanceRatio * segmentStraightDistance) {
    preCatmullA = catmullA.multiplyByFloats(2, 2, 2).subtract(catmullB);
  }

  if (postDistance > RendererConfig.catmullSerie.overHandlePreAndPostDistanceOnSegmentDistanceRatio * segmentStraightDistance) {
    postCatmullB = catmullB.multiplyByFloats(2, 2, 2).subtract(catmullA);
  }

  // include catmullA, exclude catmullB
  const segmentPoints = [] as Vector3[];

  for (let i = 0; i < segmentStepSize; i++) {
    const t = i / segmentStepSize;

    const preCatmullARatio = -0.5 * Math.pow(t, 3) + Math.pow(t, 2) - 0.5 * t;
    const preCatmullAFormatted = preCatmullA.multiplyByFloats(preCatmullARatio, preCatmullARatio, preCatmullARatio);

    const catmullARatio = 1.5 * Math.pow(t, 3) - 2.5 * Math.pow(t, 2) + 1;
    const catmullAFormatted = catmullA.multiplyByFloats(catmullARatio, catmullARatio, catmullARatio);

    const catmullBRatio = -1.5 * Math.pow(t, 3) + 2.0 * Math.pow(t, 2) + 0.5 * t;
    const catmullBFormatted = catmullB.multiplyByFloats(catmullBRatio, catmullBRatio, catmullBRatio);

    const postCatmullBRatio = 0.5 * Math.pow(t, 3) - 0.5 * Math.pow(t, 2);
    const postCatmullBFormatted = postCatmullB.multiplyByFloats(postCatmullBRatio, postCatmullBRatio, postCatmullBRatio);

    segmentPoints.push(preCatmullAFormatted.add(catmullAFormatted).add(catmullBFormatted).add(postCatmullBFormatted));
  }

  return segmentPoints;
};

export function resolveStraightSegmentStepSize(
  this: ExtendedNamespace,
  catmullA: Vector3,
  catmullB: Vector3,
) {
  const abDistance = catmullA.subtract(catmullB).length();

  let segmentStepSize = 2;
  if (abDistance < 1) {
    segmentStepSize = 2;
  } else if (abDistance < 2) {
    segmentStepSize = 3;
  } else if (abDistance < 4) {
    segmentStepSize = 6;
  } else if (abDistance < 6) {
    segmentStepSize = 10;
  } else if (abDistance < 10) {
    segmentStepSize = 20;
  } else if (abDistance < 15) {
    segmentStepSize = 30;
  } else if (abDistance < 20) {
    segmentStepSize = 40;
  } else {
    segmentStepSize = Math.floor(abDistance) * 2;
  }

  return segmentStepSize;
};

export function resolveCatmullSegmentStepSize(
  this: ExtendedNamespace,
  rawSegmentLength: number,
) {
  let segmentStepSize = 2;

  if (rawSegmentLength < 1) {
    segmentStepSize = 2;
  } else if (rawSegmentLength < 2) {
    segmentStepSize = 3;
  } else if (rawSegmentLength < 4) {
    segmentStepSize = 6;
  } else if (rawSegmentLength < 6) {
    segmentStepSize = 10;
  } else if (rawSegmentLength < 10) {
    segmentStepSize = 20;
  } else if (rawSegmentLength < 15) {
    segmentStepSize = 30;
  } else if (rawSegmentLength < 20) {
    segmentStepSize = 40;
  } else {
    segmentStepSize = Math.floor(rawSegmentLength) * 2;
  }

  return segmentStepSize;
};

export function generateCatmullSerieLineSeriePointsViaCatmullPoints(
  this: ExtendedNamespace,
  catmullPoints: Vector3[],
) {
  const forwardCatmull = catmullPoints[0];
  const sForwardCatmull = catmullPoints[1];
  const backwardCatmull = catmullPoints[catmullPoints.length - 1];
  const sBackwardCatmull = catmullPoints[catmullPoints.length - 2];

  const virtualForwardCatmull = forwardCatmull.multiplyByFloats(2, 2, 2).subtract(sForwardCatmull);
  const virtualBackwardCatmull = backwardCatmull.multiplyByFloats(2, 2, 2).subtract(sBackwardCatmull);

  const extendedCatmullPoints = [virtualForwardCatmull, ...catmullPoints, virtualBackwardCatmull];

  const seriePoints = [] as Vector3[];

  for (let i = 1; i < extendedCatmullPoints.length - 2; i++) {
    const preCatmullA = extendedCatmullPoints[i - 1];
    const catmullA = extendedCatmullPoints[i];
    const catmullB = extendedCatmullPoints[i + 1];
    const postCatmullB = extendedCatmullPoints[i + 2];

    const straightSegmentStepSize = this.resolveStraightSegmentStepSize(catmullA, catmullB);

    const rawSegmentSeriePoints = this.generateCatmullSerieSegmentSeriePointsViaFourPoints(
      preCatmullA,
      catmullA,
      catmullB,
      postCatmullB,
      straightSegmentStepSize,
    );

    const rawSegmentLength = new Path3D(rawSegmentSeriePoints).getDistanceAt(1);

    const catmullSegmentStepSize = this.resolveCatmullSegmentStepSize(rawSegmentLength);

    const segmentSeriePoints = this.generateCatmullSerieSegmentSeriePointsViaFourPoints(
      preCatmullA,
      catmullA,
      catmullB,
      postCatmullB,
      catmullSegmentStepSize,
    );

    segmentSeriePoints.forEach((v: Vector3) => {
      seriePoints.push(v);
    });
  }

  // put last catmull
  seriePoints.push(catmullPoints[catmullPoints.length - 1]);

  return seriePoints;
};

export function resolveCatmullSerieLineCatmullIndicesBySeriePoints(
  this: ExtendedNamespace,
  seriePoints: Vector3[],
  catmullPoints: Vector3[],
) {
  const path = new Path3D(seriePoints);

  return catmullPoints.map((p: Vector3, idx: number) => {
    if (idx === 0) return 0;
    if (idx === catmullPoints.length - 1) return seriePoints.length - 1;

    const pos = path.getClosestPositionTo(p);

    return path.getPreviousPointIndexAt(pos);
  });
};

export function resolveCatmullSerieLaneLineSeriePointsViaCatmullPointsInCatmullTwoSegmentsWay(
  this: ExtendedNamespace,
  catmullPoints: Vector3[],
  oldSeriePoints: Vector3[],
  catmullIndex: number,
) {
  const oldPath = new Path3D([...oldSeriePoints]);
  const newSeriePoints = [...oldSeriePoints];

  const prevCatmullIndex = catmullIndex - 1;
  const nextCatmullIndex = catmullIndex + 1;

  const catmullPoint = catmullPoints[catmullIndex];
  const prevCatmullPoint = catmullPoints[prevCatmullIndex];
  const nextCatmullPoint = catmullPoints[nextCatmullIndex];
  

  if (!prevCatmullPoint) {
    // pick first catmull, update only right half
    const firstInsideActualPointIndexRightHalf = 0;

    const rOldRight = [...oldSeriePoints].reverse();
    const lastInsideActualPointIndexRightHalf = rOldRight.length - 1 - rOldRight.findIndex((p: Vector3) => {
      return oldPath.getClosestPositionTo(p) <= oldPath.getClosestPositionTo(nextCatmullPoint);
    });

    if (firstInsideActualPointIndexRightHalf < lastInsideActualPointIndexRightHalf) {
      const prePoint = catmullPoint.multiplyByFloats(2, 2, 2).subtract(nextCatmullPoint);
      const postPoint = catmullPoints[nextCatmullIndex + 1] ? catmullPoints[nextCatmullIndex + 1] : nextCatmullPoint.multiplyByFloats(2, 2, 2).subtract(catmullPoint);

      const replaceSegmentPoints = this.generateCatmullSerieSegmentSeriePointsViaFourPoints(
        prePoint,
        catmullPoint,
        nextCatmullPoint,
        postPoint,
        lastInsideActualPointIndexRightHalf - firstInsideActualPointIndexRightHalf,
      );
      // put in last point into segment
      replaceSegmentPoints.push(nextCatmullPoint);

      newSeriePoints.splice(firstInsideActualPointIndexRightHalf, lastInsideActualPointIndexRightHalf - firstInsideActualPointIndexRightHalf + 1, ...replaceSegmentPoints);
    }
  } else if (!nextCatmullPoint) {
    // pick last catmull, update only left half
    const firstInsideActualPointIndexLeftHalf = oldSeriePoints.findIndex((p: Vector3) => {
      return oldPath.getClosestPositionTo(p) >= oldPath.getClosestPositionTo(prevCatmullPoint);
    });

    const lastInsideActualPointIndexLeftHalf = oldSeriePoints.length - 1;

    if (firstInsideActualPointIndexLeftHalf < lastInsideActualPointIndexLeftHalf) {
      const prePoint = catmullPoints[prevCatmullIndex - 1] ? catmullPoints[prevCatmullIndex - 1] : prevCatmullPoint.multiplyByFloats(2, 2, 2).subtract(catmullPoint);
      const postPoint = catmullPoint.multiplyByFloats(2, 2, 2).subtract(prevCatmullPoint);

      const replaceSegmentPoints = this.generateCatmullSerieSegmentSeriePointsViaFourPoints(
        prePoint,
        prevCatmullPoint,
        catmullPoint,
        postPoint,
        lastInsideActualPointIndexLeftHalf - firstInsideActualPointIndexLeftHalf,
      );
      // put in last point into segment
      replaceSegmentPoints.push(catmullPoint);

      newSeriePoints.splice(firstInsideActualPointIndexLeftHalf, lastInsideActualPointIndexLeftHalf - firstInsideActualPointIndexLeftHalf + 1, ...replaceSegmentPoints);
    }
  } else {
    // pick middle catmull, update both halves
    const firstInsideActualPointIndexRightHalf = oldSeriePoints.findIndex((p: Vector3) => {
      return oldPath.getClosestPositionTo(p) >= oldPath.getClosestPositionTo(catmullPoint);
    });

    const rOldRight = [...oldSeriePoints].reverse();
    const lastInsideActualPointIndexRightHalf = rOldRight.length - 1 - rOldRight.findIndex((p: Vector3) => {
      return oldPath.getClosestPositionTo(p) <= oldPath.getClosestPositionTo(nextCatmullPoint);
    });

    if (firstInsideActualPointIndexRightHalf < lastInsideActualPointIndexRightHalf) {
      const prePoint = catmullPoint.multiplyByFloats(2, 2, 2).subtract(nextCatmullPoint);
      const postPoint = catmullPoints[nextCatmullIndex + 1] ? catmullPoints[nextCatmullIndex + 1] : nextCatmullPoint.multiplyByFloats(2, 2, 2).subtract(catmullPoint);

      const replaceSegmentPoints = this.generateCatmullSerieSegmentSeriePointsViaFourPoints(
        prePoint,
        catmullPoint,
        nextCatmullPoint,
        postPoint,
        lastInsideActualPointIndexRightHalf - firstInsideActualPointIndexRightHalf,
      );
      // put in last point into segment
      replaceSegmentPoints.push(nextCatmullPoint);

      newSeriePoints.splice(firstInsideActualPointIndexRightHalf, lastInsideActualPointIndexRightHalf - firstInsideActualPointIndexRightHalf + 1, ...replaceSegmentPoints);
    }


    const firstInsideActualPointIndexLeftHalf = oldSeriePoints.findIndex((p: Vector3) => {
      return oldPath.getClosestPositionTo(p) >= oldPath.getClosestPositionTo(prevCatmullPoint);
    });

    const rOldLeft = [...oldSeriePoints].reverse();
    const lastInsideActualPointIndexLeftHalf = rOldLeft.length - 1 - rOldLeft.findIndex((p: Vector3) => {
      return oldPath.getClosestPositionTo(p) <= oldPath.getClosestPositionTo(catmullPoint);
    });

    if (firstInsideActualPointIndexLeftHalf < lastInsideActualPointIndexLeftHalf) {
      const prePoint = catmullPoints[prevCatmullIndex - 1] ? catmullPoints[prevCatmullIndex - 1] : prevCatmullPoint.multiplyByFloats(2, 2, 2).subtract(catmullPoint);
      const postPoint = catmullPoint.multiplyByFloats(2, 2, 2).subtract(prevCatmullPoint);

      const replaceSegmentPoints = this.generateCatmullSerieSegmentSeriePointsViaFourPoints(
        prePoint,
        prevCatmullPoint,
        catmullPoint,
        postPoint,
        lastInsideActualPointIndexLeftHalf - firstInsideActualPointIndexLeftHalf,
      );
      // put in last point into segment
      replaceSegmentPoints.push(catmullPoint);

      newSeriePoints.splice(firstInsideActualPointIndexLeftHalf, lastInsideActualPointIndexLeftHalf - firstInsideActualPointIndexLeftHalf + 1, ...replaceSegmentPoints);
    }
  }

  return newSeriePoints;
};

export function validateCatmullSerieRoadLaneLineSeriePoints(
  this: ExtendedNamespace,
  roadId: string,
  roadCategory: RoadCategory,
) {
  let isValid = true;

  const roadItem = this.resolveRoadByRoadIdAndRoadCategory(roadId, roadCategory) as RoadItem;

  const isSingleLaneLineIntersected = (
    innerLaneLineSeriePoints: Vector3[],
    outerLaneLineSeriePoints: Vector3[],
  ) => {
    const laneLineSeriePointsNum = innerLaneLineSeriePoints.length;

    // start from 1, first serie point is always correct
    for (let i = 1; i < laneLineSeriePointsNum; i++) {
      const isIntersected = this.isSegmentsIntersectedInProjectedXZPlane(
        [innerLaneLineSeriePoints[i - 1], outerLaneLineSeriePoints[i - 1]],
        [innerLaneLineSeriePoints[i], outerLaneLineSeriePoints[i]],
      );

      if (isIntersected) return true;
    }

    return false;
  };

  roadItem.laneItems.leftLanes.forEach((laneItem: LaneItem) => {
    const isIntersected = isSingleLaneLineIntersected(laneItem.laneLines.innerLaneLine.seriePoints, laneItem.laneLines.outerLaneLine.seriePoints);
    
    if (isIntersected) {
      isValid = false;
    }
  });

  roadItem.laneItems.rightLanes.forEach((laneItem: LaneItem) => {
    const isIntersected = isSingleLaneLineIntersected(laneItem.laneLines.innerLaneLine.seriePoints, laneItem.laneLines.outerLaneLine.seriePoints);
    
    if (isIntersected) {
      isValid = false;
    }
  });

  return isValid;
};

export function calculateSingleLaneLineInvalidPairNum(
  this: ExtendedNamespace,
  innerLaneLineSeriePoints: Vector3[],
  outerLaneLineSeriePoints: Vector3[],
) {
  const laneLineSeriePointsNum = innerLaneLineSeriePoints.length;
  let invalidPair = 0; 

  // start from 1, first serie point is always correct
  for (let i = 1; i < laneLineSeriePointsNum; i++) {
    const isIntersected = this.isSegmentsIntersectedInProjectedXZPlane(
      [innerLaneLineSeriePoints[i - 1], outerLaneLineSeriePoints[i - 1]],
      [innerLaneLineSeriePoints[i], outerLaneLineSeriePoints[i]],
    );

    if (isIntersected) invalidPair++;
  }

  return invalidPair;
};

export function shouldAdjustCatmullSerieRoadLaneLineSeriePoints(
  this: ExtendedNamespace,
  roadItemKeyInfo: RoadItemKeyInfo,
) {
  let shouldAdjust = true;

  roadItemKeyInfo.laneItems.leftLanes.forEach((laneItem: LaneItemKeyInfo) => {
    const invalidPairNum = this.calculateSingleLaneLineInvalidPairNum(laneItem.laneLines.innerLaneLine.seriePoints, laneItem.laneLines.outerLaneLine.seriePoints);
    
    if (invalidPairNum > RendererConfig.catmullSerie.maximumCatmullLaneLineSerieIntersectionNum) {
      shouldAdjust = false;
    }
  });

  roadItemKeyInfo.laneItems.rightLanes.forEach((laneItem: LaneItemKeyInfo) => {
    const invalidPairNum = this.calculateSingleLaneLineInvalidPairNum(laneItem.laneLines.innerLaneLine.seriePoints, laneItem.laneLines.outerLaneLine.seriePoints);
    
    if (invalidPairNum > RendererConfig.catmullSerie.maximumCatmullLaneLineSerieIntersectionNum) {
      shouldAdjust = false;
    }
  });

  return shouldAdjust;
};