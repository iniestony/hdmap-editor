import {
  Vector3,
  Curve3,
  Path3D,
} from "@babylonjs/core";
import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../renderer/config';
import { FetchConvertedApolloMapEvent } from '../../../../core/plugins/atlasConverter/constant';
import {
  LaneSide,
  LaneItem,
  RoadItem,
  RoadCategory,
  JunctionItem,
  JunctionEdgeItem,
} from '../../statusManager/type';
import {
  FetchCurrentLASInfo,
} from '../../../../core/plugins/lasLoader/constant';
import {
  LASInfo,
} from '../../../../core/plugins/lasLoader/type';
import {
  AtlasMap,
  AtlasProjection,
  AtlasHeader,
  AtlasRoad,
  AtlasRoadSection,
  AtlasRoadBoundary,
  AtlasBoundaryEdge,
  AtlasBoundaryPolygon,
  AtlasLane,
  AtlasLaneBoundary,
  AtlasLaneBoundaryType,
  AtlasLaneSampleAssociation,
  AtlasPolygon,
  AtlasCurve,
  AtlasCurveSegment,
  AtlasLineSegment,
  AtlasId,
  AtlasCommonPointENU,
  AtlasJunction,
} from '../../../../core/plugins/atlasConverter/type';

function appendCurrentTimeToFileName(
  filename: string
) {
  const now = new Date()
  const formattedTime = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('')

  const [name, extension] = filename.split('.')
  return `${name}_${formattedTime}.${extension}`
}


export function convertToApolloMapAndDownload(this: ExtendedNamespace) {
  this.emitEvent(FetchConvertedApolloMapEvent, {
    callback: async (hdMapId:string, atlasMap: AtlasMap) => {
      const uint8Array = atlasMap.serialize();
      const blob = new Blob([uint8Array], {
        type: 'application/octet-stream',
      });

      const objectUrl = window.URL.createObjectURL(blob);
      const aTag = document.createElement('a');
      aTag.href = objectUrl;
      aTag.download = appendCurrentTimeToFileName(RendererConfig.atlas.defaultMapFileName)
      aTag.style.display = 'none';
      aTag.click();
    },
  });
};


export function generatePointENU(this: ExtendedNamespace, point: Vector3) {

  const rawPoint = {
    x: point.x,
    y: point.z,
    z: point.y
  };

  return new AtlasCommonPointENU(rawPoint);
};

export function calculateLineSegmentLength(this: ExtendedNamespace, seriePoints: Vector3[]) {
  const curve = new Curve3(seriePoints);

  return curve.length();
};

export function calculateSerieGapDistance(this: ExtendedNamespace, seriePoints: Vector3[]) {
  const path = new Path3D(seriePoints);

  return path.getDistances();
};

export function stringToUint8Array(this: ExtendedNamespace, str: string) {
  const raw = [];

  for (let i = 0; i < str.length; i++) {
    raw.push(str.charCodeAt(i));
  }

  return new Uint8Array(raw);
};

export function generateProjection(this: ExtendedNamespace, projection: string) {
  return new AtlasProjection({
    proj: projection,
  });
};

export function generateHeader(this: ExtendedNamespace, headerInfo: {
  version: string,
  projection: string,
  district: string,
  rev_major: string,
  rev_minor: string,
  left: number,
  top: number,
  right: number,
  bottom: number,
  vendor: string,
}) {
  const atlasProjection = this.generateProjection(headerInfo.projection);

  const atlasHeader = new AtlasHeader({
    projection: atlasProjection,
  });

  atlasHeader.version = this.stringToUint8Array(headerInfo.version);
  atlasHeader.date = this.stringToUint8Array(new Date().toISOString());
  atlasHeader.district = this.stringToUint8Array(headerInfo.district);
  atlasHeader.rev_major = this.stringToUint8Array(headerInfo.rev_major);
  atlasHeader.rev_minor = this.stringToUint8Array(headerInfo.rev_minor);

  atlasHeader.left = headerInfo.left;
  atlasHeader.top = headerInfo.top;
  atlasHeader.right = headerInfo.right;
  atlasHeader.bottom = headerInfo.bottom;

  atlasHeader.vendor = this.stringToUint8Array(headerInfo.vendor);

  return atlasHeader;
};

export function generateLaneBoundaryType(this: ExtendedNamespace, laneBoundaryInfo: {
  start: number,
  boundaryType: AtlasLaneBoundaryType.Type,
}) {
  return new AtlasLaneBoundaryType({
    s: laneBoundaryInfo.start,
    // single boundaryType in one boundary
    types: [laneBoundaryInfo.boundaryType],
  });
};

export function generateLaneBoundary(this: ExtendedNamespace, laneItem: LaneItem) {
  const innerSeriePoints = [...laneItem.laneLines.innerLaneLine.seriePoints];
  const outerSeriePoints = [...laneItem.laneLines.outerLaneLine.seriePoints];

  // left lane boundary
  const leftLaneBoundaryLength = this.calculateLineSegmentLength(innerSeriePoints);
  const leftLaneBoundaryStart = this.generatePointENU(innerSeriePoints[0]) as AtlasCommonPointENU;

  const leftLaneBoundaryLineSegment = new AtlasLineSegment({
    point: innerSeriePoints.map((p: Vector3) => {
      return this.generatePointENU(p) as AtlasCommonPointENU;
    })
  });

  const leftLaneBoundaryCurveSegment = new AtlasCurveSegment({
    s: 0,
    start_position: leftLaneBoundaryStart,
    length: leftLaneBoundaryLength,
    line_segment: leftLaneBoundaryLineSegment,
  });

  const leftLaneBoundaryCurve = new AtlasCurve({
    segment: [leftLaneBoundaryCurveSegment],
  });

  const leftLaneBoundaryType = this.generateLaneBoundaryType({
    start: 0,
    boundaryType: laneItem.laneLines.innerLaneLine.atlasLaneBoundaryType,
  });

  const leftLaneBoundary = new AtlasLaneBoundary({
    curve: leftLaneBoundaryCurve,
    length: leftLaneBoundaryLength,
    virtual: laneItem.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
    boundary_type: [leftLaneBoundaryType],
  });



  // right lane boundary
  const rightLaneBoundaryLength = this.calculateLineSegmentLength(outerSeriePoints);
  const rightLaneBoundaryStart = this.generatePointENU(outerSeriePoints[0]) as AtlasCommonPointENU;

  const rightLaneBoundaryLineSegment = new AtlasLineSegment({
    point: outerSeriePoints.map((p: Vector3) => {
      return this.generatePointENU(p) as AtlasCommonPointENU;
    })
  });

  const rightLaneBoundaryCurveSegment = new AtlasCurveSegment({
    s: 0,
    start_position: rightLaneBoundaryStart,
    length: rightLaneBoundaryLength,
    line_segment: rightLaneBoundaryLineSegment,
  });

  const rightLaneBoundaryCurve = new AtlasCurve({
    segment: [rightLaneBoundaryCurveSegment],
  });

  const rightLaneBoundaryType = this.generateLaneBoundaryType({
    start: 0,
    boundaryType: laneItem.laneLines.outerLaneLine.atlasLaneBoundaryType,
  });

  const rightLaneBoundary = new AtlasLaneBoundary({
    curve: rightLaneBoundaryCurve,
    length: rightLaneBoundaryLength,
    virtual: laneItem.laneLines.outerLaneLine.atlasLaneBoundaryVirtual,
    boundary_type: [rightLaneBoundaryType],
  });


  return {
    leftLaneBoundary,
    rightLaneBoundary,
  };
};

export function generateLaneCentralCurve(this: ExtendedNamespace, laneItem: LaneItem) {
  const innerSeriePoints = [...laneItem.laneLines.innerLaneLine.seriePoints];
  const outerSeriePoints = [...laneItem.laneLines.outerLaneLine.seriePoints];

  const centralSeriePoints = innerSeriePoints.map((p: Vector3, idx: number) => {
    const op = outerSeriePoints[idx];

    return new Vector3(
      (p.x + op.x) / 2,
      (p.y + op.y) / 2,
      (p.z + op.z) / 2,
    );
  });

  const centralCurveLength = this.calculateLineSegmentLength(centralSeriePoints);
  const centralCurveStart = this.generatePointENU(centralSeriePoints[0]) as AtlasCommonPointENU;

  const centralCurveLineSegment = new AtlasLineSegment({
    point: centralSeriePoints.map((p: Vector3) => {
      return this.generatePointENU(p) as AtlasCommonPointENU;
    })
  });

  const centralCurveCurveSegment = new AtlasCurveSegment({
    s: 0,
    start_position: centralCurveStart,
    length: centralCurveLength,
    line_segment: centralCurveLineSegment,
  });

  const centralCurve = new AtlasCurve({
    segment: [centralCurveCurveSegment],
  });

  return {
    centralCurve,
    length: centralCurveLength,
  };
};

export function generateLaneSampleAssociation(
  this: ExtendedNamespace,
  laneItem: LaneItem,
  roadItem: RoadItem,
) {
  const innerSeriePoints = [...laneItem.laneLines.innerLaneLine.seriePoints];
  const outerSeriePoints = [...laneItem.laneLines.outerLaneLine.seriePoints];

  const centralSeriePoints = innerSeriePoints.map((p: Vector3, idx: number) => {
    const op = outerSeriePoints[idx];

    return new Vector3(
      (p.x + op.x) / 2,
      (p.y + op.y) / 2,
      (p.z + op.z) / 2,
    );
  });

  const centralSeriePointsDistances = this.calculateSerieGapDistance(centralSeriePoints);

  // left sample
  const leftSampleAssociations = centralSeriePoints.map((p: Vector3, idx: number) => {
    const distance = centralSeriePointsDistances[idx];
    const width = innerSeriePoints[idx].subtract(p).length();

    return new AtlasLaneSampleAssociation({
      s: distance,
      width: width,
    });
  });

  // right sample
  const rightSampleAssociations = centralSeriePoints.map((p: Vector3, idx: number) => {
    const distance = centralSeriePointsDistances[idx];
    const width = outerSeriePoints[idx].subtract(p).length();

    return new AtlasLaneSampleAssociation({
      s: distance,
      width: width,
    });
  });



  const laneSide = laneItem.laneSide;
  const leftlanes = [...roadItem.laneItems.leftLanes];
  const rightLanes = [...roadItem.laneItems.rightLanes];
  const hasLeftLanes = leftlanes.length > 0;
  const hasRightLanes = rightLanes.length > 0;

  const reflineSeriePoints = roadItem.referenceLine.seriePoints;

  const roadMostLeftSeriePoints = hasLeftLanes ? [...leftlanes[leftlanes.length - 1].laneLines.outerLaneLine.seriePoints] : [...reflineSeriePoints].reverse();
  const roadMostRightSeriePoints = hasRightLanes ? [...rightLanes[rightLanes.length - 1].laneLines.outerLaneLine.seriePoints] : [...reflineSeriePoints];

  let leftRoadSampleSeriePoints: Vector3[] = [];
  let rightRoadSampleSeriePoints: Vector3[] = [];

  if (laneSide === LaneSide.Left) {
    leftRoadSampleSeriePoints = [...roadMostRightSeriePoints].reverse();
    rightRoadSampleSeriePoints = [...roadMostLeftSeriePoints];
  } else {
    leftRoadSampleSeriePoints = [...roadMostLeftSeriePoints].reverse();
    rightRoadSampleSeriePoints = [...roadMostRightSeriePoints];
  }

  // left road sample
  const leftRoadSampleAssociations = centralSeriePoints.map((p: Vector3, idx: number) => {
    const distance = centralSeriePointsDistances[idx];
    const width = leftRoadSampleSeriePoints[idx].subtract(p).length();

    return new AtlasLaneSampleAssociation({
      s: distance,
      width: width,
    });
  });

  // right road sample
  const rightRoadSampleAssociations = centralSeriePoints.map((p: Vector3, idx: number) => {
    const distance = centralSeriePointsDistances[idx];
    const width = rightRoadSampleSeriePoints[idx].subtract(p).length();

    return new AtlasLaneSampleAssociation({
      s: distance,
      width: width,
    });
  });


  return {
    leftSampleAssociations,
    rightSampleAssociations,
    leftRoadSampleAssociations,
    rightRoadSampleAssociations,
  };
};

export function generateLane(
  this: ExtendedNamespace,
  roadItem: RoadItem,
  laneItem: LaneItem,
) {
  const laneSide = laneItem.laneSide;
  const centralCurveInfo = this.generateLaneCentralCurve(laneItem);
  const centralCurve = centralCurveInfo.centralCurve;
  const laneLength = centralCurveInfo.length;

  const boundaryInfo = this.generateLaneBoundary(laneItem);
  const leftLaneBoundary = boundaryInfo.leftLaneBoundary;
  const rightLaneBoundary = boundaryInfo.rightLaneBoundary;

  const sampleAssociationsInfo = this.generateLaneSampleAssociation(laneItem, roadItem);
  const leftSampleAssociations = sampleAssociationsInfo.leftSampleAssociations;
  const rightSampleAssociations = sampleAssociationsInfo.rightSampleAssociations;
  const leftRoadSampleAssociations = sampleAssociationsInfo.leftRoadSampleAssociations;
  const rightRoadSampleAssociations = sampleAssociationsInfo.rightRoadSampleAssociations;

  const predecessorId = laneItem.prevLanes.map((info: {
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    return new AtlasId({
      id: `${info.laneId}`,
    });
  });

  const successorId = laneItem.nextLanes.map((info: {
    laneId: string;
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    return new AtlasId({
      id: `${info.laneId}`,
    });
  });

  const lane = new AtlasLane();

  lane.id = new AtlasId({
    id: `${laneItem.laneId}`,
  });

  lane.central_curve = centralCurve;
  lane.length = laneLength;
  lane.direction = laneItem.laneSide === LaneSide.Left ? AtlasLane.LaneDirection.BACKWARD : AtlasLane.LaneDirection.FORWARD;

  lane.speed_limit = laneItem.atlasLaneSpeedLimit / 3.6;
  lane.type = laneItem.atlasLaneType;
  lane.turn = laneItem.atlasLaneTurn;
  lane.direction = laneItem.atlasLaneDirection;
  lane.left_boundary = leftLaneBoundary;
  lane.right_boundary = rightLaneBoundary;

  lane.left_sample = leftSampleAssociations;
  lane.right_sample = rightSampleAssociations;
  lane.left_road_sample = leftRoadSampleAssociations;
  lane.right_road_sample = rightRoadSampleAssociations;

  lane.predecessor_id = predecessorId;
  lane.successor_id = successorId;

  const forwardId = this.neighborForwardId(roadItem, laneItem);
  const reverseId = this.neighborReverseId(roadItem, laneItem);

  lane.left_neighbor_forward_lane_id = forwardId.leftNeighborForwardLaneId;
  lane.right_neighbor_forward_lane_id = forwardId.rightNeighborForwardLaneId;

  lane.left_neighbor_reverse_lane_id = reverseId.leftNeighborReverseLaneId;
  lane.right_neighbor_reverse_lane_id = reverseId.rightNeighborReverseLaneId;

  if (roadItem.junctionId) {
    const atlasJunctionId = new AtlasId({
      id: `${roadItem.junctionId}`,
    });
    lane.junction_id = atlasJunctionId;
  }

  return lane;
};

export function neighborReverseId(
  this: ExtendedNamespace,
  roadItem: RoadItem,
  laneItem: LaneItem,
) {
  let leftNeighborId = [];
  let rightNeighborId = [];

  if (laneItem.laneSide === LaneSide.Left) {
    const leftLaneIndex = roadItem.laneItems.leftLanes.findIndex((l: LaneItem) => {
      return l.laneId === laneItem.laneId;
    });

    const leftNeighborIndex = leftLaneIndex - 1;
    const rightNeighborIndex = leftLaneIndex + 1;

    const leftNowDirection = laneItem.atlasLaneDirection;

    const leftLanes = roadItem.laneItems.leftLanes;
    
    if (leftLanes[leftNeighborIndex]) {
      const leftDirection = leftLanes[leftNeighborIndex].atlasLaneDirection;

      if (leftNowDirection !== leftDirection) {
        const atlasLaneId = new AtlasId({
          id: `${leftLanes[leftNeighborIndex].laneId}`,
        });

        leftNeighborId.push(atlasLaneId);
      }
    } else {
      const rightLanes = roadItem.laneItems.rightLanes;

      if (rightLanes[0]) {
        const rightDirction = rightLanes[0].atlasLaneDirection;

        if (leftNowDirection !== rightDirction) {
          const atlasLaneId = new AtlasId({
            id: `${rightLanes[0].laneId}`,
          });

          leftNeighborId.push(atlasLaneId);
        }
      }
    }

    if (leftLanes[rightNeighborIndex]) {
      const leftDirection = leftLanes[rightNeighborIndex].atlasLaneDirection;

      if (leftNowDirection !== leftDirection) {
        const atlasLaneId = new AtlasId({
          id: `${leftLanes[rightNeighborIndex].laneId}`,
        });

        rightNeighborId.push(atlasLaneId);
      }
    }
  } else if (laneItem.laneSide === LaneSide.Right) {
    const rightLaneIndex = roadItem.laneItems.rightLanes.findIndex((l: LaneItem) => {
      return l.laneId === laneItem.laneId;
    });

    const leftNeighborIndex = rightLaneIndex - 1;
    const rightNeighborIndex = rightLaneIndex + 1;

    const rightNowDirection = laneItem.atlasLaneDirection;

    const rightLanes = roadItem.laneItems.rightLanes;
    
    if (rightLanes[leftNeighborIndex]) {
      const rightDirection = rightLanes[leftNeighborIndex].atlasLaneDirection;

      if (rightNowDirection !== rightDirection) {
        const atlasLaneId = new AtlasId({
          id: `${rightLanes[leftNeighborIndex].laneId}`,
        });

        leftNeighborId.push(atlasLaneId);
      };
    } else {
      const leftLanes = roadItem.laneItems.leftLanes;

      if (leftLanes[0]) {
        const rightDirction = leftLanes[0].atlasLaneDirection;

        if (rightNowDirection !== rightDirction) {
          const atlasLaneId = new AtlasId({
            id: `${leftLanes[0].laneId}`,
          });
          
          leftNeighborId.push(atlasLaneId);
        }
      }
    }

    if (rightLanes[rightNeighborIndex]) {
      const rightDirection = rightLanes[rightNeighborIndex].atlasLaneDirection;

      if (rightNowDirection !== rightDirection) {
        const atlasLaneId = new AtlasId({
          id: `${rightLanes[rightNeighborIndex].laneId}`,
        });

        rightNeighborId.push(atlasLaneId);
      };
    }
  }

  return {
    leftNeighborReverseLaneId: leftNeighborId,
    rightNeighborReverseLaneId: rightNeighborId,
  };
};

export function neighborForwardId(
  this: ExtendedNamespace,
  roadItem: RoadItem,
  laneItem: LaneItem,
) {
  let leftNeighborId = [];
  let rightNeighborId = [];

  if (laneItem.laneSide === LaneSide.Left) {
    const leftLaneIndex = roadItem.laneItems.leftLanes.findIndex((l: LaneItem) => {
      return l.laneId === laneItem.laneId;
    });

    const leftNeighborIndex = leftLaneIndex - 1;
    const rightNeighborIndex = leftLaneIndex + 1;

    const leftLanes = roadItem.laneItems.leftLanes;

    if (leftLanes[leftNeighborIndex]) {
      const atlasLaneId = new AtlasId({
        id: `${leftLanes[leftNeighborIndex].laneId}`,
      });

      leftNeighborId.push(atlasLaneId);
    }

    if (leftLanes[rightNeighborIndex]) {
      const atlasLaneId = new AtlasId({
        id: `${leftLanes[rightNeighborIndex].laneId}`,
      });

      rightNeighborId.push(atlasLaneId);
    }
  } else if (laneItem.laneSide === LaneSide.Right) {
    const rightLaneIndex = roadItem.laneItems.rightLanes.findIndex((l: LaneItem) => {
      return l.laneId === laneItem.laneId;
    });

    const leftNeighborIndex = rightLaneIndex - 1;
    const rightNeighborIndex = rightLaneIndex + 1;

    const rightLanes = roadItem.laneItems.rightLanes;

    if (rightLanes[leftNeighborIndex]) {
      const atlasLaneId = new AtlasId({
        id: `${rightLanes[leftNeighborIndex].laneId}`,
      });

      leftNeighborId.push(atlasLaneId);
    }

    if (rightLanes[rightNeighborIndex]) {
      const atlasLaneId = new AtlasId({
        id: `${rightLanes[rightNeighborIndex].laneId}`,
      });

      rightNeighborId.push(atlasLaneId);
    }
  }

  return {
    leftNeighborForwardLaneId: leftNeighborId,
    rightNeighborForwardLaneId: rightNeighborId,
  };
};

export function generateRoadBoundary(
  this: ExtendedNamespace,
  roadItem: RoadItem,
) {
  const leftlanes = [...roadItem.laneItems.leftLanes];
  const rightLanes = [...roadItem.laneItems.rightLanes];
  const hasLeftLanes = leftlanes.length > 0;
  const hasRightLanes = rightLanes.length > 0;

  const reflineSeriePoints = roadItem.referenceLine.seriePoints;

  const roadLeftBoundarySeriePoints = hasLeftLanes ? [...leftlanes[leftlanes.length - 1].laneLines.outerLaneLine.seriePoints] : [...reflineSeriePoints].reverse();
  const roadRightBoundarySeriePoints = hasRightLanes ? [...rightLanes[rightLanes.length - 1].laneLines.outerLaneLine.seriePoints] : [...reflineSeriePoints];

  // left road boundary edge
  const roadLeftBoundaryLength = this.calculateLineSegmentLength(roadLeftBoundarySeriePoints);
  const roadLeftBoundaryStart = this.generatePointENU(roadLeftBoundarySeriePoints[0]) as AtlasCommonPointENU;

  const roadLeftBoundaryLineSegment = new AtlasLineSegment({
    point: roadLeftBoundarySeriePoints.map((p: Vector3) => {
      return this.generatePointENU(p) as AtlasCommonPointENU;
    })
  });

  const roadLeftBoundaryCurveSegment = new AtlasCurveSegment({
    s: 0,
    start_position: roadLeftBoundaryStart,
    length: roadLeftBoundaryLength,
    line_segment: roadLeftBoundaryLineSegment,
  });

  const roadLeftBoundaryCurve = new AtlasCurve({
    segment: [roadLeftBoundaryCurveSegment],
  });

  const roadLeftBoundaryEdge = new AtlasBoundaryEdge({
    curve: roadLeftBoundaryCurve,
    type: AtlasBoundaryEdge.Type.LEFT_BOUNDARY,
  });


  // right road boundary edge
  const roadRightBoundaryLength = this.calculateLineSegmentLength(roadRightBoundarySeriePoints);
  const roadRightBoundaryStart = this.generatePointENU(roadRightBoundarySeriePoints[0]) as AtlasCommonPointENU;

  const roadRightBoundaryLineSegment = new AtlasLineSegment({
    point: roadRightBoundarySeriePoints.map((p: Vector3) => {
      return this.generatePointENU(p) as AtlasCommonPointENU;
    })
  });

  const roadRightBoundaryCurveSegment = new AtlasCurveSegment({
    s: 0,
    start_position: roadRightBoundaryStart,
    length: roadRightBoundaryLength,
    line_segment: roadRightBoundaryLineSegment,
  });

  const roadRightBoundaryCurve = new AtlasCurve({
    segment: [roadRightBoundaryCurveSegment],
  });

  const roadRightBoundaryEdge = new AtlasBoundaryEdge({
    curve: roadRightBoundaryCurve,
    type: AtlasBoundaryEdge.Type.RIGHT_BOUNDARY,
  });


  // road boundary polygon
  const roadBoundaryPolygon = new AtlasBoundaryPolygon({
    edge: [roadLeftBoundaryEdge, roadRightBoundaryEdge],
  });

  // road boundary
  const roadBoundary = new AtlasRoadBoundary({
    outer_polygon: roadBoundaryPolygon,
    hole: [],
  });

  return roadBoundary;
};

export function generateRoadSection(
  this: ExtendedNamespace,
  roadItem: RoadItem,
) {
  const roadSectionId = new AtlasId({
    id: `0`,
  });

  const leftLaneIds = roadItem.laneItems.leftLanes.map((l: LaneItem) => {
    return new AtlasId({
      id: `${l.laneId}`,
    });
  });

  const rightLaneIds = roadItem.laneItems.rightLanes.map((l: LaneItem) => {
    return new AtlasId({
      id: `${l.laneId}`,
    });
  });

  const roadBoundary = this.generateRoadBoundary(roadItem);

  const roadSection = new AtlasRoadSection({
    id: roadSectionId,
    lane_id: [...leftLaneIds, ...rightLaneIds],
    boundary: roadBoundary,
  });

  return roadSection;
};

export function generateRoad(
  this: ExtendedNamespace,
  roadItem: RoadItem,
) {
  const atlasRoadId = new AtlasId({
    id: `${roadItem.roadId}`,
  });

  const roadSection = this.generateRoadSection(roadItem) as AtlasRoadSection;

  let road = new AtlasRoad({
    id: atlasRoadId,
    section: [roadSection],
    type: roadItem.atlasRoadType,
  });

  if (roadItem.junctionId) {
    const atlasJunctionId = new AtlasId({
      id: `${roadItem.junctionId}`,
    });

    road = new AtlasRoad({
      id: atlasRoadId,
      section: [roadSection],
      junction_id: atlasJunctionId,
      type: roadItem.atlasRoadType,
    });
  }

  return road;
};

export function inlineCollectSingleCategoryRoadsIntoAtlasMap(
  this: ExtendedNamespace,
  roadItems: RoadItem[],
  inlineInfo: {
    atlasRoads: AtlasRoad[];
    atlasLanes: AtlasLane[];
  },
) {
  for (let i = 0; i < roadItems.length; i++) {
    const roadItem = roadItems[i];

    // left lanes
    const leftLaneItems = roadItem.laneItems.leftLanes;
    leftLaneItems.forEach((laneItem: LaneItem, idx: number) => {
      const atlasLane = this.generateLane(roadItem, laneItem);
      inlineInfo.atlasLanes.push(atlasLane);
    });

    // right lanes
    const rightLaneItems = roadItem.laneItems.rightLanes;
    rightLaneItems.forEach((laneItem: LaneItem, idx: number) => {
      const atlasLane = this.generateLane(roadItem, laneItem);
      inlineInfo.atlasLanes.push(atlasLane);
    });

    const atlasRoad = this.generateRoad(roadItem);
    inlineInfo.atlasRoads.push(atlasRoad);
  }
};

export function generateJunction(
  this: ExtendedNamespace,
  junctionItem: JunctionItem,
) {
  const junction = new AtlasJunction();

  const pathSeries = this.generateJunctionPathSeriesViaEdges(junctionItem.edges);

  const polygon = new AtlasLineSegment({
    point: pathSeries.map((p: Vector3) => {
      return this.generatePointENU(p) as AtlasCommonPointENU;
    })
  });

  junction.id = new AtlasId({
    id: `${junctionItem.junctionId}`,
  });

  junction.polygon = polygon;
  junction.overlap_id = [];
  junction.type = junctionItem.junctionType;

  return junction;
};

export function generateJunctionPathSeriesViaEdges(
  this: ExtendedNamespace,
  edges: JunctionEdgeItem[]
) {
  let pathSeries = [] as Vector3[];

  for (let i = 0; i < edges.length; i++) {
    const currentEdge = edges[i];
    const currentEdgeSeries = currentEdge.seriePoints;

    const nextEdge = edges[(i + 1) % edges.length];
    const nextEdgeSeries = nextEdge.seriePoints;

    pathSeries = pathSeries.concat(currentEdgeSeries);

    const newSeries = this.resolveStraightSeriePoints(currentEdgeSeries[currentEdgeSeries.length - 1], nextEdgeSeries[0]);
    pathSeries = pathSeries.concat(newSeries);
  }

  return pathSeries;
};

export function inlineCollectSingleCategoryJunctionIntoAtlasMap(
  this: ExtendedNamespace,
  junctionItem: JunctionItem[],
  inlineInfo: {
    atlasJunction: AtlasJunction[],
  },
) {
  junctionItem.forEach((junctionItem: JunctionItem) => {
    const atlasJunction = this.generateJunction(junctionItem);

    inlineInfo.atlasJunction.push(atlasJunction);
  });
};
