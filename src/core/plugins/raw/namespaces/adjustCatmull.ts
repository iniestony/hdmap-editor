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

export function attemptAdjustCatmullSerieRoadLaneLineSeriePoints(
  this: ExtendedNamespace,
  roadItemKeyInfo: RoadItemKeyInfo,
) {
  const shouldAdjust = this.shouldAdjustCatmullSerieRoadLaneLineSeriePoints(roadItemKeyInfo);
  if (!shouldAdjust) return;

  // left lanes
  const leftLanesNum = roadItemKeyInfo.laneItems.leftLanes.length;

  for (let i = 0; i < leftLanesNum; i++) {
    const currentLaneLaneItemKeyInfo = roadItemKeyInfo.laneItems.leftLanes[i];
    const currentInnerLaneLineSeriePoints = [...currentLaneLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints];
    const currentOuterLaneLineSeriePoints = [...currentLaneLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints];
    const invalidPairNum = this.calculateSingleLaneLineInvalidPairNum(currentInnerLaneLineSeriePoints, currentOuterLaneLineSeriePoints);

    if (invalidPairNum > 0) {
      let leftBound = 0;

      while (leftBound < currentInnerLaneLineSeriePoints.length - 1) {
        let rightBound = leftBound + 1;
        let rightBoundIntersected = this.isSegmentsIntersectedInProjectedXZPlane(
          [currentInnerLaneLineSeriePoints[leftBound], currentOuterLaneLineSeriePoints[leftBound]],
          [currentInnerLaneLineSeriePoints[rightBound], currentOuterLaneLineSeriePoints[rightBound]],
        );

        while (rightBoundIntersected && (rightBound < currentInnerLaneLineSeriePoints.length)) {
          rightBound++;

          if (rightBound < currentInnerLaneLineSeriePoints.length) {
            rightBoundIntersected = this.isSegmentsIntersectedInProjectedXZPlane(
              [currentInnerLaneLineSeriePoints[leftBound], currentOuterLaneLineSeriePoints[leftBound]],
              [currentInnerLaneLineSeriePoints[rightBound], currentOuterLaneLineSeriePoints[rightBound]],
            );
          }
        }

        if (rightBoundIntersected) {
          // no more unInter bound, stick to left bound
          if ((rightBound >= currentInnerLaneLineSeriePoints.length)) {
            const leftBoundPoint = currentOuterLaneLineSeriePoints[leftBound];

            for (let m = leftBound + 1; m < currentOuterLaneLineSeriePoints.length; m++) {
              currentOuterLaneLineSeriePoints[m] = leftBoundPoint;
            }
          }
        } else {
          if (rightBound > leftBound + 1) {
            const leftBoundPoint = currentOuterLaneLineSeriePoints[leftBound];
            const rightBoundPoint = currentOuterLaneLineSeriePoints[rightBound];
            const direction = rightBoundPoint.subtract(leftBoundPoint);

            for(let n = leftBound + 1; n < rightBound; n++) {
              const ratio = (n - leftBound) / (rightBound - leftBound);
              const point = leftBoundPoint.add(direction.multiplyByFloats(ratio, ratio, ratio));
      
              currentOuterLaneLineSeriePoints[n] = point;
            }
          }
        }

        leftBound = rightBound;
      }
    }

    // update current
    currentLaneLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints = [...currentInnerLaneLineSeriePoints];
    currentLaneLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints = [...currentOuterLaneLineSeriePoints];
    currentLaneLaneItemKeyInfo.laneConnectors.laneConnectorStart.seriePoints = [currentInnerLaneLineSeriePoints[0], currentOuterLaneLineSeriePoints[0]];
    currentLaneLaneItemKeyInfo.laneConnectors.laneConnectorStart.catmullPoints = [currentInnerLaneLineSeriePoints[0], currentOuterLaneLineSeriePoints[0]];
    currentLaneLaneItemKeyInfo.laneConnectors.laneConnectorEnd.seriePoints = [currentInnerLaneLineSeriePoints[currentInnerLaneLineSeriePoints.length - 1], currentOuterLaneLineSeriePoints[currentOuterLaneLineSeriePoints.length - 1]];
    currentLaneLaneItemKeyInfo.laneConnectors.laneConnectorEnd.catmullPoints = [currentInnerLaneLineSeriePoints[currentInnerLaneLineSeriePoints.length - 1], currentOuterLaneLineSeriePoints[currentOuterLaneLineSeriePoints.length - 1]];

    // not last lane
    if (i < leftLanesNum - 1) {
      const nextLaneLaneItemKeyInfo = roadItemKeyInfo.laneItems.leftLanes[i + 1];
      const nextInnerLaneLineSeriePoints = [...currentOuterLaneLineSeriePoints];
      const nextOuterLaneLineSeriePoints = [...nextLaneLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints];

      nextLaneLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints = [...nextInnerLaneLineSeriePoints];
      nextLaneLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints = [...nextOuterLaneLineSeriePoints];
      nextLaneLaneItemKeyInfo.laneConnectors.laneConnectorStart.seriePoints = [nextInnerLaneLineSeriePoints[0], nextOuterLaneLineSeriePoints[0]];
      nextLaneLaneItemKeyInfo.laneConnectors.laneConnectorStart.catmullPoints = [nextInnerLaneLineSeriePoints[0], nextOuterLaneLineSeriePoints[0]];
      nextLaneLaneItemKeyInfo.laneConnectors.laneConnectorEnd.seriePoints = [nextInnerLaneLineSeriePoints[nextInnerLaneLineSeriePoints.length - 1], nextOuterLaneLineSeriePoints[nextOuterLaneLineSeriePoints.length - 1]];
      nextLaneLaneItemKeyInfo.laneConnectors.laneConnectorEnd.catmullPoints = [nextInnerLaneLineSeriePoints[nextInnerLaneLineSeriePoints.length - 1], nextOuterLaneLineSeriePoints[nextOuterLaneLineSeriePoints.length - 1]];
    }
  }

  // right lanes
  const rightLanesNum = roadItemKeyInfo.laneItems.rightLanes.length;

  for (let i = 0; i < rightLanesNum; i++) {
    const currentLaneLaneItemKeyInfo = roadItemKeyInfo.laneItems.rightLanes[i];
    const currentInnerLaneLineSeriePoints = [...currentLaneLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints];
    const currentOuterLaneLineSeriePoints = [...currentLaneLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints];
    const invalidPairNum = this.calculateSingleLaneLineInvalidPairNum(currentInnerLaneLineSeriePoints, currentOuterLaneLineSeriePoints);

    if (invalidPairNum > 0) {
      let leftBound = 0;

      while (leftBound < currentInnerLaneLineSeriePoints.length - 1) {
        let rightBound = leftBound + 1;
        let rightBoundIntersected = this.isSegmentsIntersectedInProjectedXZPlane(
          [currentInnerLaneLineSeriePoints[leftBound], currentOuterLaneLineSeriePoints[leftBound]],
          [currentInnerLaneLineSeriePoints[rightBound], currentOuterLaneLineSeriePoints[rightBound]],
        );

        while (rightBoundIntersected && (rightBound < currentInnerLaneLineSeriePoints.length)) {
          rightBound++;

          if (rightBound < currentInnerLaneLineSeriePoints.length) {
            rightBoundIntersected = this.isSegmentsIntersectedInProjectedXZPlane(
              [currentInnerLaneLineSeriePoints[leftBound], currentOuterLaneLineSeriePoints[leftBound]],
              [currentInnerLaneLineSeriePoints[rightBound], currentOuterLaneLineSeriePoints[rightBound]],
            );
          }
        }

        if (rightBoundIntersected) {
          // no more unInter bound, stick to left bound
          if ((rightBound >= currentInnerLaneLineSeriePoints.length)) {
            const leftBoundPoint = currentOuterLaneLineSeriePoints[leftBound];

            for (let m = leftBound + 1; m < currentOuterLaneLineSeriePoints.length; m++) {
              currentOuterLaneLineSeriePoints[m] = leftBoundPoint;
            }
          }
        } else {
          if (rightBound > leftBound + 1) {
            const leftBoundPoint = currentOuterLaneLineSeriePoints[leftBound];
            const rightBoundPoint = currentOuterLaneLineSeriePoints[rightBound];
            const direction = rightBoundPoint.subtract(leftBoundPoint);

            for(let n = leftBound + 1; n < rightBound; n++) {
              const ratio = (n - leftBound) / (rightBound - leftBound);
              const point = leftBoundPoint.add(direction.multiplyByFloats(ratio, ratio, ratio));
      
              currentOuterLaneLineSeriePoints[n] = point;
            }
          }
        }

        leftBound = rightBound;
      }
    }

    // update current
    currentLaneLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints = [...currentInnerLaneLineSeriePoints];
    currentLaneLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints = [...currentOuterLaneLineSeriePoints];
    currentLaneLaneItemKeyInfo.laneConnectors.laneConnectorStart.seriePoints = [currentInnerLaneLineSeriePoints[0], currentOuterLaneLineSeriePoints[0]];
    currentLaneLaneItemKeyInfo.laneConnectors.laneConnectorStart.catmullPoints = [currentInnerLaneLineSeriePoints[0], currentOuterLaneLineSeriePoints[0]];
    currentLaneLaneItemKeyInfo.laneConnectors.laneConnectorEnd.seriePoints = [currentInnerLaneLineSeriePoints[currentInnerLaneLineSeriePoints.length - 1], currentOuterLaneLineSeriePoints[currentOuterLaneLineSeriePoints.length - 1]];
    currentLaneLaneItemKeyInfo.laneConnectors.laneConnectorEnd.catmullPoints = [currentInnerLaneLineSeriePoints[currentInnerLaneLineSeriePoints.length - 1], currentOuterLaneLineSeriePoints[currentOuterLaneLineSeriePoints.length - 1]];

    // not last lane
    if (i < leftLanesNum - 1) {
      const nextLaneLaneItemKeyInfo = roadItemKeyInfo.laneItems.leftLanes[i + 1];
      const nextInnerLaneLineSeriePoints = [...currentOuterLaneLineSeriePoints];
      const nextOuterLaneLineSeriePoints = [...nextLaneLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints];

      nextLaneLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints = [...nextInnerLaneLineSeriePoints];
      nextLaneLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints = [...nextOuterLaneLineSeriePoints];
      nextLaneLaneItemKeyInfo.laneConnectors.laneConnectorStart.seriePoints = [nextInnerLaneLineSeriePoints[0], nextOuterLaneLineSeriePoints[0]];
      nextLaneLaneItemKeyInfo.laneConnectors.laneConnectorStart.catmullPoints = [nextInnerLaneLineSeriePoints[0], nextOuterLaneLineSeriePoints[0]];
      nextLaneLaneItemKeyInfo.laneConnectors.laneConnectorEnd.seriePoints = [nextInnerLaneLineSeriePoints[nextInnerLaneLineSeriePoints.length - 1], nextOuterLaneLineSeriePoints[nextOuterLaneLineSeriePoints.length - 1]];
      nextLaneLaneItemKeyInfo.laneConnectors.laneConnectorEnd.catmullPoints = [nextInnerLaneLineSeriePoints[nextInnerLaneLineSeriePoints.length - 1], nextOuterLaneLineSeriePoints[nextOuterLaneLineSeriePoints.length - 1]];
    }
  }
};