import {
  Engine,
  Scene,
  FreeCamera,
  FreeCameraMouseWheelInput,
  ArcRotateCamera,
  ArcRotateCameraPointersInput,
  ArcRotateCameraMouseWheelInput,
  HemisphericLight,
  AbstractMesh,
  Mesh,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  LinesMesh,
  Color4,
  Path3D,
  PointerInfo,
  PickingInfo,
  Ray,
  Matrix,
  PointsCloudSystem,
  CloudPoint,
} from "@babylonjs/core";
import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../renderer/config';
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
import { ResolveRoadByIdAndCategoryEvent } from '../../statusManager/constant';
import { FetchAltitudeSurroundingNodePcdInfoEvent } from '../../octreeLoader/constant';
import { PcdInfo } from "../../pcdLoader/type";
import {
  UpdateRoadAltitudeAxisEvent,
} from '../../roadAltitudeAdaptor/constant';
import {
  UpdateRoadConnectionAltitudeAxisEvent,
} from '../../roadConnectionAltitudeAdaptor/constant';
import {
  UpdateRoadLaneAltitudeAxisEvent,
} from '../../roadLaneAltitudeAdaptor/constant';

export function calculateAltitudeXViaPointXWithAlignToFirstPointX(
  this: ExtendedNamespace,
  targetCatmullPoint: Vector3,
  firstCatmullPoint: Vector3,
) {
  return targetCatmullPoint.subtract(firstCatmullPoint).length();
};

// for apply altitude on real serie points and catmull points
export function generateHermiteSerieAltitudeSeriePoints(
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

    const controlOffset = RendererConfig.altitude.serieControlOffset;

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

// for draw trend line
export function generateHermiteSerieAltitudeSeriePointsForTrendLine(
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

    const controlOffset = 1;

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

export function calculateReflineAltitudeSeriePoints(
  this: ExtendedNamespace,
  referenceLineItem: ReferenceLineItem,
) {
  const reflineAltitudeCatmullPoints = [...referenceLineItem.altitudeCatmullPoints];
  const reflineAltitudeCatmullTangents = [...referenceLineItem.altitudeCatmullTangents];

  return this.generateHermiteSerieAltitudeSeriePointsForTrendLine(reflineAltitudeCatmullPoints, reflineAltitudeCatmullTangents);
};

export function calculateLaneLineAltitudeSeriePoints(
  this: ExtendedNamespace,
  laneLineItem: LaneLineItem,
) {
  const laneLineAltitudeCatmullPoints = [...laneLineItem.altitudeCatmullPoints];
  const laneLineAltitudeCatmullTangents = [...laneLineItem.altitudeCatmullTangents];

  return this.generateHermiteSerieAltitudeSeriePointsForTrendLine(laneLineAltitudeCatmullPoints, laneLineAltitudeCatmullTangents);
};

export function syncAltitudeCamera(
  this: ExtendedNamespace,
  contextScene: Scene,
  seriePoints: Vector3[],
) {
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  const lineDistance = new Path3D(seriePoints).getDistanceAt(1);
  const firstSeriePoint = seriePoints[0];
  const lastSeriePoint = seriePoints[seriePoints.length - 1];
  const centerPoint = firstSeriePoint.add(lastSeriePoint).multiplyByFloats(0.5, 0.5, 0.5);

  activeCamera.target = new Vector3(centerPoint.x, centerPoint.y, centerPoint.z);
  activeCamera.setPosition(new Vector3(centerPoint.x, centerPoint.y + Math.floor(lineDistance), centerPoint.z + RendererConfig.altitude.cameraBetaOffset));
};

export function drawRoadAltitudeTrendLine(
  this: ExtendedNamespace,
  contextScene: Scene,
  seriePoints: Vector3[],
  referenceLineItem: ReferenceLineItem,
  roadItem: RoadItem,
) {
  const options = {
    points: seriePoints,
    updatable: true,
  };

  let line = MeshBuilder.CreateLines(referenceLineItem.options.lineId, options, contextScene);
  line.color = new Color3(255, 0, 255);

  line = MeshBuilder.CreateLines(referenceLineItem.options.lineId, { points: seriePoints, instance: line });
  line.renderingGroupId = RendererConfig.renderOrder.MEDIUM;

  line.metadata = {
    altitudeRoadItem: roadItem,
    altitudeLineItem: referenceLineItem,
  };

  return line as LinesMesh;
};

export function drawRoadLaneAltitudeTrendLine(
  this: ExtendedNamespace,
  contextScene: Scene,
  seriePoints: Vector3[],
  laneLineItem: LaneLineItem,
  laneItem: LaneItem,
  roadItem: RoadItem,
) {
  const options = {
    points: seriePoints,
    updatable: true,
  };

  let line = MeshBuilder.CreateLines(laneLineItem.options.lineId, options, contextScene);
  line.color = new Color3(255, 0, 255);

  line = MeshBuilder.CreateLines(laneLineItem.options.lineId, { points: seriePoints, instance: line });
  line.renderingGroupId = RendererConfig.renderOrder.MEDIUM;

  line.metadata = {
    altitudeRoadItem: roadItem,
    altitudeLaneItem: laneItem,
    altitudeLineItem: laneLineItem,
  };

  return line as LinesMesh;
};

export async function drawAltitudeSurroundingNodeMesh(
  this: ExtendedNamespace,
  contextScene: Scene,
  pcdInfo: PcdInfo,
) {
  const pcs = new PointsCloudSystem(
    "RibbonPointsCloudSystem",
    1,
    contextScene,
  );

  const positions = pcdInfo.positions as Float32Array;
  const intensities = pcdInfo.intensities as Float32Array;
  const pointsNum = intensities.length;

  const formatPointCloud = (cloudPoint: CloudPoint, i: number) => {
    // no need to switch y and z
    // normal scene: switch y and z, altitude scene: switch y and z again, double switch = no switch
    cloudPoint.position = new Vector3(
      positions[i * 3 + 0],
      0,
      positions[i * 3 + 2]
    );

    cloudPoint.color = new Color4(1, 1, 1, 1);
  };

  pcs.addPoints(pointsNum, formatPointCloud);

  const mesh = await pcs.buildMeshAsync();
 
  return mesh;
};

export async function drawRoadAltitudePointCloud(
  this: ExtendedNamespace,
  contextScene: Scene,
  roadItem: RoadItem,
) {
  let altitudePcdInfoList: Array<PcdInfo> = [];

  const keyPoints = [...roadItem.referenceLine.catmullPoints];

  this.emitEvent(FetchAltitudeSurroundingNodePcdInfoEvent, {
    keyPoints,
    callback: (altitudeSurroundingNodePcdInfo: PcdInfo[]) => {
      altitudePcdInfoList = altitudeSurroundingNodePcdInfo;
    },
  });

  const nodeMeshes = await Promise.all(altitudePcdInfoList.map((pcdInfo: PcdInfo) => {
    return this.drawAltitudeSurroundingNodeMesh(contextScene, pcdInfo);
  }));

  return nodeMeshes;
};

export async function drawRoadLaneAltitudePointCloud(
  this: ExtendedNamespace,
  contextScene: Scene,
  laneLineItem: LaneLineItem,
) {
  let altitudePcdInfoList: Array<PcdInfo> = [];

  const keyPoints = [...laneLineItem.catmullPoints];

  this.emitEvent(FetchAltitudeSurroundingNodePcdInfoEvent, {
    keyPoints,
    callback: (altitudeSurroundingNodePcdInfo: PcdInfo[]) => {
      altitudePcdInfoList = altitudeSurroundingNodePcdInfo;
    },
  });

  const nodeMeshes = await Promise.all(altitudePcdInfoList.map((pcdInfo: PcdInfo) => {
    return this.drawAltitudeSurroundingNodeMesh(contextScene, pcdInfo);
  }));

  return nodeMeshes;
};

export function createAltitudeMarker(
  this: ExtendedNamespace,
  contextScene: Scene,
  pos: Vector3,
  color: Color3,
  id?: string,
) {
  const markerId = id || 'RawMarker';
  const marker = MeshBuilder.CreateSphere(markerId, {
    diameter: RendererConfig.altitude.markerDiameter,
  }, contextScene);

  marker.position.x = pos.x;
  marker.position.y = pos.y;
  marker.position.z = pos.z;

  const mat = new StandardMaterial('mat', contextScene);
  mat.diffuseColor = color;

  marker.material = mat;
  marker.renderingGroupId = RendererConfig.renderOrder.MEDIUM;

  return marker;
};

export function resolveMousePickingReferenceLineItemAltitudeInfo(
  this: ExtendedNamespace,
  contextScene: Scene,
  pointerInfo: PointerInfo,
) {
  if (!pointerInfo?.pickInfo || !pointerInfo?.pickInfo?.ray) return null;

  const pickInfo = pointerInfo.pickInfo as PickingInfo;
  const mouseRay = (pointerInfo.pickInfo as PickingInfo).ray as Ray;
  const pickingRay = new Ray(mouseRay.origin, mouseRay.direction, 1000);

  const picked = contextScene.pickWithRay(pickingRay, (mesh: AbstractMesh) => {
    return mesh.id.includes('ReferenceLine');
  });

  if (!picked || !picked.pickedMesh) return null;

  const pickedMesh = picked.pickedMesh;
  const pickedPoint = picked.pickedPoint;

  const altitudeRoadItem = pickedMesh?.metadata?.altitudeRoadItem;
  const altitudeLineItem = pickedMesh?.metadata?.altitudeLineItem;
  
  return {
    pickedPoint,
    altitudeRoadItem,
    altitudeLineItem,
  };
};

export function resolveMousePickingLaneLineItemAltitudeInfo(
  this: ExtendedNamespace,
  contextScene: Scene,
  pointerInfo: PointerInfo,
) {
  if (!pointerInfo?.pickInfo || !pointerInfo?.pickInfo?.ray) return null;

  const pickInfo = pointerInfo.pickInfo as PickingInfo;
  const mouseRay = (pointerInfo.pickInfo as PickingInfo).ray as Ray;
  const pickingRay = new Ray(mouseRay.origin, mouseRay.direction, 1000);

  const picked = contextScene.pickWithRay(pickingRay, (mesh: AbstractMesh) => {
    return mesh.id.includes('Inner_Line') || mesh.id.includes('Outer_Line');
  });

  if (!picked || !picked.pickedMesh) return null;

  const pickedMesh = picked.pickedMesh;
  const pickedPoint = picked.pickedPoint;

  const altitudeRoadItem = pickedMesh?.metadata?.altitudeRoadItem;
  const altitudeLaneItem = pickedMesh?.metadata?.altitudeLaneItem;
  const altitudeLineItem = pickedMesh?.metadata?.altitudeLineItem;
  
  return {
    pickedPoint,
    altitudeRoadItem,
    altitudeLaneItem,
    altitudeLineItem,
  };
};

export function syncRoadAltitudeAxis(
  this: ExtendedNamespace,
  contextScene: Scene,
) {
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  const transformationMatrix = activeCamera.getTransformationMatrix();
  const invertTransformationMatrix = new Matrix();
  transformationMatrix.invertToRef(invertTransformationMatrix);

  const standardDepth = Vector3.TransformCoordinates(new Vector3(0, 0, 0), transformationMatrix).z;

  const altitudeProjectionTop = new Vector3(0, RendererConfig.altitude.axisProjectionAltitudeRange, standardDepth);
  const altitudeProjectionBottom = new Vector3(0, -RendererConfig.altitude.axisProjectionAltitudeRange, standardDepth);
  const altitudeProjectionLeft = new Vector3(-RendererConfig.altitude.axisProjectionAltitudeRange, 0, standardDepth);
  const altitudeProjectionRight = new Vector3(RendererConfig.altitude.axisProjectionAltitudeRange, 0, standardDepth);

  const altitudeTopPoint = Vector3.TransformCoordinates(altitudeProjectionTop, invertTransformationMatrix);
  const altitudeBottomPoint = Vector3.TransformCoordinates(altitudeProjectionBottom, invertTransformationMatrix);
  const altitudeLeftPoint = Vector3.TransformCoordinates(altitudeProjectionLeft, invertTransformationMatrix);
  const altitudeRightPoint = Vector3.TransformCoordinates(altitudeProjectionRight, invertTransformationMatrix);

  const upperAltitude = altitudeTopPoint.z;
  const lowerAltitude = altitudeBottomPoint.z;

  const leftDistance = altitudeLeftPoint.x;
  const rightDistance = altitudeRightPoint.x;

  this.emitEvent(UpdateRoadAltitudeAxisEvent, {
    upperAltitude,
    lowerAltitude,
    leftDistance,
    rightDistance,
  });
};

export function syncRoadConnectionAltitudeAxis(
  this: ExtendedNamespace,
  contextScene: Scene,
) {
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  const transformationMatrix = activeCamera.getTransformationMatrix();
  const invertTransformationMatrix = new Matrix();
  transformationMatrix.invertToRef(invertTransformationMatrix);

  const standardDepth = Vector3.TransformCoordinates(new Vector3(0, 0, 0), transformationMatrix).z;

  const altitudeProjectionTop = new Vector3(0, RendererConfig.altitude.axisProjectionAltitudeRange, standardDepth);
  const altitudeProjectionBottom = new Vector3(0, -RendererConfig.altitude.axisProjectionAltitudeRange, standardDepth);
  const altitudeProjectionLeft = new Vector3(-RendererConfig.altitude.axisProjectionAltitudeRange, 0, standardDepth);
  const altitudeProjectionRight = new Vector3(RendererConfig.altitude.axisProjectionAltitudeRange, 0, standardDepth);

  const altitudeTopPoint = Vector3.TransformCoordinates(altitudeProjectionTop, invertTransformationMatrix);
  const altitudeBottomPoint = Vector3.TransformCoordinates(altitudeProjectionBottom, invertTransformationMatrix);
  const altitudeLeftPoint = Vector3.TransformCoordinates(altitudeProjectionLeft, invertTransformationMatrix);
  const altitudeRightPoint = Vector3.TransformCoordinates(altitudeProjectionRight, invertTransformationMatrix);

  const upperAltitude = altitudeTopPoint.z;
  const lowerAltitude = altitudeBottomPoint.z;

  const leftDistance = altitudeLeftPoint.x;
  const rightDistance = altitudeRightPoint.x;

  this.emitEvent(UpdateRoadConnectionAltitudeAxisEvent, {
    upperAltitude,
    lowerAltitude,
    leftDistance,
    rightDistance,
  });
};

export function syncRoadLaneAltitudeAxis(
  this: ExtendedNamespace,
  contextScene: Scene,
) {
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  const transformationMatrix = activeCamera.getTransformationMatrix();
  const invertTransformationMatrix = new Matrix();
  transformationMatrix.invertToRef(invertTransformationMatrix);

  const standardDepth = Vector3.TransformCoordinates(new Vector3(0, 0, 0), transformationMatrix).z;

  const altitudeProjectionTop = new Vector3(0, RendererConfig.altitude.axisProjectionAltitudeRange, standardDepth);
  const altitudeProjectionBottom = new Vector3(0, -RendererConfig.altitude.axisProjectionAltitudeRange, standardDepth);
  const altitudeProjectionLeft = new Vector3(-RendererConfig.altitude.axisProjectionAltitudeRange, 0, standardDepth);
  const altitudeProjectionRight = new Vector3(RendererConfig.altitude.axisProjectionAltitudeRange, 0, standardDepth);

  const altitudeTopPoint = Vector3.TransformCoordinates(altitudeProjectionTop, invertTransformationMatrix);
  const altitudeBottomPoint = Vector3.TransformCoordinates(altitudeProjectionBottom, invertTransformationMatrix);
  const altitudeLeftPoint = Vector3.TransformCoordinates(altitudeProjectionLeft, invertTransformationMatrix);
  const altitudeRightPoint = Vector3.TransformCoordinates(altitudeProjectionRight, invertTransformationMatrix);

  const upperAltitude = altitudeTopPoint.z;
  const lowerAltitude = altitudeBottomPoint.z;

  const leftDistance = altitudeLeftPoint.x;
  const rightDistance = altitudeRightPoint.x;

  this.emitEvent(UpdateRoadLaneAltitudeAxisEvent, {
    upperAltitude,
    lowerAltitude,
    leftDistance,
    rightDistance,
  });
};