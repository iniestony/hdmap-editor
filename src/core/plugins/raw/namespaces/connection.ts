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
import { StoreDirtyRoadEvent } from '../../statusManager/constant';
import { RoadVertexCategory } from '../../roadConnectionDrawer/type';

export function resolveConnectionRoadInitRefLineSerieCollection(
  this: ExtendedNamespace,
  startRoadItem: RoadItem,
  endRoadItem: RoadItem,
  startRoadVertexCategory: RoadVertexCategory,
  endRoadVertexCategory: RoadVertexCategory,
) {
  const startReferenceLineCatmullPoints = startRoadItem.referenceLine.catmullPoints;
  const startReferenceLineCatmullTangents = startRoadItem.referenceLine.catmullTangents;
  const endReferenceLineCatmullPoints = endRoadItem.referenceLine.catmullPoints;
  const endReferenceLineCatmullTangents = endRoadItem.referenceLine.catmullTangents;

  const startReferenceLineAltitudeCatmullPoints = startRoadItem.referenceLine.altitudeCatmullPoints;
  const startReferenceLineAltitudeCatmullTangents = startRoadItem.referenceLine.altitudeCatmullTangents;
  const endReferenceLineAltitudeCatmullPoints = endRoadItem.referenceLine.altitudeCatmullPoints;
  const endReferenceLineAltitudeCatmullTangents = endRoadItem.referenceLine.altitudeCatmullTangents;

  let startCatmullPoint = new Vector3();
  let startCatmullTangent = new Vector3();
  let endCatmullPoint = new Vector3();
  let endCatmullTangent = new Vector3();

  let startAltitudeCatmullPoint = new Vector3();
  let startAltitudeCatmullTangent = new Vector3();
  let endAltitudeCatmullPoint = new Vector3();
  let endAltitudeCatmullTangent = new Vector3();

  if (startRoadVertexCategory === RoadVertexCategory.RoadStart && endRoadVertexCategory === RoadVertexCategory.RoadStart) {
    startCatmullPoint = startReferenceLineCatmullPoints[0] as Vector3;
    startCatmullTangent = (startReferenceLineCatmullTangents[0].normalize() as Vector3).multiplyByFloats(-1, -1, -1);

    endCatmullPoint = endReferenceLineCatmullPoints[0] as Vector3;
    endCatmullTangent = endReferenceLineCatmullTangents[0].normalize() as Vector3;

    startAltitudeCatmullPoint = startReferenceLineAltitudeCatmullPoints[0] as Vector3;
    startAltitudeCatmullTangent = (startReferenceLineAltitudeCatmullTangents[0].normalize() as Vector3).multiplyByFloats(-1, -1, -1);

    endAltitudeCatmullPoint = endReferenceLineAltitudeCatmullPoints[0] as Vector3;
    endAltitudeCatmullTangent = endReferenceLineAltitudeCatmullTangents[0].normalize() as Vector3;
  } else if (
    (startRoadVertexCategory === RoadVertexCategory.RoadStart && endRoadVertexCategory === RoadVertexCategory.RoadEnd) ||
    (startRoadVertexCategory === RoadVertexCategory.RoadEnd && endRoadVertexCategory === RoadVertexCategory.RoadStart)
  ) {
    startCatmullPoint = startReferenceLineCatmullPoints[startReferenceLineCatmullPoints.length - 1] as Vector3;
    startCatmullTangent = startReferenceLineCatmullTangents[startReferenceLineCatmullTangents.length - 1].normalize() as Vector3;
    
    endCatmullPoint = endReferenceLineCatmullPoints[0] as Vector3;
    endCatmullTangent = endReferenceLineCatmullTangents[0].normalize() as Vector3;

    startAltitudeCatmullPoint = startReferenceLineAltitudeCatmullPoints[startReferenceLineAltitudeCatmullPoints.length - 1] as Vector3;
    startAltitudeCatmullTangent = startReferenceLineAltitudeCatmullTangents[startReferenceLineAltitudeCatmullTangents.length - 1].normalize() as Vector3;
    
    endAltitudeCatmullPoint = endReferenceLineAltitudeCatmullPoints[0] as Vector3;
    endAltitudeCatmullTangent = endReferenceLineAltitudeCatmullTangents[0].normalize() as Vector3;
  } else if (startRoadVertexCategory === RoadVertexCategory.RoadEnd && endRoadVertexCategory === RoadVertexCategory.RoadEnd) {
    startCatmullPoint = startReferenceLineCatmullPoints[startReferenceLineCatmullPoints.length - 1] as Vector3;
    startCatmullTangent = startReferenceLineCatmullTangents[startReferenceLineCatmullTangents.length - 1].normalize() as Vector3;

    endCatmullPoint = endReferenceLineCatmullPoints[endReferenceLineCatmullPoints.length - 1] as Vector3;
    endCatmullTangent = (endReferenceLineCatmullTangents[endReferenceLineCatmullTangents.length - 1].normalize() as Vector3).multiplyByFloats(-1, -1, -1);

    startAltitudeCatmullPoint = startReferenceLineAltitudeCatmullPoints[startReferenceLineAltitudeCatmullPoints.length - 1] as Vector3;
    startAltitudeCatmullTangent = startReferenceLineAltitudeCatmullTangents[startReferenceLineAltitudeCatmullTangents.length - 1].normalize() as Vector3;

    endAltitudeCatmullPoint = endReferenceLineAltitudeCatmullPoints[endReferenceLineAltitudeCatmullPoints.length - 1] as Vector3;
    endAltitudeCatmullTangent = (endReferenceLineAltitudeCatmullTangents[endReferenceLineAltitudeCatmullTangents.length - 1].normalize() as Vector3).multiplyByFloats(-1, -1, -1);
  }

  const rawCatmullPoints = [startCatmullPoint, endCatmullPoint];
  const rawCatmullTangents = [startCatmullTangent, endCatmullTangent];

  const rawSeriePoints = this.generateHermiteSerieReflineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
    rawCatmullPoints,
    rawCatmullTangents,
  );

  const altitudeCatmullPoints = [
    new Vector3(this.calculateAltitudeXViaPointXWithAlignToFirstPointX(startCatmullPoint, startCatmullPoint), 0, startAltitudeCatmullPoint.z),
    new Vector3(this.calculateAltitudeXViaPointXWithAlignToFirstPointX(endCatmullPoint, startCatmullPoint), 0, endAltitudeCatmullPoint.z),
  ];
  const altitudeCatmullTangents = [startAltitudeCatmullTangent, endAltitudeCatmullTangent];

  const applied = this.applyAltitudeToHermiteSerieRefLineCatmullPointsAndSeriePoints(
    rawCatmullPoints,
    rawSeriePoints,
    altitudeCatmullPoints,
    altitudeCatmullTangents,
  );

  const catmullPoints = applied.appliedCatmullPoints;
  const seriePoints = applied.appliedSeriePoints;
  const catmullTangents = rawCatmullTangents;

  const resolved = this.calculateNormalsAndTangentsOfCurveSeriePoints(seriePoints);
  const serieTangents = resolved.serieTangents;
  const serieNormals = resolved.serieNormals;

  return {
    seriePoints,
    serieTangents,
    serieNormals,
    catmullPoints,
    catmullTangents,
    altitudeCatmullPoints,
    altitudeCatmullTangents,
  };
};

export function resolveGradientDistances(
  this: ExtendedNamespace,
  connectionRoadItem: RoadItem,
  laneSide: LaneSide,
  startPoint: Vector3,
  endPoint: Vector3,
) {
  const referenceLineSeriePoints = connectionRoadItem.referenceLine.seriePoints;
  
  let gradientDistances = [] as number[];

  if (laneSide === LaneSide.Left) {
    const refStartDistance = endPoint.subtract(referenceLineSeriePoints[0]).length();
    const refEndDistance = startPoint.subtract(referenceLineSeriePoints[referenceLineSeriePoints.length - 1]).length();
    
    gradientDistances = referenceLineSeriePoints.map((p: Vector3, idx: number) => {
      return refStartDistance + (refEndDistance - refStartDistance) * (idx / (referenceLineSeriePoints.length - 1));
    }).reverse();
  } else if (laneSide === LaneSide.Right) {
    const refStartDistance = startPoint.subtract(referenceLineSeriePoints[0]).length();
    const refEndDistance = endPoint.subtract(referenceLineSeriePoints[referenceLineSeriePoints.length - 1]).length();
    
    gradientDistances = referenceLineSeriePoints.map((p: Vector3, idx: number) => {
      return refStartDistance + (refEndDistance - refStartDistance) * (idx / (referenceLineSeriePoints.length - 1));
    });
  }

  return gradientDistances;
};

export function isDuplicateRoadConnectionLanePrevAndNext(
  this: ExtendedNamespace,
  connectionLaneSide: LaneSide,
  connectionLaneId: string,
  connectionLaneRoadId: string,
  connectionLaneRoadCategory: RoadCategory,
  prevLaneId: string,
  prevLaneRoadId: string,
  prevLaneRoadCategory: RoadCategory,
  nextLaneId: string,
  nextLaneRoadId: string,
  nextLaneRoadCategory: RoadCategory,
) {
  const connectionLaneRoadItem = this.resolveRoadByRoadIdAndRoadCategory(connectionLaneRoadId, connectionLaneRoadCategory) as RoadItem;
  const connectionLaneRoadItemTargetLanes = connectionLaneSide === LaneSide.Left ? connectionLaneRoadItem.laneItems.leftLanes : connectionLaneRoadItem.laneItems.rightLanes;

  let isDuplicate = false;

  connectionLaneRoadItemTargetLanes.forEach((l: LaneItem) => {
    if (l.laneId !== connectionLaneId) {
      const isDuplicatePrev = l.prevLanes.findIndex((prevLane: {
        laneId: string,
        roadId: string,
        roadCategory: RoadCategory,
      }) => {
        return prevLane.laneId === prevLaneId && prevLane.roadId === prevLaneRoadId && prevLane.roadCategory === prevLaneRoadCategory;
      }) >= 0;

      const isDuplicateNext = l.nextLanes.findIndex((nextLane: {
        laneId: string,
        roadId: string,
        roadCategory: RoadCategory,
      }) => {
        return nextLane.laneId === nextLaneId && nextLane.roadId === nextLaneRoadId && nextLane.roadCategory === nextLaneRoadCategory;
      }) >= 0;

      if (isDuplicatePrev && isDuplicateNext) isDuplicate = true;
    }
  });

  return isDuplicate;
};

export function isValidNewRoadConnectionLanePrevAndNext(
  this: ExtendedNamespace,
  connectionLaneRoadId: string,
  connectionLaneRoadCategory: RoadCategory,
  prevLaneId: string,
  prevLaneRoadId: string,
  prevLaneRoadCategory: RoadCategory,
  nextLaneId: string,
  nextLaneRoadId: string,
  nextLaneRoadCategory: RoadCategory,
) {
  const connectionLaneRoadItem = this.resolveRoadByRoadIdAndRoadCategory(connectionLaneRoadId, connectionLaneRoadCategory) as RoadItem;
  const connectionLaneRoadItemTargetLanes = [...connectionLaneRoadItem.laneItems.leftLanes].concat([...connectionLaneRoadItem.laneItems.rightLanes]);

  let isValid = true;

  connectionLaneRoadItemTargetLanes.forEach((l: LaneItem) => {
    const isDuplicatePrev = l.prevLanes.findIndex((prevLane: {
      laneId: string,
      roadId: string,
      roadCategory: RoadCategory,
    }) => {
      return prevLane.laneId === prevLaneId && prevLane.roadId === prevLaneRoadId && prevLane.roadCategory === prevLaneRoadCategory;
    }) >= 0;

    const isDuplicateNext = l.nextLanes.findIndex((nextLane: {
      laneId: string,
      roadId: string,
      roadCategory: RoadCategory,
    }) => {
      return nextLane.laneId === nextLaneId && nextLane.roadId === nextLaneRoadId && nextLane.roadCategory === nextLaneRoadCategory;
    }) >= 0;

    if (isDuplicatePrev && isDuplicateNext) isValid = false;
  });

  return isValid;
};

export function removePrevAndNextRoadInRoads(
  this: ExtendedNamespace,
  target: {
    roadId: string;
    roadCategory: RoadCategory;
  },
  collection: Array<{
    roadId: string;
    roadCategory: RoadCategory;
  }>,
) {
  return collection.filter((r: {
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    return r.roadId !== target.roadId;
  });
};

export function addPrevAndNextRoadInRoads(
  this: ExtendedNamespace,
  target: {
    roadId: string;
    roadCategory: RoadCategory;
  },
  collection: Array<{
    roadId: string;
    roadCategory: RoadCategory;
  }>,
) {
  const newCollection = this.removePrevAndNextRoadInRoads(target, collection);

  newCollection.push(target);

  return newCollection;
};

export function attachRoadInPrevAndNext(
  this: ExtendedNamespace,
  roadItem: RoadItem,
) {
  roadItem.prevRoads.forEach((prevRoad: {
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    const prevRoadItem = this.resolveRoadByRoadIdAndRoadCategory(prevRoad.roadId, prevRoad.roadCategory);

    if (prevRoadItem) {
      prevRoadItem.nextRoads = this.addPrevAndNextRoadInRoads({
        roadId: roadItem.roadId,
        roadCategory: roadItem.category,
      }, prevRoadItem.nextRoads);

      this.emitEvent(StoreDirtyRoadEvent, {
        roadPID: prevRoadItem.roadPID,
        roadId: prevRoadItem.roadId,
        roadCategory: prevRoadItem.category,
      });
    }
  });

  roadItem.nextRoads.forEach((nextRoad: {
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    const nextRoadItem = this.resolveRoadByRoadIdAndRoadCategory(nextRoad.roadId, nextRoad.roadCategory);

    if (nextRoadItem) {
      nextRoadItem.prevRoads = this.addPrevAndNextRoadInRoads({
        roadId: roadItem.roadId,
        roadCategory: roadItem.category,
      }, nextRoadItem.prevRoads);

      this.emitEvent(StoreDirtyRoadEvent, {
        roadPID: nextRoadItem.roadPID,
        roadId: nextRoadItem.roadId,
        roadCategory: nextRoadItem.category,
      });
    }
  });
};

export function detachRoadInPrevAndNext(
  this: ExtendedNamespace,
  roadItem: RoadItem,
) {
  roadItem.prevRoads.forEach((prevRoad: {
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    const prevRoadItem = this.resolveRoadByRoadIdAndRoadCategory(prevRoad.roadId, prevRoad.roadCategory);

    if (prevRoadItem) {
      prevRoadItem.nextRoads = this.removePrevAndNextRoadInRoads({
        roadId: roadItem.roadId,
        roadCategory: roadItem.category,
      }, prevRoadItem.nextRoads);

      this.emitEvent(StoreDirtyRoadEvent, {
        roadPID: prevRoadItem.roadPID,
        roadId: prevRoadItem.roadId,
        roadCategory: prevRoadItem.category,
      });
    }
  });

  roadItem.nextRoads.forEach((nextRoad: {
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    const nextRoadItem = this.resolveRoadByRoadIdAndRoadCategory(nextRoad.roadId, nextRoad.roadCategory);

    if (nextRoadItem) {
      nextRoadItem.prevRoads = this.removePrevAndNextRoadInRoads({
        roadId: roadItem.roadId,
        roadCategory: roadItem.category,
      }, nextRoadItem.prevRoads);

      this.emitEvent(StoreDirtyRoadEvent, {
        roadPID: nextRoadItem.roadPID,
        roadId: nextRoadItem.roadId,
        roadCategory: nextRoadItem.category,
      });
    }
  });
};

export function removePrevAndNextLaneInLanes(
  this: ExtendedNamespace,
  target: {
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  },
  collection: Array<{
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  }>,
) {
  return collection.filter((r: {
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    return !(r.roadId === target.roadId && r.laneId === target.laneId);
  });
};

export function addPrevAndNextLaneInLanes(
  this: ExtendedNamespace,
  target: {
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  },
  collection: Array<{
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  }>,
) {
  const newCollection = this.removePrevAndNextRoadInRoads(target, collection);

  newCollection.push(target);

  return newCollection;
};

export function attachLaneInPrevAndNext(
  this: ExtendedNamespace,
  laneItem: LaneItem,
  roadItem: RoadItem,
) {
  laneItem.prevLanes.forEach((prevLane: {
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    const prevRoadItem = this.resolveRoadByRoadIdAndRoadCategory(prevLane.roadId, prevLane.roadCategory);

    if (prevRoadItem) {
      const allLanes = (prevRoadItem as RoadItem).laneItems.leftLanes.concat((prevRoadItem as RoadItem).laneItems.rightLanes);
      const prevLaneItem = allLanes.filter((l: LaneItem) => {
        return l.laneId === prevLane.laneId;
      })[0];

      if (prevLaneItem) {
        prevLaneItem.nextLanes = this.addPrevAndNextLaneInLanes({
          laneId: laneItem.laneId,
          roadId: roadItem.roadId,
          roadCategory: roadItem.category,
        }, prevLaneItem.nextLanes);

        this.emitEvent(StoreDirtyRoadEvent, {
          roadPID: prevRoadItem.roadPID,
          roadId: prevRoadItem.roadId,
          roadCategory: prevRoadItem.category,
        });
      }
    }
  });

  laneItem.nextLanes.forEach((nextLane: {
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    const nextRoadItem = this.resolveRoadByRoadIdAndRoadCategory(nextLane.roadId, nextLane.roadCategory);

    if (nextRoadItem) {
      const allLanes = (nextRoadItem as RoadItem).laneItems.leftLanes.concat((nextRoadItem as RoadItem).laneItems.rightLanes);
      const nextLaneItem = allLanes.filter((l: LaneItem) => {
        return l.laneId === nextLane.laneId;
      })[0];

      if (nextLaneItem) {
        nextLaneItem.prevLanes = this.addPrevAndNextLaneInLanes({
          laneId: laneItem.laneId,
          roadId: roadItem.roadId,
          roadCategory: roadItem.category,
        }, nextLaneItem.prevLanes);

        this.emitEvent(StoreDirtyRoadEvent, {
          roadPID: nextRoadItem.roadPID,
          roadId: nextRoadItem.roadId,
          roadCategory: nextRoadItem.category,
        });
      }
    }
  });
};

export function detachLaneInPrevAndNext(
  this: ExtendedNamespace,
  laneItem: LaneItem,
  roadItem: RoadItem,
) {
  laneItem.prevLanes.forEach((prevLane: {
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    const prevRoadItem = this.resolveRoadByRoadIdAndRoadCategory(prevLane.roadId, prevLane.roadCategory);

    if (prevRoadItem) {
      const allLanes = (prevRoadItem as RoadItem).laneItems.leftLanes.concat((prevRoadItem as RoadItem).laneItems.rightLanes);
      const prevLaneItem = allLanes.filter((l: LaneItem) => {
        return l.laneId === prevLane.laneId;
      })[0];

      if (prevLaneItem) {
        prevLaneItem.nextLanes = this.removePrevAndNextLaneInLanes({
          laneId: laneItem.laneId,
          roadId: roadItem.roadId,
          roadCategory: roadItem.category,
        }, prevLaneItem.nextLanes);

        this.emitEvent(StoreDirtyRoadEvent, {
          roadPID: prevRoadItem.roadPID,
          roadId: prevRoadItem.roadId,
          roadCategory: prevRoadItem.category,
        });
      }
    }
  });

  laneItem.nextLanes.forEach((nextLane: {
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    const nextRoadItem = this.resolveRoadByRoadIdAndRoadCategory(nextLane.roadId, nextLane.roadCategory);

    if (nextRoadItem) {
      const allLanes = (nextRoadItem as RoadItem).laneItems.leftLanes.concat((nextRoadItem as RoadItem).laneItems.rightLanes);
      const nextLaneItem = allLanes.filter((l: LaneItem) => {
        return l.laneId === nextLane.laneId;
      })[0];

      if (nextLaneItem) {
        nextLaneItem.prevLanes = this.removePrevAndNextLaneInLanes({
          laneId: laneItem.laneId,
          roadId: roadItem.roadId,
          roadCategory: roadItem.category,
        }, nextLaneItem.prevLanes);

        this.emitEvent(StoreDirtyRoadEvent, {
          roadPID: nextRoadItem.roadPID,
          roadId: nextRoadItem.roadId,
          roadCategory: nextRoadItem.category,
        });
      }
    }
  });
};