import {
  Mesh,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  LinesMesh,
  Color4,
  Path3D,
} from "@babylonjs/core";
import {
  AtlasLaneBoundaryType,
} from '../../atlasConverter/type';
import earcut from "earcut";
import BSON from "bson-objectid";
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
  JunctionItem,
  JunctionEdgeItem,
  SignalItem,
} from '../../statusManager/type';
import {
  PointAlignItem,
  PointAlignItemKeyInfo
} from '../../pointAlignDrawer/type';
import {
  RoadCollectionData,
  JunctionCollectionData,
  SignalCollectionData,
} from '../../atlasConverter/type';
import {
  FetchAllRoadsEvent,
  FetchAllJunctionsEvent,
  FetchAllSignalsEvent,
} from '../../statusManager/constant';
import { ResolveRoadByIdAndCategoryEvent } from '../../../plugins/statusManager/constant';
import { FetchGlobalRoadMatAlphaEvent } from '../../../../business/plugins/preProcessor/constant';

export function generatePersistenceID(this: ExtendedNamespace) {
  return BSON(Math.floor(new Date().getTime() % Math.pow(10, 10))).toHexString();
};

export function resolveNextCandidateEntityId(this: ExtendedNamespace) {
  let maxEntityId = '-1';

  // road
  let rawRoadCollectionData = {} as RoadCollectionData;

  this.emitEvent(FetchAllRoadsEvent, {
    callback: (roadCollectionData: RoadCollectionData) => {
      rawRoadCollectionData = roadCollectionData;
    }
  });

  rawRoadCollectionData.catmullSerieRoadCollection.forEach((roadItem: RoadItem) => {
    const isNumberId = /^[0-9]+$/.test(roadItem.roadId);

    if (isNumberId && (Number(maxEntityId) < Number(roadItem.roadId))) {
      maxEntityId = roadItem.roadId;
    }
  });

  rawRoadCollectionData.connectionRoadCollection.forEach((roadItem: RoadItem) => {
    const isNumberId = /^[0-9]+$/.test(roadItem.roadId);

    if (isNumberId && (Number(maxEntityId) < Number(roadItem.roadId))) {
      maxEntityId = roadItem.roadId;
    }
  });

  // junction
  let rawJunctionCollectionData = {} as JunctionCollectionData;

  this.emitEvent(FetchAllJunctionsEvent, {
    callback: (junctionCollectionData: JunctionCollectionData) => {
      rawJunctionCollectionData = junctionCollectionData;
    }
  });

  rawJunctionCollectionData.junctionCollection.forEach((junctionItem: JunctionItem) => {
    const isNumberId = /^[0-9]+$/.test(junctionItem.junctionId);

    if (isNumberId && (Number(maxEntityId) < Number(junctionItem.junctionId))) {
      maxEntityId = junctionItem.junctionId;
    }
  });

  // signal
  let rawSignalCollectionData = {} as SignalCollectionData;

  this.emitEvent(FetchAllSignalsEvent, {
    callback: (signalCollectionData: SignalCollectionData) => {
      rawSignalCollectionData = signalCollectionData;
    }
  });

  rawSignalCollectionData.signalCollection.forEach((signalItem: SignalItem) => {
    const isNumberId = /^[0-9]+$/.test(signalItem.signalId);

    if (isNumberId && (Number(maxEntityId) < Number(signalItem.signalId))) {
      maxEntityId = signalItem.signalId;
    }
  });

  return `${Number(maxEntityId) + 1}`;
};

export function resolveGlobalRoadMatAlpha(this: ExtendedNamespace) {
  let raw: number | undefined = undefined;

  this.emitEvent(FetchGlobalRoadMatAlphaEvent, {
    callback: (matAlpha: number | undefined) => {
      raw = matAlpha;
    }
  });

  return raw === undefined ? 1 : raw;
};

export function createGroundLine(this: ExtendedNamespace, opts: {
  points: Vector3[],
  color: Color4,
  id: string,
}) {
  const options = {
    points: opts.points,
    colors: new Array(opts.points.length).fill(opts.color),
    updatable: true,
  };

  let line = MeshBuilder.CreateLines(opts.id, options, this.getSceneManager().getContextScene());
  line = MeshBuilder.CreateLines(opts.id, { points: options.points, colors: options.colors, instance: line });
  line.position.y = -RendererConfig.scene.groundSink;

  return line as LinesMesh;
};

export function createDummyGround(this: ExtendedNamespace) {
  const depth = RendererConfig.scene.groundDepth;
  const width = RendererConfig.scene.groundWidth;
  const cellSize = RendererConfig.scene.groundCellSize;

  const dCells = depth / cellSize;
  const wCells = width / cellSize;

  const lineColor = RendererConfig.scene.groundLineColor;
  const lineId = `ground_cell_line`;

  this.createGroundLine({
    points: [new Vector3(-width / 2, 0, 0), new Vector3(width / 2, 0, 0)],
    color: lineColor,
    id: lineId,
  });

  this.createGroundLine({
    points: [new Vector3(0, 0, -depth / 2), new Vector3(0, 0, depth / 2)],
    color: lineColor,
    id: lineId,
  });

  for (let i = 0; i < wCells / 2; i++) {
    const v = (i + 1) * cellSize;

    this.createGroundLine({
      points: [new Vector3(-v, 0, -depth / 2), new Vector3(-v, 0, depth / 2)],
      color: lineColor,
      id: lineId,
    });

    this.createGroundLine({
      points: [new Vector3(v, 0, -depth / 2), new Vector3(v, 0, depth / 2)],
      color: lineColor,
      id: lineId,
    });
  }

  for (let j = 0; j < dCells / 2; j++) {
    const v = (j + 1) * cellSize;

    this.createGroundLine({
      points: [new Vector3(-width / 2, 0, -v), new Vector3(width / 2, 0, -v)],
      color: lineColor,
      id: lineId,
    });

    this.createGroundLine({
      points: [new Vector3(-width / 2, 0, v), new Vector3(width / 2, 0, v)],
      color: lineColor,
      id: lineId,
    });
  }
};

export function createXZPlane(this: ExtendedNamespace, opts: {
  id: string,
  yOffset: number,
  width: number,
  depth: number,
  matColor: Color3,
  matAlpha: number,
}) {
  const options = {
    height: RendererConfig.scene.xzPlaneThickness,
    width: opts.width,
    depth: opts.depth,
  };

  let xzPlane = MeshBuilder.CreateBox(opts.id, options, this.getSceneManager().getContextScene());
  xzPlane.position.y = opts.yOffset;

  const mat = new StandardMaterial('mat', this.getSceneManager().getContextScene());
  mat.diffuseColor = opts.matColor;
  mat.alpha = opts.matAlpha;
  xzPlane.material = mat;

  return xzPlane;
};

export function createColorMaterial(this: ExtendedNamespace, color: Color3) {
  const mat = new StandardMaterial('mat', this.getSceneManager().getContextScene());
  mat.diffuseColor = color;

  return mat;
};

export function createMarker(
  this: ExtendedNamespace,
  pos: Vector3,
  color: Color3,
  id: string = 'RawMarker',
  markerDiameter: number = RendererConfig.scene.markerDiameter
) {
  const markerId = id;
  const marker = MeshBuilder.CreateSphere(markerId, {
    diameter: markerDiameter,
  }, this.getSceneManager().getContextScene());

  marker.position.x = pos.x;
  marker.position.y = pos.y;
  marker.position.z = pos.z;

  marker.material = this.createColorMaterial(color);
  marker.renderingGroupId = RendererConfig.renderOrder.MEDIUM;

  return marker;
};

export function isValidActionMeshMovement(this: ExtendedNamespace, newPoint: Vector3, oldPoint: Vector3) {
  const distance = newPoint.subtract(oldPoint).length();

  return distance > RendererConfig.scene.minimumActionMeshMovement;
};

export function createPureRefererenceLine(this: ExtendedNamespace, opts: {
  points: Vector3[],
  id: string,
}) {
  const options = {
    points: opts.points,
    colors: opts.points.map((_: Vector3) => {
      return new Color4(0, 0, 0, 0);
    }),
    updatable: true,
  };

  let line = MeshBuilder.CreateLines(opts.id, options, this.getSceneManager().getContextScene());

  line = MeshBuilder.CreateLines(opts.id, { points: opts.points, instance: line });
  line.renderingGroupId = RendererConfig.renderOrder.MEDIUM;

  return line as LinesMesh;
};

export function createSolidLine(this: ExtendedNamespace, opts: {
  points: Vector3[],
  color: Color3,
  id: string,
}) {
  const options = {
    points: opts.points,
    updatable: true,
  };

  let line = MeshBuilder.CreateLines(opts.id, options, this.getSceneManager().getContextScene());
  line.color = opts.color;

  line = MeshBuilder.CreateLines(opts.id, { points: opts.points, instance: line });
  line.renderingGroupId = RendererConfig.renderOrder.MEDIUM;

  return line as LinesMesh;
};

export function createDashedLine(this: ExtendedNamespace, opts: {
  points: Vector3[],
  color: Color3,
  id: string,
}) {
  const linePath = new Path3D(opts.points);
  const lineLength = linePath.getDistanceAt(1);

  const color = opts.color;

  const oneCellLength = 5;
  const cellNum = Math.round(lineLength / oneCellLength);
  const solidDistanceInCellEnd = oneCellLength / 3;

  const subPointsNumInSolidOrDashed = 10;
  
  const pointsArray = [];
  
  for (let i = 0; i < cellNum; i++) {
    const solidArray = [];
    const dashedArray = [];

    const startDistance = i * oneCellLength;
    const endDistance = (i + 1) * oneCellLength;

    const solidStartDistance = endDistance - solidDistanceInCellEnd;
    
    // dashed
    for (let n = 0; n < subPointsNumInSolidOrDashed; n++) {
      dashedArray.push(startDistance + n * (solidStartDistance - startDistance) / subPointsNumInSolidOrDashed);
    }
    dashedArray.push(solidStartDistance);

    pointsArray.push({ pointsDistances: dashedArray, opacity: 0 });
    
    // solid
    for (let n = 0; n < subPointsNumInSolidOrDashed; n++) {
      solidArray.push(solidStartDistance + n * (endDistance - solidStartDistance) / subPointsNumInSolidOrDashed);
    }
    solidArray.push(endDistance);

    pointsArray.push({ pointsDistances: solidArray, opacity: 1 });
  }


  const virtualPoints = [];
  const virtualPointsColors = [];
  
  for (let n = 0; n < pointsArray.length; n++) {
    const pointsDistances = pointsArray[n].pointsDistances;
    
    for (let k = 0; k < pointsDistances.length; k++) {
      const pointDistance = pointsDistances[k] / lineLength;
      const virtualPoint = linePath.getPointAt(pointDistance);

      virtualPoints.push(virtualPoint);
      virtualPointsColors.push(new Color4(color.r, color.g, color.b, pointsArray[n].opacity));
    }
  }

  const options = {
    points: virtualPoints,
    updatable: true,
    colors: virtualPointsColors
  };

  let line = MeshBuilder.CreateLines(opts.id, options, this.getSceneManager().getContextScene());

  line = MeshBuilder.CreateLines(opts.id, { points: virtualPoints, instance: line });
  line.renderingGroupId = RendererConfig.renderOrder.MEDIUM;

  return { drawingPoints: [...virtualPoints], line: line as LinesMesh };
};

export function drawLaneLineMesh(
  this: ExtendedNamespace,
  opts: {
    points: Vector3[];
    color: Color3;
    id: string;
    atlasLaneBoundaryType: AtlasLaneBoundaryType.Type;
    laneLineSide: LaneLineSide;
    laneSide: LaneSide;
  },
) {
  const newOpts = {
    points: opts.points,
    color: opts.color,
    id: opts.id,
  };

  const atlasLaneBoundaryType = opts.atlasLaneBoundaryType;
  const laneLineSide = opts.laneLineSide;
  const laneSide = opts.laneSide;

  if (laneLineSide === LaneLineSide.ConnectorEnd || laneLineSide === LaneLineSide.ConnectorStart) {
    return {
      drawingPoints: opts.points,
      line: [this.createSolidLine(newOpts)],
    };
  }

  if (atlasLaneBoundaryType === AtlasLaneBoundaryType.Type.UNKNOWN) {
    newOpts.color = RendererConfig.boundary.laneLineColor.unknown;

    return {
      drawingPoints: opts.points,
      line: [this.createSolidLine(newOpts)],
    };
  } else if (atlasLaneBoundaryType === AtlasLaneBoundaryType.Type.DOTTED_YELLOW) {
    if (laneSide === LaneSide.Left) {
      newOpts.color = RendererConfig.boundary.laneLineColor.dottedYellow;
      newOpts.points = [...newOpts.points].reverse();
      const dashLine = this.createDashedLine(newOpts);

      return {
        drawingPoints: [...dashLine.drawingPoints].reverse(),
        line: [dashLine.line],
      };
    } else if (laneSide === LaneSide.Right) {
      newOpts.color = RendererConfig.boundary.laneLineColor.dottedYellow;
      const dashLine = this.createDashedLine(newOpts);

      return {
        drawingPoints: dashLine.drawingPoints,
        line: [dashLine.line],
      };
    }
  } else if (atlasLaneBoundaryType === AtlasLaneBoundaryType.Type.DOTTED_WHITE) {
    if (laneSide === LaneSide.Left) {
      newOpts.color = RendererConfig.boundary.laneLineColor.dottedWhite;
      newOpts.points = [...newOpts.points].reverse();
      const dashLine = this.createDashedLine(newOpts);

      return {
        drawingPoints: dashLine.drawingPoints,
        line: [dashLine.line],
      };
    } else if (laneSide === LaneSide.Right) {
      newOpts.color = RendererConfig.boundary.laneLineColor.dottedWhite;
      const dashLine = this.createDashedLine(newOpts);

      return {
        drawingPoints: dashLine.drawingPoints,
        line: [dashLine.line],
      };
    }
  } else if (atlasLaneBoundaryType === AtlasLaneBoundaryType.Type.SOLID_YELLOW) {
    newOpts.color = RendererConfig.boundary.laneLineColor.solidYellow;

    return {
      drawingPoints: opts.points,
      line: [this.createSolidLine(newOpts)],
    };
  } else if (atlasLaneBoundaryType === AtlasLaneBoundaryType.Type.SOLID_WHITE) {
    newOpts.color = RendererConfig.boundary.laneLineColor.solidWhite;

    return {
      drawingPoints: opts.points,
      line: [this.createSolidLine(newOpts)],
    };
  } else if (atlasLaneBoundaryType === AtlasLaneBoundaryType.Type.DOUBLE_YELLOW) {
    const doubleYellow = this.createSolidLineDoubleYellowLine(newOpts);

    return {
      drawingPoints: doubleYellow.points,
      line: doubleYellow.line,
    };
  } else if (atlasLaneBoundaryType === AtlasLaneBoundaryType.Type.CURB) {
    newOpts.color = RendererConfig.boundary.laneLineColor.curb;

    return {
      drawingPoints: opts.points,
      line: [this.createSolidLine(newOpts)],
    };
  }
}

export function createSolidLineDoubleYellowLine(
  this: ExtendedNamespace,
  opts: {
    points: Vector3[],
    color: Color3,
    id: string,
  },
) {
  const newPoints = this.calculateNormalsAndTangentsOfCurveSeriePoints(opts.points)
  const serieNormals = newPoints.serieNormals;

  const candidatePointsRightInner = opts.points.map((v: Vector3, idx: number) => {
    return v.add(serieNormals[idx].multiplyByFloats(RendererConfig.boundary.doubleYellow.inner, RendererConfig.boundary.doubleYellow.inner, RendererConfig.boundary.doubleYellow.inner));
  });

  const candidatePointsRightOuter = opts.points.map((v: Vector3, idx: number) => {
    return v.add(serieNormals[idx].multiplyByFloats(RendererConfig.boundary.doubleYellow.outer, RendererConfig.boundary.doubleYellow.outer, RendererConfig.boundary.doubleYellow.outer));
  });

  const optionsInner = {
    points: candidatePointsRightInner,
    updatable: true,
  };

  let lineInner = MeshBuilder.CreateLines(opts.id, optionsInner, this.getSceneManager().getContextScene());
  lineInner.color = RendererConfig.boundary.laneLineColor.doubleYellow;

  lineInner = MeshBuilder.CreateLines(opts.id, { points: candidatePointsRightInner, instance: lineInner });
  lineInner.renderingGroupId = RendererConfig.renderOrder.MEDIUM;

  const optionsOuter = {
    points: candidatePointsRightOuter,
    updatable: true,
  };

  let lineOuter = MeshBuilder.CreateLines(opts.id, optionsOuter, this.getSceneManager().getContextScene());
  lineOuter.color = RendererConfig.boundary.laneLineColor.doubleYellow;

  lineOuter = MeshBuilder.CreateLines(opts.id, { points: candidatePointsRightOuter, instance: lineOuter });
  lineOuter.renderingGroupId = RendererConfig.renderOrder.MEDIUM;

  return {
    drawingPoints: candidatePointsRightInner,
    line: [lineInner as LinesMesh, lineOuter as LinesMesh],
  }
}

export function createLaneDirectionSign(this: ExtendedNamespace, opts: {
  id: string,
  innerPoints: Vector3[],
  outerPoints: Vector3[],
}) {
  const innerPoints = [...opts.innerPoints];
  const outerPoints = [...opts.outerPoints];

  const serieLength = opts.innerPoints.length;
  const innerSerieDistance = new Path3D(innerPoints).getDistanceAt(1);
  const outerSerieDistance = new Path3D(outerPoints).getDistanceAt(1);
  const laneDirectionSignNum = Math.ceil((innerSerieDistance + outerSerieDistance) / (2 * RendererConfig.mesh.roadDirectionSignSplitLength));

  const directionSigns = [] as Mesh[];

  for (let i = 1; i < laneDirectionSignNum + 1; i++) {
    const halfIdx = Math.floor(i / (laneDirectionSignNum + 1) * serieLength);

    const forwardIndex = halfIdx + 5;

    const innerCenter = innerPoints[halfIdx];
    const outerCenter = outerPoints[halfIdx];
    const middleCenter = innerCenter.add(outerCenter).multiplyByFloats(0.5, 0.5, 0.5);
    const forwardCenter = innerPoints[forwardIndex].add(outerPoints[forwardIndex]).multiplyByFloats(0.5, 0.5, 0.5);

    const directionForward = forwardCenter.subtract(middleCenter).normalize();
    const [directionInner, directionOuter] = this.calculateVectorNormalOnXZPlane(directionForward);

    const roadDirectionSignInnerOuterRatio = RendererConfig.mesh.roadDirectionSignInnerOuterRatio;
    const roadDirectionSignForwardRatio = RendererConfig.mesh.roadDirectionSignForwardRatio;

    let pointInner = middleCenter.add(directionInner.multiplyByFloats(roadDirectionSignInnerOuterRatio, roadDirectionSignInnerOuterRatio, roadDirectionSignInnerOuterRatio));
    let pointOuter = middleCenter.add(directionOuter.multiplyByFloats(roadDirectionSignInnerOuterRatio, roadDirectionSignInnerOuterRatio, roadDirectionSignInnerOuterRatio));
    let pointForward = middleCenter.add(directionForward.multiplyByFloats(roadDirectionSignForwardRatio, roadDirectionSignForwardRatio, roadDirectionSignForwardRatio));

    const yoffset = RendererConfig.mesh.roadDirectionSignYOffset;
    pointInner.y += yoffset;
    pointOuter.y += yoffset;
    pointForward.y += yoffset;

    // make it centered
    pointInner = pointInner.add(directionForward.multiplyByFloats(roadDirectionSignForwardRatio, roadDirectionSignForwardRatio, roadDirectionSignForwardRatio).multiplyByFloats(-0.5, -0.5, -0.5));
    pointOuter = pointOuter.add(directionForward.multiplyByFloats(roadDirectionSignForwardRatio, roadDirectionSignForwardRatio, roadDirectionSignForwardRatio).multiplyByFloats(-0.5, -0.5, -0.5));
    pointForward = pointForward.add(directionForward.multiplyByFloats(roadDirectionSignForwardRatio, roadDirectionSignForwardRatio, roadDirectionSignForwardRatio).multiplyByFloats(-0.5, -0.5, -0.5));

    const options = {
      pathArray: [[pointInner, pointForward], [pointOuter, pointForward]],
      closeArray: false,
      sideOrientation: Mesh.DOUBLESIDE,
    };

    const directionSign = MeshBuilder.CreateRibbon(opts.id, options, this.getSceneManager().getContextScene());

    const mat = new StandardMaterial('mat', this.getSceneManager().getContextScene());
    mat.diffuseColor = RendererConfig.mesh.roadDirectionSignColor;

    directionSign.material = mat;
    directionSign.renderingGroupId = RendererConfig.renderOrder.MEDIUM;

    directionSigns.push(directionSign);
  }

  return directionSigns;
};

export function createRibbonLane(this: ExtendedNamespace, opts: {
  id: string,
  innerPoints: Vector3[],
  outerPoints: Vector3[],
}) {
  const globalMatAlpha = this.resolveGlobalRoadMatAlpha();

  const mat = new StandardMaterial('mat', this.getSceneManager().getContextScene());
  mat.diffuseColor = RendererConfig.mesh.roadColor;
  mat.alpha = globalMatAlpha;

  const sinkedInnerPoints = [...opts.innerPoints].map((p: Vector3) => {
    return new Vector3(p.x, p.y + RendererConfig.mesh.roadLaneSinkOffset, p.z);
  });

  const sinkedOuterPoints = [...opts.outerPoints].map((p: Vector3) => {
    return new Vector3(p.x, p.y + RendererConfig.mesh.roadLaneSinkOffset, p.z);
  });

  const options = {
    pathArray: [[...sinkedInnerPoints], [...sinkedOuterPoints]],
    closeArray: false,
    sideOrientation: Mesh.DOUBLESIDE,
  };

  const laneMesh = MeshBuilder.CreateRibbon(opts.id, options, this.getSceneManager().getContextScene());
  laneMesh.material = mat;
  laneMesh.renderingGroupId = RendererConfig.renderOrder.LOW;

  return laneMesh as Mesh;
};

export function createExtrusionJunctionShape(this: ExtendedNamespace, opts: {
  id: string,
  pathSeries: Vector3[],
}) {
  const mat = new StandardMaterial('mat', this.getSceneManager().getContextScene());
  mat.diffuseColor = RendererConfig.mesh.roadColor;
  mat.alpha = 0;

  const heights = opts.pathSeries.map((v: Vector3) => {
    return v.y;
  });
  const height = Math.min(...heights) - 0.1;

  const options = {
    shape: [...opts.pathSeries],
    depth: 0.1,
    sideOrientation: Mesh.DOUBLESIDE,
  };

  const junctionShape = MeshBuilder.ExtrudePolygon(opts.id, options, this.getSceneManager().getContextScene(), earcut);
  junctionShape.material = mat;

  junctionShape.position.y = height;

  return junctionShape as Mesh;
};

export function alterAllRoadsAndJunctionsMatAlphaAction(this: ExtendedNamespace, matAlpha: number) {
  // road
  let rawRoadCollectionData = {} as RoadCollectionData;

  this.emitEvent(FetchAllRoadsEvent, {
    callback: (roadCollectionData: RoadCollectionData) => {
      rawRoadCollectionData = roadCollectionData;
    }
  });

  rawRoadCollectionData.catmullSerieRoadCollection.forEach((roadItem: RoadItem) => {
    roadItem.laneItems.leftLanes.forEach((laneItem: LaneItem) => {
      (laneItem.laneMesh.material as StandardMaterial).alpha = matAlpha;
    });

    roadItem.laneItems.rightLanes.forEach((laneItem: LaneItem) => {
      (laneItem.laneMesh.material as StandardMaterial).alpha = matAlpha;
    });
  });

  rawRoadCollectionData.connectionRoadCollection.forEach((roadItem: RoadItem) => {
    roadItem.laneItems.leftLanes.forEach((laneItem: LaneItem) => {
      (laneItem.laneMesh.material as StandardMaterial).alpha = matAlpha;
    });

    roadItem.laneItems.rightLanes.forEach((laneItem: LaneItem) => {
      (laneItem.laneMesh.material as StandardMaterial).alpha = matAlpha;
    });
  });

  // junction
  let rawJunctionCollectionData = {} as JunctionCollectionData;

  this.emitEvent(FetchAllJunctionsEvent, {
    callback: (junctionCollectionData: JunctionCollectionData) => {
      rawJunctionCollectionData = junctionCollectionData;
    }
  });

  rawJunctionCollectionData.junctionCollection.forEach((junctionItem: JunctionItem) => {
    // always transparent mesh
    (junctionItem.junctionMesh.material as StandardMaterial).alpha = 0;
  });

  this.makeSceneDirty();
};

export function unhighlightAllRoadsAndJunctions(this: ExtendedNamespace) {
  // road
  let rawRoadCollectionData = {} as RoadCollectionData;

  this.emitEvent(FetchAllRoadsEvent, {
    callback: (roadCollectionData: RoadCollectionData) => {
      rawRoadCollectionData = roadCollectionData;
    }
  });

  rawRoadCollectionData.catmullSerieRoadCollection.forEach((roadItem: RoadItem) => {
    roadItem.laneItems.leftLanes.forEach((laneItem: LaneItem) => {
      (laneItem.laneMesh.material as StandardMaterial).diffuseColor = RendererConfig.mesh.roadColor;
      laneItem.laneMesh.renderingGroupId = RendererConfig.renderOrder.LOW;
    });

    roadItem.laneItems.rightLanes.forEach((laneItem: LaneItem) => {
      (laneItem.laneMesh.material as StandardMaterial).diffuseColor = RendererConfig.mesh.roadColor;
      laneItem.laneMesh.renderingGroupId = RendererConfig.renderOrder.LOW;
    });
  });

  rawRoadCollectionData.connectionRoadCollection.forEach((roadItem: RoadItem) => {
    roadItem.laneItems.leftLanes.forEach((laneItem: LaneItem) => {
      (laneItem.laneMesh.material as StandardMaterial).diffuseColor = RendererConfig.mesh.roadColor;
      laneItem.laneMesh.renderingGroupId = RendererConfig.renderOrder.LOW;
    });

    roadItem.laneItems.rightLanes.forEach((laneItem: LaneItem) => {
      (laneItem.laneMesh.material as StandardMaterial).diffuseColor = RendererConfig.mesh.roadColor;
      laneItem.laneMesh.renderingGroupId = RendererConfig.renderOrder.LOW;
    });
  });

  // junction
  let rawJunctionCollectionData = {} as JunctionCollectionData;

  this.emitEvent(FetchAllJunctionsEvent, {
    callback: (junctionCollectionData: JunctionCollectionData) => {
      rawJunctionCollectionData = junctionCollectionData;
    }
  });

  rawJunctionCollectionData.junctionCollection.forEach((junctionItem: JunctionItem) => {
    junctionItem.edges.forEach((edge: JunctionEdgeItem) => {
      (edge.edgeMesh as LinesMesh).color = RendererConfig.junction.solidLineColor;
    });
  });

  this.makeSceneDirty();
};

export function highlightSingleRoad(
  this: ExtendedNamespace,
  roadId: string,
  roadCategory: RoadCategory,
) {
  const roadItem = this.resolveRoadByRoadIdAndRoadCategory(roadId, roadCategory);
  if (!roadItem) return;

  roadItem.laneItems.leftLanes.forEach((laneItem: LaneItem) => {
    (laneItem.laneMesh.material as StandardMaterial).diffuseColor = RendererConfig.mesh.highlightRoadColor;
    laneItem.laneMesh.renderingGroupId = RendererConfig.renderOrder.MEDIUM_LOW;
  });

  roadItem.laneItems.rightLanes.forEach((laneItem: LaneItem) => {
    (laneItem.laneMesh.material as StandardMaterial).diffuseColor = RendererConfig.mesh.highlightRoadColor;
    laneItem.laneMesh.renderingGroupId = RendererConfig.renderOrder.MEDIUM_LOW;
  });

  this.makeSceneDirty();
};

export function highlightSingleLane(
  this: ExtendedNamespace,
  laneId: string,
  roadId: string,
  roadCategory: RoadCategory,
) {
  const laneItem = this.resolveLaneByLaneRoadIdAndRoadCategory(laneId, roadId, roadCategory);
  if (!laneItem) return;

  (laneItem.laneMesh.material as StandardMaterial).diffuseColor = RendererConfig.mesh.highlightRoadColor;
  laneItem.laneMesh.renderingGroupId = RendererConfig.renderOrder.MEDIUM_LOW;

  this.makeSceneDirty();
};

export function highlightSingleJunction(
  this: ExtendedNamespace,
  junctionId: string,
) {
  const junctionItem = this.resolveJunctionByJunctionId(junctionId);
  if (!junctionItem) return;

  junctionItem.edges.forEach((edge: JunctionEdgeItem) => {
    (edge.edgeMesh as LinesMesh).color = RendererConfig.junction.highlightSolidLineColor;
  });

  this.makeSceneDirty();
};

export function resolveReferenceLineItemKeyInfo(this: ExtendedNamespace, referenceLineItem: ReferenceLineItem) {
  return {
    points: [...referenceLineItem.points],
    seriePoints: [...referenceLineItem.seriePoints],
    serieNormals: [...referenceLineItem.serieNormals],
    serieTangents: [...referenceLineItem.serieTangents],
    category: referenceLineItem.category,
    options: { ...referenceLineItem.options },
    catmullPoints: [...referenceLineItem.catmullPoints],
    catmullTangents: [...referenceLineItem.catmullTangents],
    altitudeCatmullPoints: [...referenceLineItem.altitudeCatmullPoints],
    altitudeCatmullTangents: [...referenceLineItem.altitudeCatmullTangents],
  } as ReferenceLineItemKeyInfo;
};

export function resolveLineAndCurveItemKeyInfo(this: ExtendedNamespace, lineAndCurveItem: LineAndCurveItem) {
  return {
    seriePoints: [...lineAndCurveItem.seriePoints],
    category: lineAndCurveItem.category,
    options: { ...lineAndCurveItem.options },
  } as LineAndCurveItemKeyInfo;
};

export function resolveLaneLineItemKeyInfo(this: ExtendedNamespace, laneLineItem: LaneLineItem) {
  return {
    seriePoints: [...laneLineItem.seriePoints],
    category: laneLineItem.category,
    options: { ...laneLineItem.options },
    laneLineSide: laneLineItem.laneLineSide,
    catmullPoints: [...laneLineItem.catmullPoints],
    catmullTangents: [...laneLineItem.catmullTangents],
    altitudeCatmullPoints: [...laneLineItem.altitudeCatmullPoints],
    altitudeCatmullTangents: [...laneLineItem.altitudeCatmullTangents],
    atlasLaneBoundaryVirtual: laneLineItem.atlasLaneBoundaryVirtual,
    atlasLaneBoundaryType: laneLineItem.atlasLaneBoundaryType,
  } as LaneLineItemKeyInfo;
};

export function resolveLaneItemKeyInfo(this: ExtendedNamespace, laneItem: LaneItem) {
  return {
    laneLines: {
      innerLaneLine: this.resolveLaneLineItemKeyInfo(laneItem.laneLines.innerLaneLine),
      outerLaneLine: this.resolveLaneLineItemKeyInfo(laneItem.laneLines.outerLaneLine),
    },
    laneConnectors: {
      laneConnectorStart: this.resolveLaneLineItemKeyInfo(laneItem.laneConnectors.laneConnectorStart),
      laneConnectorEnd: this.resolveLaneLineItemKeyInfo(laneItem.laneConnectors.laneConnectorEnd),
    },
    laneSide: laneItem.laneSide,
    laneWidthEditable: laneItem.laneWidthEditable,
    laneId: laneItem.laneId,
    atlasLaneSpeedLimit: laneItem.atlasLaneSpeedLimit,
    atlasLaneType: laneItem.atlasLaneType,
    atlasLaneTurn: laneItem.atlasLaneTurn,
    atlasLaneDirection: laneItem.atlasLaneDirection,
    prevLanes: [...laneItem.prevLanes],
    nextLanes: [...laneItem.nextLanes],
  } as LaneItemKeyInfo;
};

export function resolveRoadItemKeyInfo(this: ExtendedNamespace, roadItem: RoadItem) {
  const info = {
    referenceLineEditable: roadItem.referenceLineEditable,
    generalLeftLaneIndex: roadItem.generalLeftLaneIndex,
    generalRightLaneIndex: roadItem.generalRightLaneIndex,
    category: roadItem.category,
    roadId: roadItem.roadId,
    roadPID: roadItem.roadPID,
    position: roadItem.position,
    rotation: roadItem.rotation,
    atlasRoadType: roadItem.atlasRoadType,
    matAlpha: roadItem.matAlpha,
    prevRoads: [...roadItem.prevRoads],
    nextRoads: [...roadItem.nextRoads],
    junctionId: roadItem.junctionId,
  } as RoadItemKeyInfo;

  info.referenceLine = this.resolveReferenceLineItemKeyInfo(roadItem.referenceLine);

  info.surfaceLines = roadItem.surfaceLines.map((l: LineAndCurveItem) => {
    return this.resolveLineAndCurveItemKeyInfo(l);
  });

  info.laneItems = {
    leftLanes: roadItem.laneItems.leftLanes.map((l: LaneItem) => {
      return this.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
    }),
    rightLanes: roadItem.laneItems.rightLanes.map((l: LaneItem) => {
      return this.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
    }),
  };

  return info;
};

export function resolvePointAlignItemKeyInfo(this: ExtendedNamespace, pointAlignItem: PointAlignItem) {
  const info = {
    pointAlignId: pointAlignItem.pointAlignId,
    pointAlignPoint: pointAlignItem.pointAlignPoint,
    pointAlignlasPoint2D: pointAlignItem.pointAlignlasPoint2D,
  } as PointAlignItemKeyInfo

  return info;
}

export function resolveRoadByRoadIdAndRoadCategory(this: ExtendedNamespace, roadId: string, roadCategory: RoadCategory) {
  let rawRoadItem: RoadItem | undefined = undefined;

  this.emitEvent(ResolveRoadByIdAndCategoryEvent, {
    roadId: roadId,
    roadCategory: roadCategory,
    callback: (roadItem: RoadItem | undefined) => {
      rawRoadItem = roadItem;
    }
  });

  return rawRoadItem;
};

export function resolveCatmullPointsBySeriePoints(this: ExtendedNamespace, seriePoints: Vector3[]) {
  const num = seriePoints.length;
  const catmullStepSize = RendererConfig.mesh.catmullStepSize;
  const catmullSteps = (num - 1) / catmullStepSize;

  const catmullPoints = [];

  for (let i = 0; i < catmullSteps + 1; i++) {
    catmullPoints.push(seriePoints[i * catmullStepSize]);
  }

  return catmullPoints;
};

export function resolveLaneByLaneRoadIdAndRoadCategory(
  this: ExtendedNamespace,
  laneId: string,
  roadId: string,
  roadCategory: RoadCategory,
) {
  let rawRoadItem: RoadItem | undefined = undefined;

  this.emitEvent(ResolveRoadByIdAndCategoryEvent, {
    roadId: roadId,
    roadCategory: roadCategory,
    callback: (roadItem: RoadItem | undefined) => {
      rawRoadItem = roadItem;
    }
  });

  const laneItems = (rawRoadItem as unknown as RoadItem).laneItems.leftLanes.concat((rawRoadItem as unknown as RoadItem).laneItems.rightLanes);
  const laneItem = laneItems.filter((laneItem: LaneItem) => {
    return laneItem.laneId === laneId;
  })[0];

  return laneItem;
};