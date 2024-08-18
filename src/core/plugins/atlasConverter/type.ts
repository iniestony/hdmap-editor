import { JunctionItem, RoadItem, SignalItem } from '../statusManager/type';
import * as NamespaceSerieMapMap from "../../protojs/map/map";
import * as NamespaceSerieMapMapRoad from "../../protojs/map/map_road";
import * as NamespaceSerieMapMapLane from "../../protojs/map/map_lane";
import * as NamespaceSerieMapMapJunction from "../../protojs/map/map_junction"
import * as NamespaceSerieMapMapGeometry from "../../protojs/map/map_geometry";
import * as NamespaceSerieMapMapId from "../../protojs/map/map_id";
import * as NamespaceSerieMapSignal from "../../protojs/map/map_signal";
import * as NamespaceSerieCommonGeometry from "../../protojs/common/geometry";

export interface RoadCollectionData {
  twoStraightLineRoadCollection: RoadItem[];
  threeCircleCurveRoadCollection: RoadItem[];
  quadraticBezierCurveRoadCollection: RoadItem[];
  cubicBezierCurveRoadCollection: RoadItem[];
  catmullSerieRoadCollection: RoadItem[];
  connectionRoadCollection: RoadItem[];
};

export interface JunctionCollectionData {
  junctionCollection: JunctionItem[];
};

export interface SignalCollectionData {
  signalCollection: SignalItem[];
};

export import AtlasId = NamespaceSerieMapMapId.atlas.hdmap.Id;

export import AtlasCommonPointENU = NamespaceSerieCommonGeometry.atlas.common.PointENU;

export import AtlasMap = NamespaceSerieMapMap.atlas.hdmap.Map;
export import AtlasProjection = NamespaceSerieMapMap.atlas.hdmap.Projection;
export import AtlasHeader = NamespaceSerieMapMap.atlas.hdmap.Header;

export import AtlasRoad = NamespaceSerieMapMapRoad.atlas.hdmap.Road;
export import AtlasRoadSection = NamespaceSerieMapMapRoad.atlas.hdmap.RoadSection;
export import AtlasRoadBoundary = NamespaceSerieMapMapRoad.atlas.hdmap.RoadBoundary;
export import AtlasBoundaryEdge = NamespaceSerieMapMapRoad.atlas.hdmap.BoundaryEdge;
export import AtlasBoundaryPolygon = NamespaceSerieMapMapRoad.atlas.hdmap.BoundaryPolygon;

export import AtlasLane = NamespaceSerieMapMapLane.atlas.hdmap.Lane;
export import AtlasLaneBoundary = NamespaceSerieMapMapLane.atlas.hdmap.LaneBoundary;
export import AtlasLaneBoundaryType = NamespaceSerieMapMapLane.atlas.hdmap.LaneBoundaryType;
export import AtlasLaneSampleAssociation = NamespaceSerieMapMapLane.atlas.hdmap.LaneSampleAssociation;

export import AtlasJunction = NamespaceSerieMapMapJunction.atlas.hdmap.Junction

export import AtlasPolygon = NamespaceSerieMapMapGeometry.atlas.hdmap.Polygon;
export import AtlasCurve = NamespaceSerieMapMapGeometry.atlas.hdmap.Curve;
export import AtlasCurveSegment = NamespaceSerieMapMapGeometry.atlas.hdmap.CurveSegment;
export import AtlasLineSegment = NamespaceSerieMapMapGeometry.atlas.hdmap.LineSegment;

export import AtlasSignal = NamespaceSerieMapSignal.atlas.hdmap.Signal;
export import AtlasSubsignal = NamespaceSerieMapSignal.atlas.hdmap.Subsignal;
export import AtlasSignInfo = NamespaceSerieMapSignal.atlas.hdmap.SignInfo;