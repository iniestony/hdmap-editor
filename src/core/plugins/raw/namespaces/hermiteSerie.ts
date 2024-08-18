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
import { JunctionVertexCategory } from '../../../plugins/junctionDrawer/type';

export function generateHermiteSerieSegmentSeriePoints(
  this: ExtendedNamespace,
  startPoint: Vector3,
  startControl: Vector3,
  endControl: Vector3,
  endPoint: Vector3,
  segmentStepSize: number, // include startPoint, exclude endPoint
) {
  if (segmentStepSize <= 0) {
    return [];
  }

  if (segmentStepSize === 1) {
    return [startPoint];
  }
  
  if (segmentStepSize === 2 || segmentStepSize === 3) {
    const segmentPoints = [] as Vector3[];

    for (let i = 0; i < segmentStepSize; i++) {
      const ratio = i / segmentStepSize;

      segmentPoints.push(startPoint.add(endPoint.subtract(startPoint).multiplyByFloats(ratio, ratio, ratio)));
    }

    return segmentPoints;
  }

  const segmentPoints = Curve3.CreateCubicBezier(
    startPoint, 
    startControl,
    endControl, 
    endPoint,
    segmentStepSize,
  ).getPoints();

  // include startPoint, exclude endPoint
  segmentPoints.splice(segmentPoints.length - 1);

  return segmentPoints;
};

export function resolveHermiteRawDistanceSegmentStepSize(
  this: ExtendedNamespace,
  startPoint: Vector3,
  endPoint: Vector3,
) {
  const abDistance = startPoint.subtract(endPoint).length();

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

export function generateHermiteSerieLineCatmullTangentsViaCatmullPoints(
  this: ExtendedNamespace,
  catmullPoints: Vector3[],
) {
  const dummySeriePoints = this.generateCatmullSerieLineSeriePointsViaCatmullPoints(catmullPoints);

  const resolved = this.calculateNormalsAndTangentsOfCurveSeriePoints(dummySeriePoints);
  const dummySerieTangents = resolved.serieTangents;

  const catmullIndices = this.resolveCatmullSerieLineCatmullIndicesBySeriePoints(dummySeriePoints, catmullPoints);

  return catmullIndices.map((index: number) => {
    return dummySerieTangents[index].normalize();
  })
};


export function generateHermiteSerieReflineSeriePointsViaCatmullPointsAndCatmullTangents(
  this: ExtendedNamespace,
  catmullPoints: Vector3[],
  catmullTangents: Vector3[],
) {
  const segments = [] as Array<{
    startPoint: Vector3;
    endPoint: Vector3;
    startControl: Vector3;
    endControl: Vector3;
    segmentLength: number;
    stepSize: number;
  }>;

  for (let i = 0; i < catmullPoints.length - 1; i++) {
    const startPoint = catmullPoints[i];
    const endPoint = catmullPoints[i + 1];
    const startTangent = catmullTangents[i].normalize();
    const endTangent = catmullTangents[i + 1].normalize();

    const cosineValue = Vector3.Dot(startTangent, endTangent);
    const startEndDistance = startPoint.subtract(endPoint).length();

    let offsetRatio = 1;
    if (cosineValue >= 0.5) {
      offsetRatio = 1;
    } else if (cosineValue < 0.5 && cosineValue >= 0) {
      offsetRatio = 1.5;
    } else if (cosineValue < 0 && cosineValue >= -0.5) {
      offsetRatio = 2.0;
    } else if (cosineValue < -0.5) {
      offsetRatio = 2.5;
    }

    let baseControlOffset = RendererConfig.hermiteSerie.hermiteTangentExtendDistance;
    if (startEndDistance < 20) {
      baseControlOffset = startEndDistance / 4;
    }

    const controlOffset = baseControlOffset * offsetRatio;

    const startControl = startPoint.add(startTangent.multiplyByFloats(controlOffset, controlOffset, controlOffset));
    const endControl = endPoint.add(endTangent.multiplyByFloats(-controlOffset, -controlOffset, -controlOffset));

    const rawDistanceSegmentStepSize = this.resolveHermiteRawDistanceSegmentStepSize(startPoint, endPoint);

    const rawSegmentSeriePoints = this.generateHermiteSerieSegmentSeriePoints(
      startPoint, 
      startControl,
      endControl, 
      endPoint,
      rawDistanceSegmentStepSize,
    );

    const segmentLength = new Path3D(rawSegmentSeriePoints).getDistanceAt(1);

    const segmentStepSize = this.resolveCatmullSegmentStepSize(segmentLength);

    segments.push({
      startPoint,
      endPoint,
      startControl,
      endControl,
      segmentLength,
      stepSize: segmentStepSize,
    });
  }

  // serie points
  const seriePoints = [] as Vector3[];

  for (let m = 0; m < segments.length; m++) {
    const s = segments[m];
    const segmentSeriePoints = this.generateHermiteSerieSegmentSeriePoints(
      s.startPoint, 
      s.startControl,
      s.endControl, 
      s.endPoint,
      s.stepSize,
    );

    segmentSeriePoints.forEach((v: Vector3) => {
      seriePoints.push(v);
    });
  }

  // put last catmull
  seriePoints.push(catmullPoints[catmullPoints.length - 1]);

  return seriePoints;
};

export function generateHermiteSerieReflineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
  this: ExtendedNamespace,
  catmullPoints: Vector3[],
  catmullTangents: Vector3[],
) {
  let hermiteLength = 0;
  const segments = [] as Array<{
    startPoint: Vector3;
    endPoint: Vector3;
    startControl: Vector3;
    endControl: Vector3;
    segmentLength: number;
    stepSize: number;
  }>;

  for (let i = 0; i < catmullPoints.length - 1; i++) {
    const startPoint = catmullPoints[i];
    const endPoint = catmullPoints[i + 1];
    const startTangent = catmullTangents[i].normalize();
    const endTangent = catmullTangents[i + 1].normalize();

    const cosineValue = Vector3.Dot(startTangent, endTangent);
    const startEndDistance = startPoint.subtract(endPoint).length();

    let offsetRatio = 1;
    if (cosineValue >= 0.5) {
      offsetRatio = 1;
    } else if (cosineValue < 0.5 && cosineValue >= 0) {
      offsetRatio = 1.5;
    } else if (cosineValue < 0 && cosineValue >= -0.5) {
      offsetRatio = 2.0;
    } else if (cosineValue < -0.5) {
      offsetRatio = 2.5;
    }

    let baseControlOffset = RendererConfig.hermiteSerie.hermiteTangentExtendDistance;
    if (startEndDistance < 20) {
      baseControlOffset = startEndDistance / 4;
    }

    const controlOffset = baseControlOffset * offsetRatio;

    const startControl = startPoint.add(startTangent.multiplyByFloats(controlOffset, controlOffset, controlOffset));
    const endControl = endPoint.add(endTangent.multiplyByFloats(-controlOffset, -controlOffset, -controlOffset));

    const rawDistanceSegmentStepSize = this.resolveHermiteRawDistanceSegmentStepSize(startPoint, endPoint);

    const rawSegmentSeriePoints = this.generateHermiteSerieSegmentSeriePoints(
      startPoint, 
      startControl,
      endControl, 
      endPoint,
      rawDistanceSegmentStepSize,
    );

    const segmentLength = new Path3D(rawSegmentSeriePoints).getDistanceAt(1);
    hermiteLength += segmentLength;

    // refine start/end control
    const refinedControlOffset = controlOffset * hermiteLength / RendererConfig.hermiteSerie.controlRefineRatio;

    const refinedStartControl = startPoint.add(startTangent.multiplyByFloats(refinedControlOffset, refinedControlOffset, refinedControlOffset));
    const refinedEndControl = endPoint.add(endTangent.multiplyByFloats(-refinedControlOffset, -refinedControlOffset, -refinedControlOffset));

    const segmentStepSize = this.resolveCatmullSegmentStepSize(segmentLength);

    segments.push({
      startPoint,
      endPoint,
      startControl: refinedStartControl,
      endControl: refinedEndControl,
      segmentLength,
      stepSize: segmentStepSize,
    });
  }

  // serie points
  const seriePoints = [] as Vector3[];

  for (let m = 0; m < segments.length; m++) {
    const s = segments[m];
    const segmentSeriePoints = this.generateHermiteSerieSegmentSeriePoints(
      s.startPoint, 
      s.startControl,
      s.endControl, 
      s.endPoint,
      s.stepSize,
    );

    segmentSeriePoints.forEach((v: Vector3) => {
      seriePoints.push(v);
    });
  }

  // put last catmull
  seriePoints.push(catmullPoints[catmullPoints.length - 1]);

  return seriePoints;
};

export function generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(
  this: ExtendedNamespace,
  catmullPoints: Vector3[],
  catmullTangents: Vector3[],
  alignPointsNum: number,
) {
  let hermiteLength = 0;
  const segments = [] as Array<{
    startPoint: Vector3;
    endPoint: Vector3;
    startControl: Vector3;
    endControl: Vector3;
    segmentLength: number;
    stepSize: number;
  }>;

  for (let i = 0; i < catmullPoints.length - 1; i++) {
    const startPoint = catmullPoints[i];
    const endPoint = catmullPoints[i + 1];
    const startTangent = catmullTangents[i].normalize();
    const endTangent = catmullTangents[i + 1].normalize();

    const cosineValue = Vector3.Dot(startTangent, endTangent);
    const startEndDistance = startPoint.subtract(endPoint).length();

    let offsetRatio = 1;
    if (cosineValue >= 0.5) {
      offsetRatio = 1;
    } else if (cosineValue < 0.5 && cosineValue >= 0) {
      offsetRatio = 1.5;
    } else if (cosineValue < 0 && cosineValue >= -0.5) {
      offsetRatio = 2.0;
    } else if (cosineValue < -0.5) {
      offsetRatio = 2.5;
    }

    let baseControlOffset = RendererConfig.hermiteSerie.hermiteTangentExtendDistance;
    if (startEndDistance < 20) {
      baseControlOffset = startEndDistance / 4;
    }

    const controlOffset = baseControlOffset * offsetRatio;

    const startControl = startPoint.add(startTangent.multiplyByFloats(controlOffset, controlOffset, controlOffset));
    const endControl = endPoint.add(endTangent.multiplyByFloats(-controlOffset, -controlOffset, -controlOffset));

    const rawDistanceSegmentStepSize = this.resolveHermiteRawDistanceSegmentStepSize(startPoint, endPoint);

    const rawSegmentSeriePoints = this.generateHermiteSerieSegmentSeriePoints(
      startPoint, 
      startControl,
      endControl, 
      endPoint,
      rawDistanceSegmentStepSize,
    );

    const segmentLength = new Path3D(rawSegmentSeriePoints).getDistanceAt(1);
    hermiteLength += segmentLength;

    segments.push({
      startPoint,
      endPoint,
      startControl,
      endControl,
      segmentLength,
      stepSize: 1,
    });
  }

  // refine segments stepsize
  let accPointNum = 0;
  for (let m = 0; m < segments.length; m++) {
    const ratio = segments[m].segmentLength / hermiteLength;

    const estimatedStepSize = Math.max(Math.floor((alignPointsNum - 1 - segments.length) * ratio), 1);

    accPointNum += estimatedStepSize;
    segments[m].stepSize = estimatedStepSize;
  }

  let cursor = 0;
  while (accPointNum < alignPointsNum - 1) {
    segments[cursor % segments.length].stepSize++;
    accPointNum++;
    cursor++;
  }

  // serie points
  const seriePoints = [] as Vector3[];

  for (let m = 0; m < segments.length; m++) {
    const s = segments[m];
    const segmentSeriePoints = this.generateHermiteSerieSegmentSeriePoints(
      s.startPoint, 
      s.startControl,
      s.endControl, 
      s.endPoint,
      s.stepSize,
    );

    segmentSeriePoints.forEach((v: Vector3) => {
      seriePoints.push(v);
    });
  }

  // put last catmull
  seriePoints.push(catmullPoints[catmullPoints.length - 1]);

  return seriePoints;
};

export function generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
  this: ExtendedNamespace,
  catmullPoints: Vector3[],
  catmullTangents: Vector3[],
  alignPointsNum: number,
) {
  let hermiteLength = 0;
  const segments = [] as Array<{
    startPoint: Vector3;
    endPoint: Vector3;
    startControl: Vector3;
    endControl: Vector3;
    segmentLength: number;
    stepSize: number;
  }>;

  for (let i = 0; i < catmullPoints.length - 1; i++) {
    const startPoint = catmullPoints[i];
    const endPoint = catmullPoints[i + 1];
    const startTangent = catmullTangents[i].normalize();
    const endTangent = catmullTangents[i + 1].normalize();

    const cosineValue = Vector3.Dot(startTangent, endTangent);
    const startEndDistance = startPoint.subtract(endPoint).length();

    let offsetRatio = 1;
    if (cosineValue >= 0.5) {
      offsetRatio = 1;
    } else if (cosineValue < 0.5 && cosineValue >= 0) {
      offsetRatio = 1.5;
    } else if (cosineValue < 0 && cosineValue >= -0.5) {
      offsetRatio = 2.0;
    } else if (cosineValue < -0.5) {
      offsetRatio = 2.5;
    }

    let baseControlOffset = RendererConfig.hermiteSerie.hermiteTangentExtendDistance;
    if (startEndDistance < 20) {
      baseControlOffset = startEndDistance / 4;
    }

    const controlOffset = baseControlOffset * offsetRatio;

    const startControl = startPoint.add(startTangent.multiplyByFloats(controlOffset, controlOffset, controlOffset));
    const endControl = endPoint.add(endTangent.multiplyByFloats(-controlOffset, -controlOffset, -controlOffset));

    const rawDistanceSegmentStepSize = this.resolveHermiteRawDistanceSegmentStepSize(startPoint, endPoint);

    const rawSegmentSeriePoints = this.generateHermiteSerieSegmentSeriePoints(
      startPoint, 
      startControl,
      endControl, 
      endPoint,
      rawDistanceSegmentStepSize,
    );

    const segmentLength = new Path3D(rawSegmentSeriePoints).getDistanceAt(1);
    hermiteLength += segmentLength;

    // refine start/end control
    const refinedControlOffset = controlOffset * hermiteLength / RendererConfig.hermiteSerie.controlRefineRatio;

    const refinedStartControl = startPoint.add(startTangent.multiplyByFloats(refinedControlOffset, refinedControlOffset, refinedControlOffset));
    const refinedEndControl = endPoint.add(endTangent.multiplyByFloats(-refinedControlOffset, -refinedControlOffset, -refinedControlOffset));

    segments.push({
      startPoint,
      endPoint,
      startControl: refinedStartControl,
      endControl: refinedEndControl,
      segmentLength,
      stepSize: 1,
    });
  }

  // refine segments stepsize
  let accPointNum = 0;
  for (let m = 0; m < segments.length; m++) {
    const ratio = segments[m].segmentLength / hermiteLength;

    const estimatedStepSize = Math.max(Math.floor((alignPointsNum - 1 - segments.length) * ratio), 1);

    accPointNum += estimatedStepSize;
    segments[m].stepSize = estimatedStepSize;
  }

  let cursor = 0;
  while (accPointNum < alignPointsNum - 1) {
    segments[cursor % segments.length].stepSize++;
    accPointNum++;
    cursor++;
  }

  // serie points
  const seriePoints = [] as Vector3[];

  for (let m = 0; m < segments.length; m++) {
    const s = segments[m];
    const segmentSeriePoints = this.generateHermiteSerieSegmentSeriePoints(
      s.startPoint, 
      s.startControl,
      s.endControl, 
      s.endPoint,
      s.stepSize,
    );

    segmentSeriePoints.forEach((v: Vector3) => {
      seriePoints.push(v);
    });
  }

  // put last catmull
  seriePoints.push(catmullPoints[catmullPoints.length - 1]);

  return seriePoints;
};

export function generateHermiteSerieLineAltitudeCatmullTangentsViaCatmullPoints(
  this: ExtendedNamespace,
  catmullPoints: Vector3[],
) {
  const dummySeriePoints = this.generateCatmullSerieLineSeriePointsViaCatmullPoints(catmullPoints);

  const resolved = this.calculateNormalsAndTangentsOfCurveSeriePoints(dummySeriePoints);
  const dummySerieTangents = resolved.serieTangents;

  const catmullIndices = this.resolveCatmullSerieLineCatmullIndicesBySeriePoints(dummySeriePoints, catmullPoints);

  const catmullTangents = catmullIndices.map((index: number) => {
    return dummySerieTangents[index].normalize();
  });

  const oldFirstCatmull = catmullTangents[0];
  const oldLastCatmull = catmullTangents[catmullTangents.length - 1];

  catmullTangents[0] = new Vector3(oldFirstCatmull.x, 0, 0).normalize();
  catmullTangents[catmullTangents.length - 1] = new Vector3(oldLastCatmull.x, 0, 0).normalize();

  return catmullTangents;
};

export function applyAltitudeToHermiteSerieRefLineCatmullPointsAndSeriePoints(
  this: ExtendedNamespace,
  catmullPoints: Vector3[],
  seriePoints: Vector3[],
  altitudeCatmullPoints: Vector3[],
  altitudeCatmullTangents: Vector3[],
) {
  const altitudeSeriePoints = this.generateHermiteSerieAltitudeSeriePoints(altitudeCatmullPoints, altitudeCatmullTangents);
  const altitudePath = new Path3D([...altitudeSeriePoints]);

  const catmullIndices = this.resolveCatmullSerieLineCatmullIndicesBySeriePoints(seriePoints, catmullPoints);

  const seriePath = new Path3D([...seriePoints]);
  const appliedSeriePoints = seriePoints.map((p: Vector3, idx: number) => {
    let pos = 0;
    if (idx === 0) {
      pos = 0;
    } else if (idx === seriePoints.length - 1) {
      pos = 1;
    } else {
      pos = seriePath.getClosestPositionTo(p);
    }

    const virtualAltitudeAtPosition = altitudePath.getPointAt(pos).z;

    return new Vector3(p.x, virtualAltitudeAtPosition, p.z);
  });

  // align catmull points altitude to serie points altitude with calculated indices
  const appliedCatmullPoints = catmullPoints.map((c: Vector3, idx: number) => {
    const relatedSeriePoint = appliedSeriePoints[catmullIndices[idx]];

    return new Vector3(c.x, relatedSeriePoint.y, c.z);
  });

  return {
    appliedSeriePoints,
    appliedCatmullPoints,
  };
};

export function applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
  this: ExtendedNamespace,
  catmullPoints: Vector3[],
  seriePoints: Vector3[],
  altitudeCatmullPoints: Vector3[],
  altitudeCatmullTangents: Vector3[],
) {
  const altitudeSeriePoints = this.generateHermiteSerieAltitudeSeriePoints(altitudeCatmullPoints, altitudeCatmullTangents);
  const altitudePath = new Path3D([...altitudeSeriePoints]);

  const catmullIndices = this.resolveCatmullSerieLineCatmullIndicesBySeriePoints(seriePoints, catmullPoints);

  const seriePath = new Path3D([...seriePoints]);
  const appliedSeriePoints = seriePoints.map((p: Vector3, idx: number) => {
    let pos = 0;
    if (idx === 0) {
      pos = 0;
    } else if (idx === seriePoints.length - 1) {
      pos = 1;
    } else {
      pos = seriePath.getClosestPositionTo(p);
    }

    const virtualAltitudeAtPosition = altitudePath.getPointAt(pos).z;

    return new Vector3(p.x, virtualAltitudeAtPosition, p.z);
  });

  // align catmull points altitude to serie points altitude with calculated indices
  const appliedCatmullPoints = catmullPoints.map((c: Vector3, idx: number) => {
    const relatedSeriePoint = appliedSeriePoints[catmullIndices[idx]];

    return new Vector3(c.x, relatedSeriePoint.y, c.z);
  });

  return {
    appliedSeriePoints,
    appliedCatmullPoints,
  };
};