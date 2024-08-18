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
  LaneItemKeyInfo,
  AddLaneSide,
} from '../../plugins/statusManager/type';
import {
  AtlasRoad,
  AtlasLane,
  AtlasLaneBoundaryType,
} from '../../plugins/atlasConverter/type';
import {
  UpdateOneSideLanesRoadEvent,
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import { LineType } from '../../plugins/lineDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  InvokeAddLaneCatmullSerieRoadEvent,
  InvokeRemoveLaneCatmullSerieRoadEvent,
} from '../event';


export default class AddLaneCatmullSerieRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private roadId: string;
  private roadCategory: RoadCategory;
  private laneSide: LaneSide;
  private laneIndex: number;
  private addLaneSide: AddLaneSide;

  private lastUnchangedLaneIndex?: number;
  private roadItem?: RoadItem;
  private currentGeneralLaneIndex?: number;
  private oldLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private oldOppoLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private newLaneItemsKeyInfo?: LaneItemKeyInfo[];

  private createdLaneId?: string;

  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
    this.laneSide = (options as unknown as { laneSide: LaneSide }).laneSide;
    this.laneIndex = (options as unknown as { laneIndex: number }).laneIndex;
    this.addLaneSide = (options as unknown as { addLaneSide: AddLaneSide }).addLaneSide;
  }

  commit() {
    super.commit();

    this.preValidateRoad(this.roadId, this.roadCategory);

    this.resolveNecessaryInfo();
    this.addLane();

    this.postValidateRoad(this.roadId, this.roadCategory);

    this.dispatchInvalidRoadEvent(this.roadId, this.roadCategory);

    return { roadId: this.roadId };
  }

  onUndo() {
    super.onUndo();

    this.removeLane();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.addLane();

    this.dispatchInvalidRoadEvent(this.roadId, this.roadCategory);
  }

  resolveNecessaryInfo() {
    if (this.laneIndex === -1) {
      // add to refline right
      this.lastUnchangedLaneIndex = -1;
    } else if (this.addLaneSide === AddLaneSide.Left) {
      // add to next left === add to prev right
      this.lastUnchangedLaneIndex = this.laneIndex - 1;
    } else {
      // normal index
      this.lastUnchangedLaneIndex = this.laneIndex;
    }

    this.roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;

    if (this.currentGeneralLaneIndex === undefined) {
      if (this.laneSide === LaneSide.Left) {
        this.currentGeneralLaneIndex = this.roadItem.generalLeftLaneIndex;
        this.roadItem.generalLeftLaneIndex++;
      } else {
        this.currentGeneralLaneIndex = this.roadItem.generalRightLaneIndex;
        this.roadItem.generalRightLaneIndex++;
      }
    }

    if (this.laneSide === LaneSide.Left) {
      this.oldLaneItemsKeyInfo = this.roadItem.laneItems.leftLanes.map((l: LaneItem) => {
        return this.scope.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
      });

      this.oldOppoLaneItemsKeyInfo = this.roadItem.laneItems.rightLanes.map((l: LaneItem) => {
        return this.scope.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
      });
    } else {
      this.oldLaneItemsKeyInfo = this.roadItem.laneItems.rightLanes.map((l: LaneItem) => {
        return this.scope.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
      });

      this.oldOppoLaneItemsKeyInfo = this.roadItem.laneItems.leftLanes.map((l: LaneItem) => {
        return this.scope.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
      });
    }

    this.newLaneItemsKeyInfo = this.generateNewKeyInfoFromOldKeyInfo(this.oldLaneItemsKeyInfo, this.oldOppoLaneItemsKeyInfo) as LaneItemKeyInfo[];
  }

  generateNewKeyInfoFromOldKeyInfo(oldLaneItemsKeyInfo: LaneItemKeyInfo[], oldOppoLaneItemsKeyInfo: LaneItemKeyInfo[]) {
    const roadItem = this.roadItem as RoadItem;
    const reflineAltitudeCatmullPoints = [...roadItem.referenceLine.altitudeCatmullPoints];
    const reflineAltitudeCatmullTangents = [...roadItem.referenceLine.altitudeCatmullTangents];

    const lastUnchangedLaneIndex = this.lastUnchangedLaneIndex as number;
    const currentGeneralLaneIndex = this.currentGeneralLaneIndex as number;
    const newLaneItemsKeyInfo = [] as LaneItemKeyInfo[];

    // new lane
    let newLaneItemKeyInfo: LaneItemKeyInfo | undefined = undefined;

    if (this.laneSide === LaneSide.Left) {
      const reflineItemKeyInfo = this.scope.resolveReferenceLineItemKeyInfo(roadItem.referenceLine);
      const refLineSeriePoints = reflineItemKeyInfo.seriePoints;
      const refLineSerieNormals = reflineItemKeyInfo.serieNormals;
      const refLineCatmullPoints = reflineItemKeyInfo.catmullPoints;
      const refLineCatmullTangents = reflineItemKeyInfo.catmullTangents;
      const refLineAltitudeCatmullPoints = reflineItemKeyInfo.altitudeCatmullPoints;
      const refLineAltitudeCatmullTangents = reflineItemKeyInfo.altitudeCatmullTangents;

      let toExtendLaneLineInfo = reflineItemKeyInfo;

      if (lastUnchangedLaneIndex >= 0) {
        toExtendLaneLineInfo = oldLaneItemsKeyInfo[lastUnchangedLaneIndex].laneLines.outerLaneLine;
      } else {
        toExtendLaneLineInfo = reflineItemKeyInfo;
      }

      // boundaryType & boundaryVirtual
      let newBoundaryType = RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType;
      let newBoundaryVirtual = RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual;

      if (lastUnchangedLaneIndex >= 0) {
        const targetLaneLine = oldLaneItemsKeyInfo[lastUnchangedLaneIndex].laneLines.outerLaneLine;

        newBoundaryType = targetLaneLine.atlasLaneBoundaryType;
        newBoundaryVirtual = targetLaneLine.atlasLaneBoundaryVirtual;
      } else {
        const hasOppoLanes = oldOppoLaneItemsKeyInfo.length > 0;

        if (hasOppoLanes) {
          const targetLaneLine = oldOppoLaneItemsKeyInfo[0].laneLines.innerLaneLine;

          newBoundaryType = targetLaneLine.atlasLaneBoundaryType;
          newBoundaryVirtual = targetLaneLine.atlasLaneBoundaryVirtual;
        } else {
          newBoundaryType = RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType;
          newBoundaryVirtual = RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual;
        }
      }

      // inner
      let innerLaneLineCatmullPoints_raw: Vector3[] = [];
      let innerLaneLineCatmullTangents_raw: Vector3[] = [];
      let innerLaneLineSeriePoints_raw: Vector3[] = [];
      let innerLaneLineAltitudeCatmullPoints: Vector3[] = [];
      let innerLaneLineAltitudeCatmullTangents: Vector3[] = [];

      if (lastUnchangedLaneIndex >= 0) {
        const lastUnchangedLaneItemKeyInfo = oldLaneItemsKeyInfo[lastUnchangedLaneIndex];

        innerLaneLineCatmullPoints_raw = [...lastUnchangedLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints];
        innerLaneLineCatmullTangents_raw = [...lastUnchangedLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents];

        innerLaneLineAltitudeCatmullPoints = [...lastUnchangedLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullPoints];
        innerLaneLineAltitudeCatmullTangents = [...lastUnchangedLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullTangents];

        innerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(innerLaneLineCatmullPoints_raw, innerLaneLineCatmullTangents_raw, refLineSeriePoints.length);
      } else {
        innerLaneLineCatmullPoints_raw = [...refLineCatmullPoints].reverse();
        innerLaneLineCatmullTangents_raw = [...refLineCatmullTangents].map((tan: Vector3) => {
          return tan.normalize().multiplyByFloats(-1, -1, -1);
        }).reverse();

        innerLaneLineAltitudeCatmullPoints = [...refLineAltitudeCatmullPoints].reverse();
        innerLaneLineAltitudeCatmullTangents = [...refLineAltitudeCatmullTangents].map((tan: Vector3) => {
          return tan.normalize().multiplyByFloats(-1, -1, -1);
        }).reverse();

        innerLaneLineSeriePoints_raw = [...refLineSeriePoints].reverse();
      }

      const appliedInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
        innerLaneLineCatmullPoints_raw,
        innerLaneLineSeriePoints_raw,
        innerLaneLineAltitudeCatmullPoints,
        innerLaneLineAltitudeCatmullTangents,
      );

      const innerLaneLineCatmullPoints = appliedInner.appliedCatmullPoints;
      const innerLaneLineSeriePoints = (lastUnchangedLaneIndex < 0) ? innerLaneLineSeriePoints_raw : appliedInner.appliedSeriePoints;
      const innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;

      // outer
      let outerLaneLineCatmullPoints_raw: Vector3[] = [];
      let outerLaneLineCatmullTangents_raw: Vector3[] = [];
      let outerLaneLineSeriePoints_raw: Vector3[] = [];
      let outerLaneLineAltitudeCatmullPoints: Vector3[] = [];
      let outerLaneLineAltitudeCatmullTangents: Vector3[] = [];

      if (lastUnchangedLaneIndex === oldLaneItemsKeyInfo.length - 1) {
        // add to most outer, generate self outer series by its own inner series
        const resolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(innerLaneLineSeriePoints);
        const innerLaneLineSerieNormals = resolved.serieNormals;
        // fix start and end to refline
        innerLaneLineSerieNormals[0] = refLineSerieNormals[refLineSerieNormals.length - 1].multiplyByFloats(-1, -1, -1);
        innerLaneLineSerieNormals[innerLaneLineSerieNormals.length - 1] = refLineSerieNormals[0].multiplyByFloats(-1, -1, -1);

        const selfInnerCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(innerLaneLineSeriePoints, innerLaneLineCatmullPoints);

        outerLaneLineCatmullPoints_raw = innerLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
          return v.add(innerLaneLineSerieNormals[selfInnerCatmullIndices[idx]].multiplyByFloats(RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth));
        });
        outerLaneLineCatmullTangents_raw = [...innerLaneLineCatmullTangents];

        outerLaneLineAltitudeCatmullPoints = [...innerLaneLineAltitudeCatmullPoints];
        outerLaneLineAltitudeCatmullTangents = [...innerLaneLineAltitudeCatmullTangents];
      } else {
        // add not to most outer, generate self outer series by next inner series
        const originalNextInnerLaneLine = oldLaneItemsKeyInfo[lastUnchangedLaneIndex + 1].laneLines.innerLaneLine;
        const originalNextInnerLaneLineCatmullPoints = originalNextInnerLaneLine.catmullPoints;
        const originalNextInnerLaneLineCatmullTangents = originalNextInnerLaneLine.catmullTangents;
        const originalNextInnerLaneLineAltitudeCatmullPoints = originalNextInnerLaneLine.altitudeCatmullPoints;
        const originalNextInnerLaneLineAltitudeCatmullTangents = originalNextInnerLaneLine.altitudeCatmullTangents;
        const originalNextInnerLaneLineSeriePoints = originalNextInnerLaneLine.seriePoints;

        const resolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(originalNextInnerLaneLineSeriePoints);
        const originalNextInnerLaneLineSerieNormals = resolved.serieNormals;
        // fix start and end to refline
        originalNextInnerLaneLineSerieNormals[0] = refLineSerieNormals[refLineSerieNormals.length - 1].multiplyByFloats(-1, -1, -1);
        originalNextInnerLaneLineSerieNormals[originalNextInnerLaneLineSerieNormals.length - 1] = refLineSerieNormals[0].multiplyByFloats(-1, -1, -1);

        const selfInnerCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(originalNextInnerLaneLineSeriePoints, originalNextInnerLaneLineCatmullPoints);

        outerLaneLineCatmullPoints_raw = originalNextInnerLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
          return v.add(originalNextInnerLaneLineSerieNormals[selfInnerCatmullIndices[idx]].multiplyByFloats(RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth));
        });
        outerLaneLineCatmullTangents_raw = [...originalNextInnerLaneLineCatmullTangents];

        outerLaneLineAltitudeCatmullPoints = [...originalNextInnerLaneLineAltitudeCatmullPoints];
        outerLaneLineAltitudeCatmullTangents = [...originalNextInnerLaneLineAltitudeCatmullTangents];
      }

      outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(outerLaneLineCatmullPoints_raw, outerLaneLineCatmullTangents_raw, refLineSeriePoints.length);

      const appliedOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
        outerLaneLineCatmullPoints_raw,
        outerLaneLineSeriePoints_raw,
        outerLaneLineAltitudeCatmullPoints,
        outerLaneLineAltitudeCatmullTangents,
      );

      const outerLaneLineCatmullPoints = appliedOuter.appliedCatmullPoints;
      const outerLaneLineSeriePoints = appliedOuter.appliedSeriePoints;
      const outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;


      const laneId = `${roadItem.roadId}_0_${currentGeneralLaneIndex}`;

      newLaneItemKeyInfo = {
        laneSide: LaneSide.Left,
        laneWidthEditable: true,
        laneId: `${laneId}`,
        atlasLaneSpeedLimit: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneSpeedLimit,
        atlasLaneType: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneType,
        atlasLaneTurn: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneTurn,
        atlasLaneDirection: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneDirection,
        prevLanes: [],
        nextLanes: [],
        laneLines: {
          innerLaneLine: {
            seriePoints: innerLaneLineSeriePoints,
            category: toExtendLaneLineInfo.category,
            options: {
              ...toExtendLaneLineInfo.options,
              lineId: `${laneId}_Inner_Line`,
            },
            laneLineSide: LaneLineSide.Inner,
            catmullPoints: innerLaneLineCatmullPoints,
            catmullTangents: innerLaneLineCatmullTangents,
            altitudeCatmullPoints: innerLaneLineAltitudeCatmullPoints,
            altitudeCatmullTangents: innerLaneLineAltitudeCatmullTangents,
            atlasLaneBoundaryVirtual: newBoundaryVirtual,
            atlasLaneBoundaryType: newBoundaryType,
          },
          outerLaneLine: {
            seriePoints: outerLaneLineSeriePoints,
            category: toExtendLaneLineInfo.category,
            options: {
              ...toExtendLaneLineInfo.options,
              lineId: `${laneId}_Outer_Line`,
            },
            laneLineSide: LaneLineSide.Outer,
            catmullPoints: outerLaneLineCatmullPoints,
            catmullTangents: outerLaneLineCatmullTangents,
            altitudeCatmullPoints: outerLaneLineAltitudeCatmullPoints,
            altitudeCatmullTangents: outerLaneLineAltitudeCatmullTangents,
            atlasLaneBoundaryVirtual: newBoundaryVirtual,
            atlasLaneBoundaryType: newBoundaryType,
          },
        },
        laneConnectors: {
          laneConnectorStart: {
            seriePoints: [innerLaneLineSeriePoints[0], outerLaneLineSeriePoints[0]],
            category: LineAndCurveCategory.TwoStraightLine,
            options: {
              lineType: LineType.Solid,
              lineColor: RendererConfig.mesh.solidLineColor,
              lineId: `${laneId}_ConnectorStart`,
            },
            laneLineSide: LaneLineSide.ConnectorStart,
            catmullPoints: [innerLaneLineCatmullPoints[0], outerLaneLineCatmullPoints[0]],
            catmullTangents: [innerLaneLineCatmullTangents[0], outerLaneLineCatmullTangents[0]],
            altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[0], outerLaneLineAltitudeCatmullPoints[0]],
            altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[0], outerLaneLineAltitudeCatmullTangents[0]],
            atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
          },
          laneConnectorEnd: {
            seriePoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
            category: LineAndCurveCategory.TwoStraightLine,
            options: {
              lineType: LineType.Solid,
              lineColor: RendererConfig.mesh.solidLineColor,
              lineId: `${laneId}__ConnectorEnd`,
            },
            laneLineSide: LaneLineSide.ConnectorEnd,
            catmullPoints: [innerLaneLineCatmullPoints[innerLaneLineCatmullPoints.length - 1], outerLaneLineCatmullPoints[outerLaneLineCatmullPoints.length - 1]],
            catmullTangents: [innerLaneLineCatmullTangents[innerLaneLineCatmullTangents.length - 1], outerLaneLineCatmullTangents[outerLaneLineCatmullTangents.length - 1]],
            altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[innerLaneLineAltitudeCatmullPoints.length - 1], outerLaneLineAltitudeCatmullPoints[outerLaneLineAltitudeCatmullPoints.length - 1]],
            altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[innerLaneLineAltitudeCatmullTangents.length - 1], outerLaneLineAltitudeCatmullTangents[outerLaneLineAltitudeCatmullTangents.length - 1]],
            atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
          },
        },
      } as LaneItemKeyInfo;
    } else {
      const reflineItemKeyInfo = this.scope.resolveReferenceLineItemKeyInfo(roadItem.referenceLine);
      const refLineSeriePoints = reflineItemKeyInfo.seriePoints;
      const refLineSerieNormals = reflineItemKeyInfo.serieNormals;
      const refLineCatmullPoints = reflineItemKeyInfo.catmullPoints;
      const refLineCatmullTangents = reflineItemKeyInfo.catmullTangents;
      const refLineAltitudeCatmullPoints = reflineItemKeyInfo.altitudeCatmullPoints;
      const refLineAltitudeCatmullTangents = reflineItemKeyInfo.altitudeCatmullTangents;

      let toExtendLaneLineInfo = reflineItemKeyInfo;

      if (lastUnchangedLaneIndex >= 0) {
        toExtendLaneLineInfo = oldLaneItemsKeyInfo[lastUnchangedLaneIndex].laneLines.outerLaneLine;
      } else {
        toExtendLaneLineInfo = reflineItemKeyInfo;
      }

      // boundaryType & boundaryVirtual
      let newBoundaryType = RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType;
      let newBoundaryVirtual = RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual;

      if (lastUnchangedLaneIndex >= 0) {
        const targetLaneLine = oldLaneItemsKeyInfo[lastUnchangedLaneIndex].laneLines.outerLaneLine;

        newBoundaryType = targetLaneLine.atlasLaneBoundaryType;
        newBoundaryVirtual = targetLaneLine.atlasLaneBoundaryVirtual;
      } else {
        const hasOppoLanes = oldOppoLaneItemsKeyInfo.length > 0;

        if (hasOppoLanes) {
          const targetLaneLine = oldOppoLaneItemsKeyInfo[0].laneLines.innerLaneLine;

          newBoundaryType = targetLaneLine.atlasLaneBoundaryType;
          newBoundaryVirtual = targetLaneLine.atlasLaneBoundaryVirtual;
        } else {
          newBoundaryType = RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType;
          newBoundaryVirtual = RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual;
        }
      }

      // inner
      let innerLaneLineCatmullPoints_raw: Vector3[] = [];
      let innerLaneLineCatmullTangents_raw: Vector3[] = [];
      let innerLaneLineSeriePoints_raw: Vector3[] = [];
      let innerLaneLineAltitudeCatmullPoints: Vector3[] = [];
      let innerLaneLineAltitudeCatmullTangents: Vector3[] = [];

      if (lastUnchangedLaneIndex >= 0) {
        const lastUnchangedLaneItemKeyInfo = oldLaneItemsKeyInfo[lastUnchangedLaneIndex];

        innerLaneLineCatmullPoints_raw = [...lastUnchangedLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints];
        innerLaneLineCatmullTangents_raw = [...lastUnchangedLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents];

        innerLaneLineAltitudeCatmullPoints = [...lastUnchangedLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullPoints];
        innerLaneLineAltitudeCatmullTangents = [...lastUnchangedLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullTangents];

        innerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(innerLaneLineCatmullPoints_raw, innerLaneLineCatmullTangents_raw, refLineSeriePoints.length);
      } else {
        innerLaneLineCatmullPoints_raw = [...refLineCatmullPoints];
        innerLaneLineCatmullTangents_raw = [...refLineCatmullTangents].map((tan: Vector3) => {
          return tan.normalize();
        });

        innerLaneLineAltitudeCatmullPoints = [...refLineAltitudeCatmullPoints];
        innerLaneLineAltitudeCatmullTangents = [...refLineAltitudeCatmullTangents].map((tan: Vector3) => {
          return tan.normalize();
        });

        innerLaneLineSeriePoints_raw = [...refLineSeriePoints];
      }

      const appliedInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
        innerLaneLineCatmullPoints_raw,
        innerLaneLineSeriePoints_raw,
        innerLaneLineAltitudeCatmullPoints,
        innerLaneLineAltitudeCatmullTangents,
      );

      const innerLaneLineCatmullPoints = appliedInner.appliedCatmullPoints;
      const innerLaneLineSeriePoints = (lastUnchangedLaneIndex < 0) ? innerLaneLineSeriePoints_raw : appliedInner.appliedSeriePoints;
      const innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;

      // outer
      let outerLaneLineCatmullPoints_raw: Vector3[] = [];
      let outerLaneLineCatmullTangents_raw: Vector3[] = [];
      let outerLaneLineSeriePoints_raw: Vector3[] = [];
      let outerLaneLineAltitudeCatmullPoints: Vector3[] = [];
      let outerLaneLineAltitudeCatmullTangents: Vector3[] = [];

      if (lastUnchangedLaneIndex === oldLaneItemsKeyInfo.length - 1) {
        // add to most outer, generate self outer series by its own inner series
        const resolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(innerLaneLineSeriePoints);
        const innerLaneLineSerieNormals = resolved.serieNormals;
        // fix start and end to refline
        innerLaneLineSerieNormals[0] = refLineSerieNormals[0];
        innerLaneLineSerieNormals[innerLaneLineSerieNormals.length - 1] = refLineSerieNormals[refLineSerieNormals.length - 1];

        const selfInnerCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(innerLaneLineSeriePoints, innerLaneLineCatmullPoints);

        outerLaneLineCatmullPoints_raw = innerLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
          return v.add(innerLaneLineSerieNormals[selfInnerCatmullIndices[idx]].multiplyByFloats(RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth));
        });
        outerLaneLineCatmullTangents_raw = [...innerLaneLineCatmullTangents];

        outerLaneLineAltitudeCatmullPoints = [...innerLaneLineAltitudeCatmullPoints];
        outerLaneLineAltitudeCatmullTangents = [...innerLaneLineAltitudeCatmullTangents];
      } else {
        // add not to most outer, generate self outer series by next inner series
        const originalNextInnerLaneLine = oldLaneItemsKeyInfo[lastUnchangedLaneIndex + 1].laneLines.innerLaneLine;
        const originalNextInnerLaneLineCatmullPoints = originalNextInnerLaneLine.catmullPoints;
        const originalNextInnerLaneLineCatmullTangents = originalNextInnerLaneLine.catmullTangents;
        const originalNextInnerLaneLineAltitudeCatmullPoints = originalNextInnerLaneLine.altitudeCatmullPoints;
        const originalNextInnerLaneLineAltitudeCatmullTangents = originalNextInnerLaneLine.altitudeCatmullTangents;
        const originalNextInnerLaneLineSeriePoints = originalNextInnerLaneLine.seriePoints;

        const resolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(originalNextInnerLaneLineSeriePoints);
        const originalNextInnerLaneLineSerieNormals = resolved.serieNormals;
        // fix start and end to refline
        originalNextInnerLaneLineSerieNormals[0] = refLineSerieNormals[0];
        originalNextInnerLaneLineSerieNormals[originalNextInnerLaneLineSerieNormals.length - 1] = refLineSerieNormals[refLineSerieNormals.length - 1];

        const selfInnerCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(originalNextInnerLaneLineSeriePoints, originalNextInnerLaneLineCatmullPoints);

        outerLaneLineCatmullPoints_raw = originalNextInnerLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
          return v.add(originalNextInnerLaneLineSerieNormals[selfInnerCatmullIndices[idx]].multiplyByFloats(RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth));
        });
        outerLaneLineCatmullTangents_raw = [...originalNextInnerLaneLineCatmullTangents];

        outerLaneLineAltitudeCatmullPoints = [...originalNextInnerLaneLineAltitudeCatmullPoints];
        outerLaneLineAltitudeCatmullTangents = [...originalNextInnerLaneLineAltitudeCatmullTangents];
      }

      outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(outerLaneLineCatmullPoints_raw, outerLaneLineCatmullTangents_raw, refLineSeriePoints.length);

      const appliedOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
        outerLaneLineCatmullPoints_raw,
        outerLaneLineSeriePoints_raw,
        outerLaneLineAltitudeCatmullPoints,
        outerLaneLineAltitudeCatmullTangents,
      );

      const outerLaneLineCatmullPoints = appliedOuter.appliedCatmullPoints;
      const outerLaneLineSeriePoints = appliedOuter.appliedSeriePoints;
      const outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;


      const laneId = `${roadItem.roadId}_0_${-currentGeneralLaneIndex}`;

      newLaneItemKeyInfo = {
        laneSide: LaneSide.Right,
        laneWidthEditable: true,
        laneId: `${laneId}`,
        atlasLaneSpeedLimit: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneSpeedLimit,
        atlasLaneType: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneType,
        atlasLaneTurn: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneTurn,
        atlasLaneDirection: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneDirection,
        prevLanes: [],
        nextLanes: [],
        laneLines: {
          innerLaneLine: {
            seriePoints: innerLaneLineSeriePoints,
            category: toExtendLaneLineInfo.category,
            options: {
              ...toExtendLaneLineInfo.options,
              lineId: `${laneId}_Inner_Line`,
            },
            laneLineSide: LaneLineSide.Inner,
            catmullPoints: innerLaneLineCatmullPoints,
            catmullTangents: innerLaneLineCatmullTangents,
            altitudeCatmullPoints: innerLaneLineAltitudeCatmullPoints,
            altitudeCatmullTangents: innerLaneLineAltitudeCatmullTangents,
            atlasLaneBoundaryVirtual: newBoundaryVirtual,
            atlasLaneBoundaryType: newBoundaryType,
          },
          outerLaneLine: {
            seriePoints: outerLaneLineSeriePoints,
            category: toExtendLaneLineInfo.category,
            options: {
              ...toExtendLaneLineInfo.options,
              lineId: `${laneId}_Outer_Line`,
            },
            laneLineSide: LaneLineSide.Outer,
            catmullPoints: outerLaneLineCatmullPoints,
            catmullTangents: outerLaneLineCatmullTangents,
            altitudeCatmullPoints: outerLaneLineAltitudeCatmullPoints,
            altitudeCatmullTangents: outerLaneLineAltitudeCatmullTangents,
            atlasLaneBoundaryVirtual: newBoundaryVirtual,
            atlasLaneBoundaryType: newBoundaryType,
          },
        },
        laneConnectors: {
          laneConnectorStart: {
            seriePoints: [innerLaneLineSeriePoints[0], outerLaneLineSeriePoints[0]],
            category: LineAndCurveCategory.TwoStraightLine,
            options: {
              lineType: LineType.Solid,
              lineColor: RendererConfig.mesh.solidLineColor,
              lineId: `${laneId}_ConnectorStart`,
            },
            laneLineSide: LaneLineSide.ConnectorStart,
            catmullPoints: [innerLaneLineCatmullPoints[0], outerLaneLineCatmullPoints[0]],
            catmullTangents: [innerLaneLineCatmullTangents[0], outerLaneLineCatmullTangents[0]],
            altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[0], outerLaneLineAltitudeCatmullPoints[0]],
            altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[0], outerLaneLineAltitudeCatmullTangents[0]],
            atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
          },
          laneConnectorEnd: {
            seriePoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
            category: LineAndCurveCategory.TwoStraightLine,
            options: {
              lineType: LineType.Solid,
              lineColor: RendererConfig.mesh.solidLineColor,
              lineId: `${laneId}__ConnectorEnd`,
            },
            laneLineSide: LaneLineSide.ConnectorEnd,
            catmullPoints: [innerLaneLineCatmullPoints[innerLaneLineCatmullPoints.length - 1], outerLaneLineCatmullPoints[outerLaneLineCatmullPoints.length - 1]],
            catmullTangents: [innerLaneLineCatmullTangents[innerLaneLineCatmullTangents.length - 1], outerLaneLineCatmullTangents[outerLaneLineCatmullTangents.length - 1]],
            altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[innerLaneLineAltitudeCatmullPoints.length - 1], outerLaneLineAltitudeCatmullPoints[outerLaneLineAltitudeCatmullPoints.length - 1]],
            altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[innerLaneLineAltitudeCatmullTangents.length - 1], outerLaneLineAltitudeCatmullTangents[outerLaneLineAltitudeCatmullTangents.length - 1]],
            atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
          },
        },
      } as LaneItemKeyInfo;
    }

    // store lane id
    this.createdLaneId = newLaneItemKeyInfo?.laneId;


    // generate new lanes
    // inner most, add new lane first
    if (lastUnchangedLaneIndex === -1) {
      newLaneItemsKeyInfo.push(newLaneItemKeyInfo);
    }

    oldLaneItemsKeyInfo.forEach((oldLaneItemKeyInfo: LaneItemKeyInfo, idx: number) => {
      if (idx < lastUnchangedLaneIndex) {
        // push lane itself
        newLaneItemsKeyInfo.push({
          laneSide: oldLaneItemKeyInfo.laneSide,
          laneWidthEditable: oldLaneItemKeyInfo.laneWidthEditable,
          laneId: oldLaneItemKeyInfo.laneId,
          atlasLaneSpeedLimit: oldLaneItemKeyInfo.atlasLaneSpeedLimit,
          atlasLaneType: oldLaneItemKeyInfo.atlasLaneType,
          atlasLaneTurn: oldLaneItemKeyInfo.atlasLaneTurn,
          atlasLaneDirection: oldLaneItemKeyInfo.atlasLaneDirection,
          prevLanes: [...oldLaneItemKeyInfo.prevLanes],
          nextLanes: [...oldLaneItemKeyInfo.nextLanes],
          laneLines: {
            innerLaneLine: {
              seriePoints: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints],
              category: oldLaneItemKeyInfo.laneLines.innerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.innerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.innerLaneLine.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints],
              catmullTangents: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents],
              altitudeCatmullPoints: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullPoints],
              altitudeCatmullTangents: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullTangents],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints],
              category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints],
              catmullTangents: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents],
              altitudeCatmullPoints: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullPoints],
              altitudeCatmullTangents: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullTangents],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryType,
            },
          },
          laneConnectors: {
            laneConnectorStart: {
              seriePoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.seriePoints],
              category: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.category,
              options: { ...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.options },
              laneLineSide: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.catmullPoints],
              catmullTangents: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.catmullTangents],
              altitudeCatmullPoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.altitudeCatmullPoints],
              altitudeCatmullTangents: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.altitudeCatmullTangents],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryType,
            },
            laneConnectorEnd: {
              seriePoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.seriePoints],
              category: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.category,
              options: { ...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.options },
              laneLineSide: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.catmullPoints],
              catmullTangents: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.catmullTangents],
              altitudeCatmullPoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.altitudeCatmullPoints],
              altitudeCatmullTangents: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.altitudeCatmullTangents],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.atlasLaneBoundaryType,
            },
          },
        } as LaneItemKeyInfo);
      } else if (idx === lastUnchangedLaneIndex) {
        // push lane itself and new lane
        newLaneItemsKeyInfo.push({
          laneSide: oldLaneItemKeyInfo.laneSide,
          laneWidthEditable: oldLaneItemKeyInfo.laneWidthEditable,
          laneId: oldLaneItemKeyInfo.laneId,
          atlasLaneSpeedLimit: oldLaneItemKeyInfo.atlasLaneSpeedLimit,
          atlasLaneType: oldLaneItemKeyInfo.atlasLaneType,
          atlasLaneTurn: oldLaneItemKeyInfo.atlasLaneTurn,
          atlasLaneDirection: oldLaneItemKeyInfo.atlasLaneDirection,
          prevLanes: [...oldLaneItemKeyInfo.prevLanes],
          nextLanes: [...oldLaneItemKeyInfo.nextLanes],
          laneLines: {
            innerLaneLine: {
              seriePoints: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints],
              category: oldLaneItemKeyInfo.laneLines.innerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.innerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.innerLaneLine.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints],
              catmullTangents: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents],
              altitudeCatmullPoints: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullPoints],
              altitudeCatmullTangents: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullTangents],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints],
              category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints],
              catmullTangents: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents],
              altitudeCatmullPoints: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullPoints],
              altitudeCatmullTangents: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullTangents],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryType,
            },
          },
          laneConnectors: {
            laneConnectorStart: {
              seriePoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.seriePoints],
              category: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.category,
              options: { ...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.options },
              laneLineSide: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.catmullPoints],
              catmullTangents: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.catmullTangents],
              altitudeCatmullPoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.altitudeCatmullPoints],
              altitudeCatmullTangents: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.altitudeCatmullTangents],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryType,
            },
            laneConnectorEnd: {
              seriePoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.seriePoints],
              category: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.category,
              options: { ...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.options },
              laneLineSide: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.catmullPoints],
              catmullTangents: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.catmullTangents],
              altitudeCatmullPoints: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.altitudeCatmullPoints],
              altitudeCatmullTangents: [...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.altitudeCatmullTangents],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.atlasLaneBoundaryType,
            },
          },
        } as LaneItemKeyInfo);

        newLaneItemsKeyInfo.push(newLaneItemKeyInfo as LaneItemKeyInfo);
      } else if (idx > lastUnchangedLaneIndex) {
        const reflineItemKeyInfo = this.scope.resolveReferenceLineItemKeyInfo(roadItem.referenceLine);
        const refLineSeriePoints = reflineItemKeyInfo.seriePoints;
        const refLineSerieNormals = reflineItemKeyInfo.serieNormals;

        let innerLaneLineCatmullPoints_raw: Vector3[] = [];
        let innerLaneLineCatmullTangents_raw: Vector3[] = [];
        let innerLaneLineSeriePoints_raw: Vector3[] = [];
        let innerLaneLineAltitudeCatmullPoints: Vector3[] = [];
        let innerLaneLineAltitudeCatmullTangents: Vector3[] = [];

        let outerLaneLineCatmullPoints_raw: Vector3[] = [];
        let outerLaneLineCatmullTangents_raw: Vector3[] = [];
        let outerLaneLineSeriePoints_raw: Vector3[] = [];
        let outerLaneLineAltitudeCatmullPoints: Vector3[] = [];
        let outerLaneLineAltitudeCatmullTangents: Vector3[] = [];

        if (this.laneSide === LaneSide.Left) {
          // inner
          const originalInnerLaneLine = oldLaneItemKeyInfo.laneLines.innerLaneLine;
          const originalInnerLaneLineCatmullPoints = originalInnerLaneLine.catmullPoints;
          const originalInnerLaneLineCatmullTangents = originalInnerLaneLine.catmullTangents;
          const originalInnerLaneLineAltitudeCatmullPoints = originalInnerLaneLine.altitudeCatmullPoints;
          const originalInnerLaneLineAltitudeCatmullTangents = originalInnerLaneLine.altitudeCatmullTangents;
          const originalInnerLaneLineSeriePoints = originalInnerLaneLine.seriePoints;

          const innerResolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(originalInnerLaneLineSeriePoints);
          const originalInnerLaneLineSerieNormals = innerResolved.serieNormals;
          // fix start and end to refline
          originalInnerLaneLineSerieNormals[0] = refLineSerieNormals[refLineSerieNormals.length - 1].multiplyByFloats(-1, -1, -1);
          originalInnerLaneLineSerieNormals[originalInnerLaneLineSerieNormals.length - 1] = refLineSerieNormals[0].multiplyByFloats(-1, -1, -1);

          const selfInnerCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(originalInnerLaneLineSeriePoints, originalInnerLaneLineCatmullPoints);

          innerLaneLineCatmullPoints_raw = originalInnerLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
            return v.add(originalInnerLaneLineSerieNormals[selfInnerCatmullIndices[idx]].multiplyByFloats(RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth));
          });
          innerLaneLineCatmullTangents_raw = [...originalInnerLaneLineCatmullTangents];

          innerLaneLineAltitudeCatmullPoints = [...originalInnerLaneLineAltitudeCatmullPoints];
          innerLaneLineAltitudeCatmullTangents = [...originalInnerLaneLineAltitudeCatmullTangents];

          // outer
          const originalOuterLaneLine = oldLaneItemKeyInfo.laneLines.outerLaneLine;
          const originalOuterLaneLineCatmullPoints = originalOuterLaneLine.catmullPoints;
          const originalOuterLaneLineCatmullTangents = originalOuterLaneLine.catmullTangents;
          const originalOuterLaneLineAltitudeCatmullPoints = originalOuterLaneLine.altitudeCatmullPoints;
          const originalOuterLaneLineAltitudeCatmullTangents = originalOuterLaneLine.altitudeCatmullTangents;
          const originalOuterLaneLineSeriePoints = originalOuterLaneLine.seriePoints;

          const outerResolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(originalOuterLaneLineSeriePoints);
          const originalOuterLaneLineSerieNormals = outerResolved.serieNormals;
          // fix start and end to refline
          originalOuterLaneLineSerieNormals[0] = refLineSerieNormals[refLineSerieNormals.length - 1].multiplyByFloats(-1, -1, -1);
          originalOuterLaneLineSerieNormals[originalOuterLaneLineSerieNormals.length - 1] = refLineSerieNormals[0].multiplyByFloats(-1, -1, -1);

          const selfOuterCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(originalOuterLaneLineSeriePoints, originalOuterLaneLineCatmullPoints);

          outerLaneLineCatmullPoints_raw = originalOuterLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
            return v.add(originalOuterLaneLineSerieNormals[selfOuterCatmullIndices[idx]].multiplyByFloats(RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth));
          });
          outerLaneLineCatmullTangents_raw = [...originalOuterLaneLineCatmullTangents];

          outerLaneLineAltitudeCatmullPoints = [...originalOuterLaneLineAltitudeCatmullPoints];
          outerLaneLineAltitudeCatmullTangents = [...originalOuterLaneLineAltitudeCatmullTangents];
        } else {
          // inner
          const originalInnerLaneLine = oldLaneItemKeyInfo.laneLines.innerLaneLine;
          const originalInnerLaneLineCatmullPoints = originalInnerLaneLine.catmullPoints;
          const originalInnerLaneLineCatmullTangents = originalInnerLaneLine.catmullTangents;
          const originalInnerLaneLineAltitudeCatmullPoints = originalInnerLaneLine.altitudeCatmullPoints;
          const originalInnerLaneLineAltitudeCatmullTangents = originalInnerLaneLine.altitudeCatmullTangents;
          const originalInnerLaneLineSeriePoints = originalInnerLaneLine.seriePoints;

          const innerResolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(originalInnerLaneLineSeriePoints);
          const originalInnerLaneLineSerieNormals = innerResolved.serieNormals;
          // fix start and end to refline
          originalInnerLaneLineSerieNormals[0] = refLineSerieNormals[0];
          originalInnerLaneLineSerieNormals[originalInnerLaneLineSerieNormals.length - 1] = refLineSerieNormals[refLineSerieNormals.length - 1];

          const selfInnerCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(originalInnerLaneLineSeriePoints, originalInnerLaneLineCatmullPoints);

          innerLaneLineCatmullPoints_raw = originalInnerLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
            return v.add(originalInnerLaneLineSerieNormals[selfInnerCatmullIndices[idx]].multiplyByFloats(RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth));
          });
          innerLaneLineCatmullTangents_raw = [...originalInnerLaneLineCatmullTangents];

          innerLaneLineAltitudeCatmullPoints = [...originalInnerLaneLineAltitudeCatmullPoints];
          innerLaneLineAltitudeCatmullTangents = [...originalInnerLaneLineAltitudeCatmullTangents];

          // outer
          const originalOuterLaneLine = oldLaneItemKeyInfo.laneLines.outerLaneLine;
          const originalOuterLaneLineCatmullPoints = originalOuterLaneLine.catmullPoints;
          const originalOuterLaneLineCatmullTangents = originalOuterLaneLine.catmullTangents;
          const originalOuterLaneLineAltitudeCatmullPoints = originalOuterLaneLine.altitudeCatmullPoints;
          const originalOuterLaneLineAltitudeCatmullTangents = originalOuterLaneLine.altitudeCatmullTangents;
          const originalOuterLaneLineSeriePoints = originalOuterLaneLine.seriePoints;

          const outerResolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(originalOuterLaneLineSeriePoints);
          const originalOuterLaneLineSerieNormals = outerResolved.serieNormals;
          // fix start and end to refline
          originalOuterLaneLineSerieNormals[0] = refLineSerieNormals[0];
          originalOuterLaneLineSerieNormals[originalOuterLaneLineSerieNormals.length - 1] = refLineSerieNormals[refLineSerieNormals.length - 1];

          const selfOuterCatmullIndices = this.scope.resolveCatmullSerieLineCatmullIndicesBySeriePoints(originalOuterLaneLineSeriePoints, originalOuterLaneLineCatmullPoints);

          outerLaneLineCatmullPoints_raw = originalOuterLaneLineCatmullPoints.map((v: Vector3, idx: number) => {
            return v.add(originalOuterLaneLineSerieNormals[selfOuterCatmullIndices[idx]].multiplyByFloats(RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth, RendererConfig.mesh.defaultLaneWidth));
          });
          outerLaneLineCatmullTangents_raw = [...originalOuterLaneLineCatmullTangents];

          outerLaneLineAltitudeCatmullPoints = [...originalOuterLaneLineAltitudeCatmullPoints];
          outerLaneLineAltitudeCatmullTangents = [...originalOuterLaneLineAltitudeCatmullTangents];
        }

        // inner
        innerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(innerLaneLineCatmullPoints_raw, innerLaneLineCatmullTangents_raw, refLineSeriePoints.length);

        const appliedInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
          innerLaneLineCatmullPoints_raw,
          innerLaneLineSeriePoints_raw,
          innerLaneLineAltitudeCatmullPoints,
          innerLaneLineAltitudeCatmullTangents,
        );
  
        const innerLaneLineCatmullPoints = appliedInner.appliedCatmullPoints;
        const innerLaneLineSeriePoints = appliedInner.appliedSeriePoints;
        const innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;

        // outer
        outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(outerLaneLineCatmullPoints_raw, outerLaneLineCatmullTangents_raw, refLineSeriePoints.length);

        const appliedOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
          outerLaneLineCatmullPoints_raw,
          outerLaneLineSeriePoints_raw,
          outerLaneLineAltitudeCatmullPoints,
          outerLaneLineAltitudeCatmullTangents,
        );
  
        const outerLaneLineCatmullPoints = appliedOuter.appliedCatmullPoints;
        const outerLaneLineSeriePoints = appliedOuter.appliedSeriePoints;
        const outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;


        newLaneItemsKeyInfo.push({
          laneSide: oldLaneItemKeyInfo.laneSide,
          laneWidthEditable: oldLaneItemKeyInfo.laneWidthEditable,
          laneId: oldLaneItemKeyInfo.laneId,
          atlasLaneSpeedLimit: oldLaneItemKeyInfo.atlasLaneSpeedLimit,
          atlasLaneType: oldLaneItemKeyInfo.atlasLaneType,
          atlasLaneTurn: oldLaneItemKeyInfo.atlasLaneTurn,
          atlasLaneDirection: oldLaneItemKeyInfo.atlasLaneDirection,
          prevLanes: [...oldLaneItemKeyInfo.prevLanes],
          nextLanes: [...oldLaneItemKeyInfo.nextLanes],
          laneLines: {
            innerLaneLine: {
              seriePoints: innerLaneLineSeriePoints,
              category: oldLaneItemKeyInfo.laneLines.innerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.innerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.innerLaneLine.laneLineSide,
              catmullPoints: innerLaneLineCatmullPoints,
              catmullTangents: innerLaneLineCatmullTangents,
              altitudeCatmullPoints: innerLaneLineAltitudeCatmullPoints,
              altitudeCatmullTangents: innerLaneLineAltitudeCatmullTangents,
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: outerLaneLineSeriePoints,
              category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
              catmullPoints: outerLaneLineCatmullPoints,
              catmullTangents: outerLaneLineCatmullTangents,
              altitudeCatmullPoints: outerLaneLineAltitudeCatmullPoints,
              altitudeCatmullTangents: outerLaneLineAltitudeCatmullTangents,
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryType,
            },
          },
          laneConnectors: {
            laneConnectorStart: {
              seriePoints: [innerLaneLineSeriePoints[0], outerLaneLineSeriePoints[0]],
              category: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.category,
              options: { ...oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.options },
              laneLineSide: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.laneLineSide,
              catmullPoints: [innerLaneLineCatmullPoints[0], outerLaneLineCatmullPoints[0]],
              catmullTangents: [innerLaneLineCatmullTangents[0], outerLaneLineCatmullTangents[0]],
              altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[0], outerLaneLineAltitudeCatmullPoints[0]],
              altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[0], outerLaneLineAltitudeCatmullTangents[0]],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryType,
            },
            laneConnectorEnd: {
              seriePoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
              category: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.category,
              options: { ...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.options },
              laneLineSide: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.laneLineSide,
              catmullPoints: [innerLaneLineCatmullPoints[innerLaneLineCatmullPoints.length - 1], outerLaneLineCatmullPoints[outerLaneLineCatmullPoints.length - 1]],
              catmullTangents: [innerLaneLineCatmullTangents[innerLaneLineCatmullTangents.length - 1], outerLaneLineCatmullTangents[outerLaneLineCatmullTangents.length - 1]],
              altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPoints[innerLaneLineAltitudeCatmullPoints.length - 1], outerLaneLineAltitudeCatmullPoints[outerLaneLineAltitudeCatmullPoints.length - 1]],
              altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangents[innerLaneLineAltitudeCatmullTangents.length - 1], outerLaneLineAltitudeCatmullTangents[outerLaneLineAltitudeCatmullTangents.length - 1]],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.atlasLaneBoundaryType,
            },
          },
        } as LaneItemKeyInfo);
      }
    });

    return newLaneItemsKeyInfo;
  }

  addLane() {
    const laneItemsKeyInfo = this.newLaneItemsKeyInfo as LaneItemKeyInfo[];
    const roadItem = this.roadItem as RoadItem;
    const reflineKeyPoints = [...roadItem.referenceLine.points] as Vector3[];

    this.scope.emitEvent(UpdateOneSideLanesRoadEvent, {
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
      laneSide: this.laneSide,
      laneItemsKeyInfo: laneItemsKeyInfo,
      reflineKeyPoints: reflineKeyPoints,
    });

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeAddLaneCatmullSerieRoadEvent, {
      laneId: this.createdLaneId,
    });
  }

  removeLane() {
    const laneItemsKeyInfo = this.oldLaneItemsKeyInfo as LaneItemKeyInfo[];
    const roadItem = this.roadItem as RoadItem;
    const reflineKeyPoints = [...roadItem.referenceLine.points] as Vector3[];

    this.scope.emitEvent(UpdateOneSideLanesRoadEvent, {
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
      laneSide: this.laneSide,
      laneItemsKeyInfo: laneItemsKeyInfo,
      reflineKeyPoints: reflineKeyPoints,
    });

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRemoveLaneCatmullSerieRoadEvent, {
      laneId: this.createdLaneId,
    });
  }
};