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
  JunctionEdgeItem,
  JunctionEdgeItemKeyInfo,
  JunctionItem,
  JunctionItemKeyInfo,
} from '../../statusManager/type';
import {
  ResolveJunctionByIdEvent,
  StoreDirtyJunctionEvent,
} from '../../statusManager/constant';
import {
  JunctionVertexCategory,
} from '../../junctionDrawer/type';

export function removeJunction(
  this: ExtendedNamespace,
  junctionId: string,
) {
  const opts = {
    scope: this,
    junctionId,
  };

  const transaction = this.createTransaction(TransactionType.RemoveJunction, opts);
  this.commitTransaction(transaction);
};

export function removeJunctionAction(
  this: ExtendedNamespace,
  junctionItem: JunctionItem,
) {
  junctionItem.edges.forEach((edgeItem: JunctionEdgeItem) => {
    edgeItem.edgeMesh.dispose();
  });

  junctionItem.junctionMesh.dispose();

  this.makeSceneDirty();
};

export function resolveJunctionItemKeyInfo(this: ExtendedNamespace, junctionItem: JunctionItem) {
  const info = {
    junctionId: junctionItem.junctionId,
    junctionPID: junctionItem.junctionPID,
    junctionType: junctionItem.junctionType,
  } as JunctionItemKeyInfo;

  info.allCandidateConnections = junctionItem.allCandidateConnections.map((r: {
    startRoadId: string;
    startRoadCategory: RoadCategory;
    startRoadVertexCategory: JunctionVertexCategory;
    endRoadId: string;
    endRoadCategory: RoadCategory;
    endRoadVertexCategory: JunctionVertexCategory;
  }) => {
    return {
      startRoadId: r.startRoadId,
      startRoadCategory: r.startRoadCategory,
      startRoadVertexCategory: r.startRoadVertexCategory,
      endRoadId: r.endRoadId,
      endRoadCategory: r.endRoadCategory,
      endRoadVertexCategory: r.endRoadVertexCategory,
    };
  });

  info.involvedRoads = junctionItem.involvedRoads.map((r: {
    roadId: string;
    roadCategory: RoadCategory;
    prevJunctionVertexCategory: JunctionVertexCategory;
    nextJunctionVertexCategory: JunctionVertexCategory;
  }) => {
    return {
      roadId: r.roadId,
      roadCategory: r.roadCategory,
      prevJunctionVertexCategory: r.prevJunctionVertexCategory,
      nextJunctionVertexCategory: r.nextJunctionVertexCategory,
    };
  });

  info.edges = junctionItem.edges.map((edgeItem: JunctionEdgeItem) => {
    return {
      edgeId: edgeItem.edgeId,
      seriePoints: [...edgeItem.seriePoints],
      catmullPoints: [...edgeItem.catmullPoints],
      catmullTangents: [...edgeItem.catmullTangents],
      altitudeCatmullPoints: [...edgeItem.altitudeCatmullPoints],
      altitudeCatmullTangents: [...edgeItem.altitudeCatmullTangents],
      options: { ...edgeItem.options },
    };
  });

  return info;
};

export function resolveJunctionByJunctionId(
  this: ExtendedNamespace,
  junctionId: string,
) {
  let rawJunctionItem: JunctionItem | undefined = undefined;

  this.emitEvent(ResolveJunctionByIdEvent, {
    junctionId: junctionId,
    callback: (junctionItem: JunctionItem | undefined) => {
      rawJunctionItem = junctionItem;
    }
  });

  return rawJunctionItem;
};

export function resolveEdgeJunctionByJunctionIdAndEdgeId(
  this: ExtendedNamespace,
  junctionId: string,
  edgeId: string,
) {
  let rawJunctionItem: JunctionItem | undefined = undefined;

  this.emitEvent(ResolveJunctionByIdEvent, {
    junctionId: junctionId,
    callback: (junctionItem: JunctionItem | undefined) => {
      rawJunctionItem = junctionItem;
    }
  });

  const rawJunctionEdgeItem = (rawJunctionItem as unknown as JunctionItem).edges;
  const junctionEdgeItem = rawJunctionEdgeItem.filter((junctionEdgeItem: JunctionEdgeItem) => {
    return junctionEdgeItem.edgeId === edgeId;
  })[0];

  return junctionEdgeItem;
}

export function removeRoadInInvolvedRoads(
  this: ExtendedNamespace,
  target: {
    roadId: string;
    roadCategory: RoadCategory;
    prevJunctionVertexCategory: JunctionVertexCategory;
    nextJunctionVertexCategory: JunctionVertexCategory;
  },
  collection: Array<{
    roadId: string;
    roadCategory: RoadCategory;
    prevJunctionVertexCategory: JunctionVertexCategory;
    nextJunctionVertexCategory: JunctionVertexCategory;
  }>,
) {
  return collection.filter((r: {
    roadId: string;
    roadCategory: RoadCategory;
    prevJunctionVertexCategory: JunctionVertexCategory;
    nextJunctionVertexCategory: JunctionVertexCategory;
  }) => {
    return r.roadId !== target.roadId;
  });
};

export function addRoadInInvolvedRoads(
  this: ExtendedNamespace,
  target: {
    roadId: string;
    roadCategory: RoadCategory;
    prevJunctionVertexCategory: JunctionVertexCategory;
    nextJunctionVertexCategory: JunctionVertexCategory;
  },
  collection: Array<{
    roadId: string;
    roadCategory: RoadCategory;
    prevJunctionVertexCategory: JunctionVertexCategory;
    nextJunctionVertexCategory: JunctionVertexCategory;
  }>,
) {
  const newCollection = this.removeRoadInInvolvedRoads(target, collection);

  newCollection.push(target);

  return newCollection;
};

export function detachConnectionRoadFromJunction(
  this: ExtendedNamespace,
  connectionRoadItem: RoadItem,
  involvedInfoInJunction: {
    roadId: string;
    roadCategory: RoadCategory;
    prevJunctionVertexCategory: JunctionVertexCategory;
    nextJunctionVertexCategory: JunctionVertexCategory;
  },
) {
  const junctionId = connectionRoadItem.junctionId;
  if (!junctionId) return;

  const junctionItem = this.resolveJunctionByJunctionId(junctionId) as JunctionItem;
  if (!junctionItem) return;

  junctionItem.involvedRoads = this.removeRoadInInvolvedRoads(involvedInfoInJunction, junctionItem.involvedRoads);

  this.emitEvent(StoreDirtyJunctionEvent, {
    junctionId: junctionItem.junctionId,
    junctionPID: junctionItem.junctionPID,
  });
};

export function attachConnectionRoadFromJunction(
  this: ExtendedNamespace,
  connectionRoadItem: RoadItem,
  involvedInfoInJunction: {
    roadId: string;
    roadCategory: RoadCategory;
    prevJunctionVertexCategory: JunctionVertexCategory;
    nextJunctionVertexCategory: JunctionVertexCategory;
  },
) {
  const junctionId = connectionRoadItem.junctionId;
  if (!junctionId) return;

  const junctionItem = this.resolveJunctionByJunctionId(junctionId) as JunctionItem;
  if (!junctionItem) return;

  junctionItem.involvedRoads = this.addRoadInInvolvedRoads(involvedInfoInJunction, junctionItem.involvedRoads);

  this.emitEvent(StoreDirtyJunctionEvent, {
    junctionId: junctionItem.junctionId,
    junctionPID: junctionItem.junctionPID,
  });
};

export function resolveRotationsBetweenEdges(
  this: ExtendedNamespace,
  fromEdge: {
    roadId: string;
    relatedVertices: Vector3[];
  },
  toEdge: {
    roadId: string;
    relatedVertices: Vector3[];
  },
) {
  const fromEdgeDirection = fromEdge.relatedVertices[1].subtract(fromEdge.relatedVertices[0]);

  const rotations = toEdge.relatedVertices.map((tv: Vector3) => {
    const tvDirection = tv.subtract(fromEdge.relatedVertices[1]);
    const dotAmount = Vector3.Dot(tvDirection, fromEdgeDirection) / (fromEdgeDirection.length() * tvDirection.length());

    return {
      dotAmount,
      vector: tv,
    };
  });

  let minRotationIdx = 0;
  rotations.forEach((r: {
    dotAmount: number;
    vector: Vector3;
  }, idx: number) => {
    const _min = rotations[minRotationIdx];

    if (_min.dotAmount < r.dotAmount) {
      minRotationIdx = idx;
    }
  });

  return {
    minRotationIdx,
    rotations,
  };
};

export function resolveNearestEdgeFromEdge(
  this: ExtendedNamespace,
  filterRoadIds: string[],
  fromEdge: {
    roadId: string;
    relatedVertices: Vector3[];
  },
  edges: Array<{
    roadId: string;
    relatedVertices: Vector3[];
  }>,
) {
  let nearestDotAmount = -1000000;
  let nearestIdx = 0;
  let nearestRoadId = '';

  edges.forEach((edge: {
    roadId: string;
    relatedVertices: Vector3[];
  }, idx: number) => {
    if (filterRoadIds.indexOf(edge.roadId) >= 0) return;

    const resolved = this.resolveRotationsBetweenEdges(fromEdge, edge);
    const _minRotationIdx = resolved.minRotationIdx;
    const _rotations = resolved.rotations;
    const _maxDotAmount = _rotations[_minRotationIdx].dotAmount;

    if (nearestDotAmount < _maxDotAmount) {
      nearestDotAmount = _maxDotAmount;
      nearestIdx = idx;
      nearestRoadId = edge.roadId;
    }
  });

  const nearestEdgeVertices = edges[nearestIdx].relatedVertices;
  const nearestVA = nearestEdgeVertices[0];
  const nearestVB = nearestEdgeVertices[1];

  const fromEdgeDirection = fromEdge.relatedVertices[1].subtract(fromEdge.relatedVertices[0]);
  const directionVA = nearestVA.subtract(fromEdge.relatedVertices[1]);
  const directionVB = nearestVB.subtract(fromEdge.relatedVertices[1]);

  const dotAmountVA = Vector3.Dot(directionVA, fromEdgeDirection) / (fromEdgeDirection.length() * directionVA.length());
  const dotAmountVB = Vector3.Dot(directionVB, fromEdgeDirection) / (fromEdgeDirection.length() * directionVB.length());;

  const nearestInfo = {
    nearestRoadId,
    vertices: [] as Vector3[],
  };

  if (dotAmountVA < dotAmountVB) {
    nearestInfo.vertices = [nearestVB, nearestVA];
  } else {
    nearestInfo.vertices = [nearestVA, nearestVB];
  }

  return nearestInfo;
};

export function resolveJunctionPathSeries(
  this: ExtendedNamespace,
  edges: Array<{
    roadId: string;
    relatedVertices: Vector3[];
  }>,
) {
  const firstEdge = edges[0];

  const path = [firstEdge];

  // loop edges.length - 1 - 1 times
  let count = 0;
  while (count < edges.length - 1) {
    const fromEdge = path[path.length - 1];
    const filterRoadIds = path.map((p: {
      roadId: string;
      relatedVertices: Vector3[];
    }) => {
      return p.roadId;
    });

    const nearestInfo = this.resolveNearestEdgeFromEdge(
      filterRoadIds,
      fromEdge,
      edges,
    );

    path.push({
      roadId: nearestInfo.nearestRoadId,
      relatedVertices: [...nearestInfo.vertices],
    });

    count++;
  }

  let finalSeries = [] as Vector3[];

  path.forEach((p: {
    roadId: string;
    relatedVertices: Vector3[];
  }) => {
    finalSeries = finalSeries.concat(p.relatedVertices);
  });

  return finalSeries;
};

export function generateJunctionMeshViaEdgesExtrusion(
  this: ExtendedNamespace,
  edges: JunctionEdgeItem[],
  junctionId: string,
) {
  let pathSeries = [] as Vector3[];

  for (let i = 0; i < edges.length; i++) {
    const currentEdge = edges[i];
    const currentEdgeSeries = currentEdge.seriePoints;

    if (i === 0) {
      pathSeries = pathSeries.concat([...currentEdgeSeries]);
    } else {
      const globalLast = pathSeries[pathSeries.length - 1];

      const localFirst = currentEdgeSeries[0];
      const localLast = currentEdgeSeries[currentEdgeSeries.length - 1];
      const distanceFirst = localFirst.subtract(globalLast).length();
      const distanceLast = localLast.subtract(globalLast).length();

      if (distanceFirst < distanceLast) {
        pathSeries = pathSeries.concat([...currentEdgeSeries]);
      } else {
        pathSeries = pathSeries.concat([...currentEdgeSeries].reverse());
      }
    }
  }

  pathSeries.push(pathSeries[0]);

  const junctionMesh = this.createExtrusionJunctionShape({
    id: `${junctionId}__junctionMesh`,
    pathSeries,
  }) as Mesh;

  return junctionMesh;
};

export function generateJunctionMeshViaEdgesRibbon(
  this: ExtendedNamespace,
  edges: JunctionEdgeItem[],
  junctionId: string,
) {
  const oneSideStepSize = edges.length - 1;

  let firstSeries = [] as Vector3[];
  for (let i = 0; i < oneSideStepSize; i++) {
    const isEven = i % 2 === 0;

    if (isEven) {
      const newSeries = edges[i / 2].seriePoints;
      firstSeries = firstSeries.concat(newSeries);
    } else {
      const floor = Math.floor(i / 2);
      const prevEdgeSeries = edges[floor].seriePoints;
      const nextEdgeSeries = edges[floor + 1].seriePoints;

      const newSeries = this.resolveStraightSeriePoints(prevEdgeSeries[prevEdgeSeries.length - 1], nextEdgeSeries[0]);
      firstSeries = firstSeries.concat(newSeries);
    }
  }

  let secondSeries = [] as Vector3[];
  for (let i = 0; i < oneSideStepSize; i++) {
    const isEven = i % 2 === 0;

    if (isEven) {
      const newSeries = [...edges[edges.length - 1 - i / 2].seriePoints].reverse();
      secondSeries = secondSeries.concat(newSeries);
    } else {
      const floor = Math.floor(i / 2);
      const prevEdgeSeries = edges[edges.length - 1 - floor].seriePoints;
      const nextEdgeSeries = edges[edges.length - 1 - floor - 1].seriePoints;

      const newSeries = this.resolveStraightSeriePoints(prevEdgeSeries[0], nextEdgeSeries[nextEdgeSeries.length - 1]);
      secondSeries = secondSeries.concat(newSeries);
    }
  }

  const junctionMesh = this.createRibbonLane({
    id: `${junctionId}__junctionMesh`,
    innerPoints: firstSeries,
    outerPoints: secondSeries,
  }) as Mesh;

  return junctionMesh;
};

export function reformatJunctionMeshAndEdges(
  this: ExtendedNamespace,
  junctionItemKeyInfo: JunctionItemKeyInfo,
) {
  const junctionEdgeItemKeyInfo = junctionItemKeyInfo.edges;

  // generate edges
  const edges = junctionEdgeItemKeyInfo.map((edgeInfo: JunctionEdgeItemKeyInfo) => {
    const seriePoints = [...edgeInfo.seriePoints];

    const edgeId = edgeInfo.edgeId;
    const edgeColor = edgeInfo.options.lineColor;

    const edgeMesh = this.createSolidLine({
      points: [...seriePoints],
      color: edgeColor,
      id: edgeId,
    });

    const drawingPoints = [...seriePoints];
    const resolved = this.calculateNormalsAndTangentsOfCurveSeriePoints(seriePoints);
    const serieTangents = resolved.serieTangents;
    const serieNormals = resolved.serieNormals;

    const catmullPoints = [...edgeInfo.catmullPoints];
    const catmullTangents = [...edgeInfo.catmullTangents];
    const altitudeCatmullPoints = [...edgeInfo.altitudeCatmullPoints];
    const altitudeCatmullTangents = [...edgeInfo.altitudeCatmullTangents];

    const junctionEdgeItem = {
      seriePoints,
      drawingPoints,
      serieNormals,
      serieTangents,
      catmullPoints,
      catmullTangents,
      altitudeCatmullPoints,
      altitudeCatmullTangents,
      edgeId,
      edgeMesh,
      options: {
        ...edgeInfo.options,
      },
    } as JunctionEdgeItem;

    edgeMesh.metadata = {
      belongingJunctionEdgeItem: junctionEdgeItem
    };

    return junctionEdgeItem;
  });

  // generate junction mesh
  const junctionMesh = this.generateJunctionMeshViaEdgesExtrusion(edges, junctionItemKeyInfo.junctionId);

  this.makeSceneDirty();

  return {
    junctionMesh,
    edges,
  };
};

export function inlineReformatJunction(
  this: ExtendedNamespace,
  junctionItemKeyInfo: JunctionItemKeyInfo,
  junctionItem: JunctionItem,
) {
  // dispose old
  junctionItem.edges.forEach((edgeItem: JunctionEdgeItem) => {
    edgeItem.edgeMesh.dispose();
  });

  junctionItem.junctionMesh.dispose();

  // inline new
  const junctionMeshAndEdges = this.reformatJunctionMeshAndEdges(junctionItemKeyInfo);

  junctionItem.edges = junctionMeshAndEdges.edges;

  junctionItem.junctionMesh = junctionMeshAndEdges.junctionMesh;
  junctionItem.junctionMesh.metadata = {
    belongingJunctionItem: junctionItem,
  };

  this.makeSceneDirty();
};

export function resolveRoadConnectorPoints(this: ExtendedNamespace, opts: {
  roadId: string,
  roadCategory: RoadCategory,
  junctionVertexCategory: JunctionVertexCategory,
}) {
  const roadItem = this.resolveRoadByRoadIdAndRoadCategory(opts.roadId, opts.roadCategory) as RoadItem;

  const reflineSeriePoints = roadItem.referenceLine.seriePoints;
  const leftLanes = roadItem.laneItems.leftLanes;
  const rightLanes = roadItem.laneItems.rightLanes;

  let leftMostVertex = Vector3.Zero();
  let rightMostVertex = Vector3.Zero();

  if (opts.junctionVertexCategory === JunctionVertexCategory.RoadStart) {
    if (leftLanes.length > 0) {
      const leftMostLaneOuterSeriePoints = leftLanes[leftLanes.length - 1].laneLines.outerLaneLine.seriePoints;

      leftMostVertex = leftMostLaneOuterSeriePoints[leftMostLaneOuterSeriePoints.length - 1];
    } else {
      leftMostVertex = reflineSeriePoints[0];
    }

    if (rightLanes.length > 0) {
      const rightMostLaneOuterSeriePoints = rightLanes[rightLanes.length - 1].laneLines.outerLaneLine.seriePoints;

      rightMostVertex = rightMostLaneOuterSeriePoints[0];
    } else {
      rightMostVertex = reflineSeriePoints[0];
    }
  } else {
    if (leftLanes.length > 0) {
      const leftMostLaneOuterSeriePoints = leftLanes[leftLanes.length - 1].laneLines.outerLaneLine.seriePoints;

      leftMostVertex = leftMostLaneOuterSeriePoints[0];
    } else {
      leftMostVertex = reflineSeriePoints[reflineSeriePoints.length - 1];
    }

    if (rightLanes.length > 0) {
      const rightMostLaneOuterSeriePoints = rightLanes[rightLanes.length - 1].laneLines.outerLaneLine.seriePoints;

      rightMostVertex = rightMostLaneOuterSeriePoints[rightMostLaneOuterSeriePoints.length - 1];
    } else {
      rightMostVertex = reflineSeriePoints[reflineSeriePoints.length - 1];
    }
  }

  return [{
    point: leftMostVertex,
    connectedPoint: rightMostVertex,
  }, {
    point: rightMostVertex,
    connectedPoint: leftMostVertex,
  }];
};
