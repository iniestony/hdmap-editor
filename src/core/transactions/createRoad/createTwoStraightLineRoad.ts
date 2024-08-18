import {
  Vector3,
  Color3,
  MeshBuilder,
  LinesMesh,
  Mesh,
  Curve3,
} from "@babylonjs/core";
import StandardTransaction from '../general/standard';
import {
  LineAndCurveCategory,
  LineAndCurveItem,
  LaneItem,
  RoadItem,
  RoadCategory,
  LaneSide,
  LaneLineSide,
  MarkerSide,
  LaneLineItem,
  ReferenceLineItem,
} from '../../plugins/statusManager/type';
import {
  StoreRoadEvent, 
  RemoveRoadEvent,
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import { LineType } from '../../plugins/lineDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  AtlasRoad,
  AtlasLane,
  AtlasLaneBoundaryType,
} from '../../plugins/atlasConverter/type';
import {
  InvokeCreateTwoStraightLineRoadEvent,
  InvokeRemoveTwoStraightLineRoadEvent,
} from '../event';

export default class CreateTwoStraightLineRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private meshId: string;
  private points: Vector3[];
  private pointsMesh: Mesh[];
  private referenceLineColor: Color3;
  private referenceLineType: LineType;
  private laneLineColor: Color3;
  private laneLineType: LineType;
  private laneWidth: number;

  private createdRoadItem?: RoadItem;
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.meshId = (options as unknown as { id: string }).id;
    this.points = (options as unknown as { points: Vector3[] }).points;
    this.pointsMesh = (options as unknown as { pointsMesh: Mesh[] }).pointsMesh;
    this.referenceLineColor = (options as unknown as { referenceLineColor: Color3 }).referenceLineColor;
    this.referenceLineType = (options as unknown as { referenceLineType: LineType }).referenceLineType;
    this.laneLineColor = (options as unknown as { laneLineColor: Color3 }).laneLineColor;
    this.laneLineType = (options as unknown as { laneLineType: LineType }).laneLineType;
    this.laneWidth = (options as unknown as { laneWidth: LineType }).laneWidth;
  }

  commit() {
    super.commit();

    const entity = this.createRoad();
    return { entity };
  }

  onUndo() {
    super.onUndo();
    this.removeRoad();
  }

  onRedo() {
    super.onRedo();
    this.createRoad();
  }

  createReferenceLine() {
    const seriePoints = this.scope.resolveStraightSeriePoints(this.points[0], this.points[1]);

    const lineId = `${this.meshId}_ReferenceLine`;
    const line = this.scope.createSolidLine({
      points: [...seriePoints],
      color: this.referenceLineColor,
      id: lineId,
    });

    const drawingPoints = [...seriePoints];
    const resolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(seriePoints);
    const serieTangents = resolved.serieTangents;
    const serieNormals = resolved.serieNormals;

    const catmullPoints = this.scope.resolveCatmullPointsBySeriePoints(seriePoints);

    const referenceLineItem = {
      points: this.points,
      pointsMesh: this.pointsMesh,
      lineAndCurveMesh: line,
      markerDisposed: false,
      category: LineAndCurveCategory.TwoStraightLine,
      drawingPoints,
      seriePoints,
      serieNormals,
      serieTangents,
      options: {
        lineType: this.referenceLineType,
        lineColor: this.referenceLineColor,
        lineId,
      },
      catmullPoints,
    } as ReferenceLineItem;

    this.scope.makeSceneDirty();

    return referenceLineItem;
  }

  createLaneLine(opts: {
    points: Vector3[];
    lineId: string;
    lineAndCurveCategory: LineAndCurveCategory;
    roadItem: RoadItem;
    laneSide: LaneSide;
    isLaneLine: boolean;
    laneLineSide: LaneLineSide;
  }) {
    const seriePoints = [...opts.points];

    const markerStart = this.scope.createMarker(seriePoints[0], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerStart.metadata = {
      markerSide: MarkerSide.Start,
    };

    const markerEnd = this.scope.createMarker(seriePoints[seriePoints.length - 1], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerEnd.metadata = {
      markerSide: MarkerSide.End,
    };

    const line = this.scope.createSolidLine({
      points: [...seriePoints],
      color: this.laneLineColor,
      id: opts.lineId,
    });

    const drawingPoints = [...seriePoints];
    const resolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(seriePoints);
    const serieTangents = resolved.serieTangents;
    const serieNormals = resolved.serieNormals;

    let catmullPoints = [] as Vector3[];
    if (opts.isLaneLine) {
      catmullPoints = this.scope.resolveCatmullPointsBySeriePoints(seriePoints);
    } else {
      catmullPoints = [...seriePoints];
    }

    const laneLineItem = {
      points: [seriePoints[0], seriePoints[seriePoints.length - 1]],
      pointsMesh: [markerStart, markerEnd],
      lineAndCurveMesh: line,
      markerDisposed: true,
      category: opts.lineAndCurveCategory,
      drawingPoints,
      seriePoints,
      serieNormals,
      serieTangents,
      options: {
        lineType: this.laneLineType,
        lineColor: this.laneLineColor,
        lineId: opts.lineId,
      },
      laneLineSide: opts.laneLineSide,
      catmullPoints,
      atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
      atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
    } as LaneLineItem;

    // update marker metadata, dispose finally
    laneLineItem.pointsMesh.forEach((m: Mesh) => {
      m.metadata.belongingLineAndCurveItem = laneLineItem;
      m.dispose();
    });

    this.scope.makeSceneDirty();

    return laneLineItem;
  }

  createLane(innerPoints: Vector3[], outerPoints: Vector3[], roadItem: RoadItem, laneSide: LaneSide) {
    const laneId = `${this.meshId}_0_${laneSide === LaneSide.Left ? roadItem.generalLeftLaneIndex : -roadItem.generalRightLaneIndex}`;

    const innerLaneLine = this.createLaneLine({
      points: [...innerPoints],
      lineId: `${laneId}_Inner_Line`,
      lineAndCurveCategory: LineAndCurveCategory.TwoStraightLine,
      roadItem,
      laneSide,
      isLaneLine: true,
      laneLineSide: LaneLineSide.Inner,
    });

    innerLaneLine.lineAndCurveMesh.forEach((m:Mesh)=>{
      m.metadata = {
        lineAndCurveItem: innerLaneLine,
        belongingRoadItem: roadItem,
      };
    });

    const outerLaneLine = this.createLaneLine({
      points: [...outerPoints],
      lineId: `${laneId}_Outer_Line`,
      lineAndCurveCategory: LineAndCurveCategory.TwoStraightLine,
      roadItem,
      laneSide,
      isLaneLine: true,
      laneLineSide: LaneLineSide.Outer,
    });

    outerLaneLine.lineAndCurveMesh.forEach((m:Mesh)=>{
      m.metadata = {
        lineAndCurveItem: outerLaneLine,
        belongingRoadItem: roadItem,
      };
    });

    const laneConnectorStart = this.createLaneLine({
      points: [innerPoints[0], outerPoints[0]],
      lineId: `${laneId}_ConnectorStart`,
      lineAndCurveCategory: LineAndCurveCategory.TwoStraightLine,
      roadItem,
      laneSide,
      isLaneLine: false,
      laneLineSide: LaneLineSide.ConnectorStart,
    });

    laneConnectorStart.lineAndCurveMesh.forEach((m:Mesh)=>{
      m.metadata = {
        lineAndCurveItem: laneConnectorStart,
        belongingRoadItem: roadItem,
      };
    });

    const laneConnectorEnd = this.createLaneLine({
      points: [innerPoints[innerPoints.length - 1], outerPoints[outerPoints.length - 1]],
      lineId: `${laneId}_ConnectorEnd`,
      lineAndCurveCategory: LineAndCurveCategory.TwoStraightLine,
      roadItem,
      laneSide,
      isLaneLine: false,
      laneLineSide: LaneLineSide.ConnectorEnd,
    });

    laneConnectorEnd.lineAndCurveMesh.forEach((m:Mesh)=>{
      m.metadata = {
        lineAndCurveItem: laneConnectorEnd,
        belongingRoadItem: roadItem,
      };
    });


    const laneLines = { innerLaneLine, outerLaneLine };
    const laneConnectors = { laneConnectorStart, laneConnectorEnd };

    const laneMeshId = `${laneId}__LaneMesh`;
    const laneMesh = this.scope.createRibbonLane({
      innerPoints: [...innerPoints],
      outerPoints: [...outerPoints],
      id: laneMeshId,
    });

    const laneDirectionId = `${laneId}_Direction_Sign`;
    const laneDirectionMeshs = this.scope.createLaneDirectionSign({
      innerPoints: [...innerPoints],
      outerPoints: [...outerPoints],
      id: laneDirectionId,
    });

    if (laneSide === LaneSide.Left) {
      roadItem.generalLeftLaneIndex++;
    } else {
      roadItem.generalRightLaneIndex++;
    }

    const laneItem = {
      laneLines,
      laneConnectors,
      laneMesh,
      laneDirectionMeshs,
      laneSide,
      laneId,
    };

    laneItem.laneMesh.metadata = {
      belongingRoadItem: roadItem,
      belongingLaneItem: laneItem,
    };

    return laneItem;
  }

  createLanes(roadItem: RoadItem, referenceLine: ReferenceLineItem) {
    const refLineSeriePoints = referenceLine.seriePoints;
    const refLineSerieNormals = referenceLine.serieNormals;

    const candidatePointsLeftInner = [...refLineSeriePoints].reverse();
    const candidatePointsLeftOuter = refLineSeriePoints.map((v: Vector3, idx: number) => {
      return v.add(refLineSerieNormals[idx].multiplyByFloats(-this.laneWidth, -this.laneWidth, -this.laneWidth));
    }).reverse();

    const candidatePointsRightInner = [...refLineSeriePoints];
    const candidatePointsRightOuter = refLineSeriePoints.map((v: Vector3, idx: number) => {
      return v.add(refLineSerieNormals[idx].multiplyByFloats(this.laneWidth, this.laneWidth, this.laneWidth));
    });

    const laneleft = this.createLane(candidatePointsLeftInner, candidatePointsLeftOuter, roadItem, LaneSide.Left);
    const laneRight = this.createLane(candidatePointsRightInner, candidatePointsRightOuter, roadItem, LaneSide.Right);

    return {
      leftLanes: [{
        ...laneleft,
        laneWidthEditable: true,
        atlasLaneSpeedLimit: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneSpeedLimit,
        atlasLaneType: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneType,
        atlasLaneTurn: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneTurn,
        atlasLaneDirection: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneDirection,
        prevLanes: [],
        nextLanes: [],
      }],
      rightLanes: [{
        ...laneRight,
        laneWidthEditable: true,
        atlasLaneSpeedLimit: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneSpeedLimit,
        atlasLaneType: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneType,
        atlasLaneTurn: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneTurn,
        atlasLaneDirection: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneDirection,
        prevLanes: [],
        nextLanes: [],
      }],
    };
  }

  createRoad() {
    const referenceLine = this.createReferenceLine();

    const refLineSerieNormals = referenceLine.serieNormals;
    const refLineSerieTangents = referenceLine.serieTangents;

    const startPointNormal = refLineSerieNormals[0];
    const endPointNormal = refLineSerieNormals[refLineSerieNormals.length - 1];
    const startPointTangent = refLineSerieTangents[0];
    const endPointTangent = refLineSerieTangents[refLineSerieTangents.length - 1];

    const roadItem = {
      referenceLine: referenceLine,
      referenceLineEditable: true,
      surfaceLines: [],
      laneItems: {
        leftLanes: [],
        rightLanes: [],
      },
      startPointNormal,
      endPointNormal,
      startPointTangent,
      endPointTangent,
      generalLeftLaneIndex: 1,
      generalRightLaneIndex: 1,
      category: RoadCategory.TwoStraightLineRoad,
      roadId: this.meshId,
      roadPID: this.scope.generatePersistenceID() as string,
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      atlasRoadType: AtlasRoad.Type.CITY_ROAD,
      matAlpha: RendererConfig.scene.defaultRoadMatAlpha,
      prevRoads: [],
      nextRoads: [],
      junctionId: undefined,
    } as RoadItem;

    // attach info to reference line mesh
    referenceLine.lineAndCurveMesh.metadata = {
      lineAndCurveItem: referenceLine,
      belongingRoadItem: roadItem,
    };

    roadItem.laneItems = this.createLanes(roadItem, referenceLine);

    this.createdRoadItem = roadItem;

    this.scope.emitEvent(StoreRoadEvent, roadItem);

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.makeSceneDirty();

    this.scope.emitEvent(InvokeCreateTwoStraightLineRoadEvent, {
      roadId: this.meshId,
    });

    return roadItem;
  }

  removeRoad() {
    const createdRoadItem = this.createdRoadItem as RoadItem;

    this.scope.emitEvent(RemoveRoadEvent, {
      id: createdRoadItem.roadId,
      category: createdRoadItem.category,
    });

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: createdRoadItem.roadPID,
      roadId: createdRoadItem.roadId,
      roadCategory: createdRoadItem.category,
    });

    this.scope.emitEvent(InvokeRemoveTwoStraightLineRoadEvent, {
      roadId: this.meshId,
    });
  }
};