// road
import CreateTwoStraightLineTransaction from './createLineAndCurve/createTwoStraightLine';
import CreateThreeCircleCurveTransaction from './createLineAndCurve/createThreeCircleCurve';
import CreateQuadraticBezierCurveTransaction from './createLineAndCurve/createQuadraticBezierCurve';
import CreateCubicBezierCurveTransaction from './createLineAndCurve/createCubicBezierCurve';
import CreateTwoStraightLineRoadTransaction from './createRoad/createTwoStraightLineRoad';
import CreateThreeCircleCurveRoadTransaction from './createRoad/createThreeCircleCurveRoad';
import CreateQuadraticBezierCurveRoadTransaction from './createRoad/createQuadraticBezierCurveRoad';
import CreateCubicBezierCurveRoadTransaction from './createRoad/createCubicBezierCurveRoad';
import CreateCatmullSerieRoadTransaction from './createRoad/createCatmullSerieRoad';
import CreateConnectionRoadTransaction from './createRoad/createConnectionRoad';
import RemoveTwoStraightLineRoadTransaction from './removeRoad/removeTwoStraightLineRoad';
import RemoveThreeCircleCurveRoadTransaction from './removeRoad/removeThreeCircleCurveRoad';
import RemoveQuadraticBezierCurveRoadTransaction from './removeRoad/removeQuadraticBezierCurveRoad';
import RemoveCubicBezierCurveRoadTransaction from './removeRoad/removeCubicBezierCurveRoad';
import RemoveCatmullSerieRoadTransaction from './removeRoad/removeCatmullSerieRoad';
import RemoveConnectionRoadTransaction from './removeRoad/removeConnectionRoad';
import LaneWidthEditTwoStraightLineRoadTransaction from './laneWidthEdit/laneWidthEditTwoStraightLineRoad';
import LaneWidthEditThreeCircleCurveRoadTransaction from './laneWidthEdit/laneWidthEditThreeCircleCurveRoad';
import LaneWidthEditQuadraticBezierCurveRoadTransaction from './laneWidthEdit/laneWidthEditQuadraticBezierCurveRoad';
import LaneWidthEditCubicBezierCurveRoadTransaction from './laneWidthEdit/laneWidthEditCubicBezierCurveRoad';
import LaneWidthEditCatmullSerieRoadTransaction from './laneWidthEdit/laneWidthEditCatmullSerieRoad';
import AddLaneTwoStraightLineRoadTransaction from './addLane/addLaneTwoStraightLineRoad';
import AddLaneThreeCircleCurveRoadTransaction from './addLane/addLaneThreeCircleCurveRoad';
import AddLaneQuadraticBezierCurveRoadTransaction from './addLane/addLaneQuadraticBezierCurveRoad';
import AddLaneCubicBezierCurveRoadTransaction from './addLane/addLaneCubicBezierCurveRoad';
import AddLaneCatmullSerieRoadTransaction from './addLane/addLaneCatmullSerieRoad';
import AddLaneConnectionRoadTransaction from './addLane/addLaneConnectionRoad';
import RemoveLaneTwoStraightLineRoadTransaction from './removeLane/removeLaneTwoStraightLineRoad';
import RemoveLaneThreeCircleCurveRoadTransaction from './removeLane/removeLaneThreeCircleCurveRoad';
import RemoveLaneQuadraticBezierCurveRoadTransaction from './removeLane/removeLaneQuadraticBezierCurveRoad';
import RemoveLaneCubicBezierCurveRoadTransaction from './removeLane/removeLaneCubicBezierCurveRoad';
import RemoveLaneCatmullSerieRoadTransaction from './removeLane/removeLaneCatmullSerieRoad';
import RemoveLaneConnectionRoadTransaction from './removeLane/removeLaneConnectionRoad';
import CatmullEditTwoStraightLineRoadTransaction from './catmullEdit/catmullEditTwoStraightLineRoad';
import CatmullEditThreeCircleCurveRoadTransaction from './catmullEdit/catmullEditThreeCircleCurveRoad';
import CatmullEditQuadraticBezierCurveRoadTransaction from './catmullEdit/catmullEditQuadraticBezierCurveRoad';
import CatmullEditCubicBezierCurveRoadTransaction from './catmullEdit/catmullEditCubicBezierCurveRoad';
import CatmullEditCatmullSerieRoadTransaction from './catmullEdit/catmullEditCatmullSerieRoad';
import CatmullEditConnectionRoadTransaction from './catmullEdit/catmullEditConnectionRoad';
import CatmullReformatTwoStraightLineRoadTransaction from './catmullReformat/catmullReformatTwoStraightLineRoad';
import CatmullReformatThreeCircleCurveRoadTransaction from './catmullReformat/catmullReformatThreeCircleCurveRoad';
import CatmullReformatQuadraticBezierCurveRoadTransaction from './catmullReformat/catmullReformatQuadraticBezierCurveRoad';
import CatmullReformatCubicBezierCurveRoadTransaction from './catmullReformat/catmullReformatCubicBezierCurveRoad';
import CatmullReformatCatmullSerieRoadTransaction from './catmullReformat/catmullReformatCatmullSerieRoad';
import CatmullReformatConnectionRoadTransaction from './catmullReformat/catmullReformatConnectionRoad';
import CatmullAlterLaneCatmullSerieRoadTransaction from './catmullAlterLane/catmullAlterLaneCatmullSerieRoad';
import CatmullAlterLaneConnectionRoadTransaction from './catmullAlterLane/catmullAlterLaneConnectionRoad';
import CatmullAltitudeReformatCatmullSerieRoadTransaction from './catmullAltitudeReformat/catmullAltitudeReformatCatmullSerieRoad';
import CatmullAltitudeReformatConnectionRoadTransaction from './catmullAltitudeReformat/catmullAltitudeReformatConnectionRoad';
import CatmullAltitudeLaneEditCatmullSerieRoadTransaction from './catmullAltitudeReformat/catmullAltitudeLaneEditCatmullSerieRoad';
import CatmullAltitudeLaneEditConnectionRoadTransaction from './catmullAltitudeReformat/catmullAltitudeLaneEditConnectionRoad';
import LanePrevNextEditConnectionRoadTransaction from './lanePrevNextEdit/lanePrevNextEditConnectionRoad';
import CatmullExtendCatmullSerieRoadTransaction from './catmullExtend/catmullExtendCatmullSerieRoad';

// junction
import CreateJunctionTransaction from './junction/createJunction';
import RemoveJunctionTransaction from './junction/removeJunction';
import CreateJunctionConnectionRoadTransaction from './junction/createJunctionConnectionRoad';
import CatmullEditJunctionEdgeTransaction from './junction/catmullEditJunctionEdge';
import CatmullAltitudeEditJunctionEdgeTransaction from './junction/catmullAltitudeEditJunctionEdge';
import CatmullAlterJunctionEdgeCatmullSerieJunctionTransaction from './junction/catmullAlterJunctionEdgeCatmullSerieJunction';

// road property
import RoadTransparencyEditTransaction from './roadProperty/roadTransparencyEdit';
import RoadConnectionTransparencyEditTransaction from './roadProperty/roadConnectionTransparencyEdit';
import RoadAttributeEditTransaction from './roadProperty/roadAttributeEdit';
import RoadLaneAttributeEditTransaction from './roadProperty/roadLaneAttributeEdit';
import RoadLaneLineInnerAttributeEditTransaction from './roadProperty/roadLaneLineInnerAttributeEdit';
import RoadLaneLineOuterAttributeEditTransaction from './roadProperty/roadLaneLineOuterAttributeEdit';
import RoadLaneLineItemLaneBoundaryTypeEditTransaction from './roadProperty/roadLaneLineItemLaneBoundaryTypeEdit';
import RoadConnectionAttributeEditTransaction from './roadProperty/roadConnectionAttributeEdit';
import RoadConnectionLaneAttributeEditTransaction from './roadProperty/roadConnectionLaneAttributeEdit';
import RoadConnectionLaneLineInnerAttributeEditTransaction from './roadProperty/roadConnectionLaneLineInnerAttributeEdit';
import RoadConnectionLaneLineOuterAttributeEditTransaction from './roadProperty/roadConnectionLaneLineOuterAttributeEdit';
import RoadConnectionLaneLineItemLaneBoundaryTypeEditTransaction from './roadProperty/roadConnectionLaneLineItemLaneBoundaryTypeEdit';

// Junction property
import JunctionAttributeEditTransaction from './junctionProperty/junctionAttributeEdit';

// Signal
import CreateSignalTransaction from './signal/createSignal';
import RemoveSignalTransaction from './signal/removeSignal';
import SignalAttributeEditTransaction from './signal/signalAttributeEdit';
import ReformatSignalByGeometryTransaction from './signal/reformatSignalByGeometry';
import ReformatSignalBySignalTypeTransaction from './signal/reformatSignalBySignalType';
import ReformatSignalBySubSignalTypeTransaction from './signal/reformatSignalBySubSignalType';

// Composition
import CatmullAltitudeReformatCatmullSerieRoadCompTransaction from './composition/catmullAltitudeReformat/catmullAltitudeReformatCatmullSerieRoadComp';
import CatmullAltitudeReformatConnectionRoadCompTransaction from './composition/catmullAltitudeReformat/catmullAltitudeReformatConnectionRoadComp';
import CatmullAltitudeLaneEditCatmullSerieRoadCompTransaction from './composition/catmullAltitudeLaneEdit/catmullAltitudeLaneEditCatmullSerieRoadComp';


export enum TransactionType {
  CreateTwoStraightLine,
  CreateThreeCircleCurve,
  CreateQuadraticBezierCurve,
  CreateCubicBezierCurve,
  CreateTwoStraightLineRoad,
  CreateThreeCircleCurveRoad,
  CreateQuadraticBezierCurveRoad,
  CreateCubicBezierCurveRoad,
  CreateCatmullSerieRoad,
  CreateConnectionRoad,
  RemoveTwoStraightLineRoad,
  RemoveThreeCircleCurveRoad,
  RemoveQuadraticBezierCurveRoad,
  RemoveCubicBezierCurveRoad,
  RemoveCatmullSerieRoad,
  RemoveConnectionRoad,
  LaneWidthEditTwoStraightLineRoad,
  LaneWidthEditThreeCircleCurveRoad,
  LaneWidthEditQuadraticBezierCurveRoad,
  LaneWidthEditCubicBezierCurveRoad,
  LaneWidthEditCatmullSerieRoad,
  AddLaneTwoStraightLineRoad,
  AddLaneThreeCircleCurveRoad,
  AddLaneQuadraticBezierCurveRoad,
  AddLaneCubicBezierCurveRoad,
  AddLaneCatmullSerieRoad,
  AddLaneConnectionRoad,
  RemoveLaneTwoStraightLineRoad,
  RemoveLaneThreeCircleCurveRoad,
  RemoveLaneQuadraticBezierCurveRoad,
  RemoveLaneCubicBezierCurveRoad,
  RemoveLaneCatmullSerieRoad,
  RemoveLaneConnectionRoad,
  CatmullEditTwoStraightLineRoad,
  CatmullEditThreeCircleCurveRoad,
  CatmullEditQuadraticBezierCurveRoad,
  CatmullEditCubicBezierCurveRoad,
  CatmullEditCatmullSerieRoad,
  CatmullEditConnectionRoad,
  CatmullReformatTwoStraightLineRoad,
  CatmullReformatThreeCircleCurveRoad,
  CatmullReformatQuadraticBezierCurveRoad,
  CatmullReformatCubicBezierCurveRoad,
  CatmullReformatCatmullSerieRoad,
  CatmullReformatConnectionRoad,
  CatmullAlterLaneCatmullSerieRoad,
  CatmullAlterLaneConnectionRoad,
  CatmullAltitudeReformatCatmullSerieRoad,
  CatmullAltitudeReformatConnectionRoad,
  CatmullAltitudeLaneEditCatmullSerieRoad,
  CatmullAltitudeLaneEditConnectionRoad,
  LanePrevNextEditConnectionRoad,
  CatmullExtendCatmullSerieRoad,
  CreateJunction,
  RemoveJunction,
  CreateJunctionConnectionRoad,
  CatmullEditJunctionEdge,
  CatmullAltitudeEditJunctionEdge,
  CatmullAlterJunctionEdgeCatmullSerieJunction,
  RoadTransparencyEdit,
  RoadConnectionTransparencyEdit,
  RoadAttributeEdit,
  RoadLaneAttributeEdit,
  RoadLaneLineInnerAttributeEdit,
  RoadLaneLineOuterAttributeEdit,
  RoadLaneLineItemLaneBoundaryTypeEdit,
  RoadConnectionAttributeEdit,
  RoadConnectionLaneAttributeEdit,
  RoadConnectionLaneLineInnerAttributeEdit,
  RoadConnectionLaneLineOuterAttributeEdit,
  RoadConnectionLaneLineItemLaneBoundaryTypeEdit,
  JunctionAttributeEdit,
  CreateSignal,
  RemoveSignal,
  SignalAttributeEdit,
  ReformatSignalByGeometry,
  ReformatSignalBySignalType,
  ReformatSignalBySubSignalType,
  CatmullAltitudeReformatCatmullSerieRoadComp,
  CatmullAltitudeReformatConnectionRoadComp,
  CatmullAltitudeLaneEditCatmullSerieRoadComp,
};

export const TransactionMap = {
  [TransactionType.CreateTwoStraightLine]: CreateTwoStraightLineTransaction,
  [TransactionType.CreateThreeCircleCurve]: CreateThreeCircleCurveTransaction,
  [TransactionType.CreateQuadraticBezierCurve]: CreateQuadraticBezierCurveTransaction,
  [TransactionType.CreateCubicBezierCurve]: CreateCubicBezierCurveTransaction,
  [TransactionType.CreateTwoStraightLineRoad]: CreateTwoStraightLineRoadTransaction,
  [TransactionType.CreateThreeCircleCurveRoad]: CreateThreeCircleCurveRoadTransaction,
  [TransactionType.CreateQuadraticBezierCurveRoad]: CreateQuadraticBezierCurveRoadTransaction,
  [TransactionType.CreateCubicBezierCurveRoad]: CreateCubicBezierCurveRoadTransaction,
  [TransactionType.CreateCatmullSerieRoad]: CreateCatmullSerieRoadTransaction,
  [TransactionType.CreateConnectionRoad]: CreateConnectionRoadTransaction,
  [TransactionType.RemoveTwoStraightLineRoad]: RemoveTwoStraightLineRoadTransaction,
  [TransactionType.RemoveThreeCircleCurveRoad]: RemoveThreeCircleCurveRoadTransaction,
  [TransactionType.RemoveQuadraticBezierCurveRoad]: RemoveQuadraticBezierCurveRoadTransaction,
  [TransactionType.RemoveCubicBezierCurveRoad]: RemoveCubicBezierCurveRoadTransaction,
  [TransactionType.RemoveCatmullSerieRoad]: RemoveCatmullSerieRoadTransaction,
  [TransactionType.RemoveConnectionRoad]: RemoveConnectionRoadTransaction,
  [TransactionType.LaneWidthEditTwoStraightLineRoad]: LaneWidthEditTwoStraightLineRoadTransaction,
  [TransactionType.LaneWidthEditThreeCircleCurveRoad]: LaneWidthEditThreeCircleCurveRoadTransaction,
  [TransactionType.LaneWidthEditQuadraticBezierCurveRoad]: LaneWidthEditQuadraticBezierCurveRoadTransaction,
  [TransactionType.LaneWidthEditCubicBezierCurveRoad]: LaneWidthEditCubicBezierCurveRoadTransaction,
  [TransactionType.LaneWidthEditCatmullSerieRoad]: LaneWidthEditCatmullSerieRoadTransaction,
  [TransactionType.AddLaneTwoStraightLineRoad]: AddLaneTwoStraightLineRoadTransaction,
  [TransactionType.AddLaneThreeCircleCurveRoad]: AddLaneThreeCircleCurveRoadTransaction,
  [TransactionType.AddLaneQuadraticBezierCurveRoad]: AddLaneQuadraticBezierCurveRoadTransaction,
  [TransactionType.AddLaneCubicBezierCurveRoad]: AddLaneCubicBezierCurveRoadTransaction,
  [TransactionType.AddLaneCatmullSerieRoad]: AddLaneCatmullSerieRoadTransaction,
  [TransactionType.AddLaneConnectionRoad]: AddLaneConnectionRoadTransaction,
  [TransactionType.RemoveLaneTwoStraightLineRoad]: RemoveLaneTwoStraightLineRoadTransaction,
  [TransactionType.RemoveLaneThreeCircleCurveRoad]: RemoveLaneThreeCircleCurveRoadTransaction,
  [TransactionType.RemoveLaneQuadraticBezierCurveRoad]: RemoveLaneQuadraticBezierCurveRoadTransaction,
  [TransactionType.RemoveLaneCubicBezierCurveRoad]: RemoveLaneCubicBezierCurveRoadTransaction,
  [TransactionType.RemoveLaneCatmullSerieRoad]: RemoveLaneCatmullSerieRoadTransaction,
  [TransactionType.RemoveLaneConnectionRoad]: RemoveLaneConnectionRoadTransaction,
  [TransactionType.CatmullEditTwoStraightLineRoad]: CatmullEditTwoStraightLineRoadTransaction,
  [TransactionType.CatmullEditThreeCircleCurveRoad]: CatmullEditThreeCircleCurveRoadTransaction,
  [TransactionType.CatmullEditQuadraticBezierCurveRoad]: CatmullEditQuadraticBezierCurveRoadTransaction,
  [TransactionType.CatmullEditCubicBezierCurveRoad]: CatmullEditCubicBezierCurveRoadTransaction,
  [TransactionType.CatmullEditCatmullSerieRoad]: CatmullEditCatmullSerieRoadTransaction,
  [TransactionType.CatmullEditConnectionRoad]: CatmullEditConnectionRoadTransaction,
  [TransactionType.CatmullReformatTwoStraightLineRoad]: CatmullReformatTwoStraightLineRoadTransaction,
  [TransactionType.CatmullReformatThreeCircleCurveRoad]: CatmullReformatThreeCircleCurveRoadTransaction,
  [TransactionType.CatmullReformatQuadraticBezierCurveRoad]: CatmullReformatQuadraticBezierCurveRoadTransaction,
  [TransactionType.CatmullReformatCubicBezierCurveRoad]: CatmullReformatCubicBezierCurveRoadTransaction,
  [TransactionType.CatmullReformatCatmullSerieRoad]: CatmullReformatCatmullSerieRoadTransaction,
  [TransactionType.CatmullReformatConnectionRoad]: CatmullReformatConnectionRoadTransaction,
  [TransactionType.CatmullAlterLaneCatmullSerieRoad]: CatmullAlterLaneCatmullSerieRoadTransaction,
  [TransactionType.CatmullAlterLaneConnectionRoad]: CatmullAlterLaneConnectionRoadTransaction,
  [TransactionType.CatmullAltitudeReformatCatmullSerieRoad]: CatmullAltitudeReformatCatmullSerieRoadTransaction,
  [TransactionType.CatmullAltitudeReformatConnectionRoad]: CatmullAltitudeReformatConnectionRoadTransaction,
  [TransactionType.CatmullAltitudeLaneEditCatmullSerieRoad]: CatmullAltitudeLaneEditCatmullSerieRoadTransaction,
  [TransactionType.CatmullAltitudeLaneEditConnectionRoad]: CatmullAltitudeLaneEditConnectionRoadTransaction,
  [TransactionType.LanePrevNextEditConnectionRoad]: LanePrevNextEditConnectionRoadTransaction,
  [TransactionType.CatmullExtendCatmullSerieRoad]: CatmullExtendCatmullSerieRoadTransaction,
  [TransactionType.CreateJunction]: CreateJunctionTransaction,
  [TransactionType.RemoveJunction]: RemoveJunctionTransaction,
  [TransactionType.CreateJunctionConnectionRoad]: CreateJunctionConnectionRoadTransaction,
  [TransactionType.CatmullEditJunctionEdge]: CatmullEditJunctionEdgeTransaction,
  [TransactionType.CatmullAltitudeEditJunctionEdge]: CatmullAltitudeEditJunctionEdgeTransaction,
  [TransactionType.CatmullAlterJunctionEdgeCatmullSerieJunction]: CatmullAlterJunctionEdgeCatmullSerieJunctionTransaction,
  [TransactionType.RoadTransparencyEdit]: RoadTransparencyEditTransaction,
  [TransactionType.RoadConnectionTransparencyEdit]: RoadConnectionTransparencyEditTransaction,
  [TransactionType.RoadAttributeEdit]: RoadAttributeEditTransaction,
  [TransactionType.RoadLaneAttributeEdit]: RoadLaneAttributeEditTransaction,
  [TransactionType.RoadLaneLineInnerAttributeEdit]: RoadLaneLineInnerAttributeEditTransaction,
  [TransactionType.RoadLaneLineOuterAttributeEdit]: RoadLaneLineOuterAttributeEditTransaction,
  [TransactionType.RoadLaneLineItemLaneBoundaryTypeEdit]: RoadLaneLineItemLaneBoundaryTypeEditTransaction, 
  [TransactionType.RoadConnectionAttributeEdit]: RoadConnectionAttributeEditTransaction,
  [TransactionType.RoadConnectionLaneAttributeEdit]: RoadConnectionLaneAttributeEditTransaction,
  [TransactionType.RoadConnectionLaneLineInnerAttributeEdit]: RoadConnectionLaneLineInnerAttributeEditTransaction,
  [TransactionType.RoadConnectionLaneLineOuterAttributeEdit]: RoadConnectionLaneLineOuterAttributeEditTransaction,
  [TransactionType.RoadConnectionLaneLineItemLaneBoundaryTypeEdit]: RoadConnectionLaneLineItemLaneBoundaryTypeEditTransaction,
  [TransactionType.JunctionAttributeEdit]: JunctionAttributeEditTransaction,
  [TransactionType.CreateSignal]: CreateSignalTransaction,
  [TransactionType.RemoveSignal]: RemoveSignalTransaction,
  [TransactionType.SignalAttributeEdit]: SignalAttributeEditTransaction,
  [TransactionType.ReformatSignalByGeometry]: ReformatSignalByGeometryTransaction,
  [TransactionType.ReformatSignalBySignalType]: ReformatSignalBySignalTypeTransaction,
  [TransactionType.ReformatSignalBySubSignalType]: ReformatSignalBySubSignalTypeTransaction,
  [TransactionType.CatmullAltitudeReformatCatmullSerieRoadComp]: CatmullAltitudeReformatCatmullSerieRoadCompTransaction,
  [TransactionType.CatmullAltitudeReformatConnectionRoadComp]: CatmullAltitudeReformatConnectionRoadCompTransaction,
  [TransactionType.CatmullAltitudeLaneEditCatmullSerieRoadComp]: CatmullAltitudeLaneEditCatmullSerieRoadCompTransaction,
};