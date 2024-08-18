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
  LaneItemKeyInfo,
  RoadItemKeyInfo,
} from '../../plugins/statusManager/type';
import {
  UpdateOneSideLanesRoadEvent,
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import { LineType } from '../../plugins/lineDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  AtlasRoad,
  AtlasLane,
} from '../../plugins/atlasConverter/type';
import {
  InvokeAddLaneConnectionRoadEvent,
  InvokeRemoveLaneConnectionRoadEvent,
} from '../event';

export default class AddLaneConnectionRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;

  private connectionLaneRoadId: string;
  private connectionLaneRoadCategory: RoadCategory;
  private connectionLaneSide: LaneSide;
  private prevLaneId: string;
  private prevLaneRoadId: string;
  private prevLaneRoadCategory: RoadCategory;
  private nextLaneId: string;
  private nextLaneRoadId: string;
  private nextLaneRoadCategory: RoadCategory;

  private connectionRoadItem?: RoadItem;
  private prevLaneRoadItem?: RoadItem;
  private nextLaneRoadItem?: RoadItem;
  private oldLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private newLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private currentGeneralLaneIndex?: number;
  private createdLaneId?: string;
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.connectionLaneRoadId = (options as unknown as { connectionLaneRoadId: string }).connectionLaneRoadId;
    this.connectionLaneRoadCategory = (options as unknown as { connectionLaneRoadCategory: RoadCategory }).connectionLaneRoadCategory;
    this.connectionLaneSide = (options as unknown as { connectionLaneSide: LaneSide }).connectionLaneSide;
    this.prevLaneId = (options as unknown as { prevLaneId: string }).prevLaneId;
    this.prevLaneRoadId = (options as unknown as { prevLaneRoadId: string }).prevLaneRoadId;
    this.prevLaneRoadCategory = (options as unknown as { prevLaneRoadCategory: RoadCategory }).prevLaneRoadCategory;
    this.nextLaneId = (options as unknown as { nextLaneId: string }).nextLaneId;
    this.nextLaneRoadId = (options as unknown as { nextLaneRoadId: string }).nextLaneRoadId;
    this.nextLaneRoadCategory = (options as unknown as { nextLaneRoadCategory: RoadCategory }).nextLaneRoadCategory;
  }

  commit() {
    super.commit();

    this.preValidateRoad(this.connectionLaneRoadId, this.connectionLaneRoadCategory);

    this.resolveNecessaryInfo();
    this.addLane();

    this.postValidateRoad(this.connectionLaneRoadId, this.connectionLaneRoadCategory);

    this.dispatchInvalidRoadEvent(this.connectionLaneRoadId, this.connectionLaneRoadCategory);

    return { roadId: this.connectionLaneRoadId };
  }

  onUndo() {
    super.onUndo();

    this.removeLane();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.addLane();

    this.dispatchInvalidRoadEvent(this.connectionLaneRoadId, this.connectionLaneRoadCategory);
  }

  resolveNecessaryInfo() {
    this.connectionRoadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.connectionLaneRoadId, this.connectionLaneRoadCategory) as RoadItem;
    this.prevLaneRoadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.prevLaneRoadId, this.prevLaneRoadCategory) as RoadItem;
    this.nextLaneRoadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.nextLaneRoadId, this.nextLaneRoadCategory) as RoadItem;

    if (this.currentGeneralLaneIndex === undefined) {
      if (this.connectionLaneSide === LaneSide.Left) {
        this.currentGeneralLaneIndex = this.connectionRoadItem.generalLeftLaneIndex;
        this.connectionRoadItem.generalLeftLaneIndex++;
      } else {
        this.currentGeneralLaneIndex = this.connectionRoadItem.generalRightLaneIndex;
        this.connectionRoadItem.generalRightLaneIndex++;
      }
    }

    if (this.connectionLaneSide === LaneSide.Left) {
      this.oldLaneItemsKeyInfo = this.connectionRoadItem.laneItems.leftLanes.map((l: LaneItem) => {
        return this.scope.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
      });
    } else {
      this.oldLaneItemsKeyInfo = this.connectionRoadItem.laneItems.rightLanes.map((l: LaneItem) => {
        return this.scope.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
      });
    }
    
    this.newLaneItemsKeyInfo = this.generateNewKeyInfoFromOldKeyInfo(this.oldLaneItemsKeyInfo) as LaneItemKeyInfo[];
  }

  generateNewKeyInfoFromOldKeyInfo(oldLaneItemsKeyInfo: LaneItemKeyInfo[]) {
    const connectionRoadItem = this.connectionRoadItem as RoadItem;
    const reflineSeriePoints = connectionRoadItem.referenceLine.seriePoints;
    const toExtendLaneLineInfo = this.scope.resolveReferenceLineItemKeyInfo(connectionRoadItem.referenceLine);
    const currentGeneralLaneIndex = this.currentGeneralLaneIndex as number;
    const reflineAltitudeCatmullPoints = connectionRoadItem.referenceLine.altitudeCatmullPoints;
    const reflineAltitudeCatmullTangents = connectionRoadItem.referenceLine.altitudeCatmullTangents;

    const isInJunction = !!connectionRoadItem.junctionId;
    const newAtlasLaneBoundaryVirtual = isInJunction ? RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryVirtual : RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual;
    const newAtlasLaneBoundaryType = isInJunction ? RendererConfig.laneAttrDefaultValue.roadLaneLineInJunction.atlasLaneBoundaryType : RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType;

    let newLaneItemsKeyInfo = [] as LaneItemKeyInfo[];

    if (this.connectionLaneSide === LaneSide.Left) {
      const prevLanesNew = [{
        laneId: this.prevLaneId,
        roadId: this.prevLaneRoadId,
        roadCategory: this.prevLaneRoadCategory,
      }];

      const nextLanesNew = [{
        laneId: this.nextLaneId,
        roadId: this.nextLaneRoadId,
        roadCategory: this.nextLaneRoadCategory,
      }];

      const newPrevLane = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(
        this.prevLaneId,
        this.prevLaneRoadId,
        this.prevLaneRoadCategory,
      ) as LaneItem;

      const newNextLane = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(
        this.nextLaneId,
        this.nextLaneRoadId,
        this.nextLaneRoadCategory,
      ) as LaneItem;

      // inner
      const rawInnerStartCatmullPoint = newPrevLane.laneLines.innerLaneLine.catmullPoints[newPrevLane.laneLines.innerLaneLine.catmullPoints.length - 1];
      const rawInnerEndCatmullPoint = newNextLane.laneLines.innerLaneLine.catmullPoints[0];
      const innerLaneLineCatmullPointsNew_raw = [
        rawInnerStartCatmullPoint,
        rawInnerEndCatmullPoint,
      ];

      const innerLaneLineCatmullTangentsNew_raw = [
        newPrevLane.laneLines.innerLaneLine.catmullTangents[newPrevLane.laneLines.innerLaneLine.catmullTangents.length - 1],
        newNextLane.laneLines.innerLaneLine.catmullTangents[0],
      ];

      const innerLaneLineSeriePointsNew_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
        innerLaneLineCatmullPointsNew_raw,
        innerLaneLineCatmullTangentsNew_raw,
        reflineSeriePoints.length,
      );

      const rawInnerStartAltitudeCatmullPoint = newPrevLane.laneLines.innerLaneLine.altitudeCatmullPoints[newPrevLane.laneLines.innerLaneLine.altitudeCatmullPoints.length - 1];
      const rawInnerEndAltitudeCatmullPoint = newNextLane.laneLines.innerLaneLine.altitudeCatmullPoints[0];
      const innerLaneLineAltitudeCatmullPointsNew = [
        new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawInnerStartCatmullPoint, rawInnerStartCatmullPoint), 0, rawInnerStartAltitudeCatmullPoint.z),
        new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawInnerEndCatmullPoint, rawInnerStartCatmullPoint), 0, rawInnerEndAltitudeCatmullPoint.z),
      ];

      const innerLaneLineAltitudeCatmullTangentsNew = [
        newPrevLane.laneLines.innerLaneLine.altitudeCatmullTangents[newPrevLane.laneLines.innerLaneLine.altitudeCatmullTangents.length - 1],
        newNextLane.laneLines.innerLaneLine.altitudeCatmullTangents[0],
      ];

      const appliedInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
        innerLaneLineCatmullPointsNew_raw,
        innerLaneLineSeriePointsNew_raw,
        innerLaneLineAltitudeCatmullPointsNew,
        innerLaneLineAltitudeCatmullTangentsNew,
      );

      const innerLaneLineCatmullPointsNew = appliedInner.appliedCatmullPoints;
      const innerLaneLineSeriePointsNew = appliedInner.appliedSeriePoints;
      const innerLaneLineCatmullTangentsNew = innerLaneLineCatmullTangentsNew_raw;


      // outer
      const rawOuterStartCatmullPoint = newPrevLane.laneLines.outerLaneLine.catmullPoints[newPrevLane.laneLines.outerLaneLine.catmullPoints.length - 1];
      const rawOuterEndCatmullPoint = newNextLane.laneLines.outerLaneLine.catmullPoints[0];
      const outerLaneLineCatmullPointsNew_raw = [
        rawOuterStartCatmullPoint,
        rawOuterEndCatmullPoint,
      ];

      const outerLaneLineCatmullTangentsNew_raw = [
        newPrevLane.laneLines.outerLaneLine.catmullTangents[newPrevLane.laneLines.outerLaneLine.catmullTangents.length - 1],
        newNextLane.laneLines.outerLaneLine.catmullTangents[0],
      ];

      const outerLaneLineSeriePointsNew_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
        outerLaneLineCatmullPointsNew_raw,
        outerLaneLineCatmullTangentsNew_raw,
        reflineSeriePoints.length,
      );

      const rawOuterStartAltitudeCatmullPoint = newPrevLane.laneLines.outerLaneLine.altitudeCatmullPoints[newPrevLane.laneLines.outerLaneLine.altitudeCatmullPoints.length - 1];
      const rawOuterEndAltitudeCatmullPoint = newNextLane.laneLines.outerLaneLine.altitudeCatmullPoints[0];
      const outerLaneLineAltitudeCatmullPointsNew = [
        new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawOuterStartCatmullPoint, rawOuterStartCatmullPoint), 0, rawOuterStartAltitudeCatmullPoint.z),
        new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawOuterEndCatmullPoint, rawOuterStartCatmullPoint), 0, rawOuterEndAltitudeCatmullPoint.z),
      ];

      const outerLaneLineAltitudeCatmullTangentsNew = [
        newPrevLane.laneLines.outerLaneLine.altitudeCatmullTangents[newPrevLane.laneLines.outerLaneLine.altitudeCatmullTangents.length - 1],
        newNextLane.laneLines.outerLaneLine.altitudeCatmullTangents[0],
      ];

      const appliedOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
        outerLaneLineCatmullPointsNew_raw,
        outerLaneLineSeriePointsNew_raw,
        outerLaneLineAltitudeCatmullPointsNew,
        outerLaneLineAltitudeCatmullTangentsNew,
      );

      const outerLaneLineCatmullPointsNew = appliedOuter.appliedCatmullPoints;
      const outerLaneLineSeriePointsNew = appliedOuter.appliedSeriePoints;
      const outerLaneLineCatmullTangentsNew = outerLaneLineCatmullTangentsNew_raw;
      

      const laneId = `${connectionRoadItem.roadId}_0_${currentGeneralLaneIndex}`;

      const newLaneItemKeyInfo = {
        laneSide: LaneSide.Left,
        laneWidthEditable: true,
        laneId: `${laneId}`,
        atlasLaneSpeedLimit: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneSpeedLimit,
        atlasLaneType: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneType,
        atlasLaneTurn: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneTurn,
        atlasLaneDirection: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneDirection,
        prevLanes: prevLanesNew,
        nextLanes: nextLanesNew,
        laneLines: {
          innerLaneLine: {
            seriePoints: innerLaneLineSeriePointsNew,
            category: toExtendLaneLineInfo.category,
            options: {
              ...toExtendLaneLineInfo.options,
              lineId: `${laneId}_Inner_Line`,
            },
            laneLineSide: LaneLineSide.Inner,
            catmullPoints: innerLaneLineCatmullPointsNew,
            catmullTangents: innerLaneLineCatmullTangentsNew,
            altitudeCatmullPoints: innerLaneLineAltitudeCatmullPointsNew,
            altitudeCatmullTangents: innerLaneLineAltitudeCatmullTangentsNew,
            atlasLaneBoundaryVirtual: newAtlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: newAtlasLaneBoundaryType,
          },
          outerLaneLine: {
            seriePoints: outerLaneLineSeriePointsNew,
            category: toExtendLaneLineInfo.category,
            options: {
              ...toExtendLaneLineInfo.options,
              lineId: `${laneId}_Outer_Line`,
            },
            laneLineSide: LaneLineSide.Outer,
            catmullPoints: outerLaneLineCatmullPointsNew,
            catmullTangents: outerLaneLineCatmullTangentsNew,
            altitudeCatmullPoints: outerLaneLineAltitudeCatmullPointsNew,
            altitudeCatmullTangents: outerLaneLineAltitudeCatmullTangentsNew,
            atlasLaneBoundaryVirtual: newAtlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: newAtlasLaneBoundaryType,
          },
        },
        laneConnectors: {
          laneConnectorStart: {
            seriePoints: [innerLaneLineSeriePointsNew[0], outerLaneLineSeriePointsNew[0]],
            category: LineAndCurveCategory.TwoStraightLine,
            options: {
              lineType: LineType.Solid,
              lineColor: RendererConfig.mesh.solidLineColor,
              lineId: `${laneId}_ConnectorStart`,
            },
            laneLineSide: LaneLineSide.ConnectorStart,
            catmullPoints: [innerLaneLineCatmullPointsNew[0], outerLaneLineCatmullPointsNew[0]],
            catmullTangents: [innerLaneLineCatmullTangentsNew[0], outerLaneLineCatmullTangentsNew[0]],
            altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPointsNew[0], outerLaneLineAltitudeCatmullPointsNew[0]],
            altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangentsNew[0], outerLaneLineAltitudeCatmullTangentsNew[0]],
            atlasLaneBoundaryVirtual: newAtlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: newAtlasLaneBoundaryType,
          },
          laneConnectorEnd: {
            seriePoints: [innerLaneLineSeriePointsNew[innerLaneLineSeriePointsNew.length - 1], outerLaneLineSeriePointsNew[outerLaneLineSeriePointsNew.length - 1]],
            category: LineAndCurveCategory.TwoStraightLine,
            options: {
              lineType: LineType.Solid,
              lineColor: RendererConfig.mesh.solidLineColor,
              lineId: `${laneId}__ConnectorEnd`,
            },
            laneLineSide: LaneLineSide.ConnectorEnd,
            catmullPoints: [innerLaneLineCatmullPointsNew[innerLaneLineCatmullPointsNew.length - 1], outerLaneLineCatmullPointsNew[outerLaneLineCatmullPointsNew.length - 1]],
            catmullTangents: [innerLaneLineCatmullTangentsNew[innerLaneLineCatmullTangentsNew.length - 1], outerLaneLineCatmullTangentsNew[outerLaneLineCatmullTangentsNew.length - 1]],
            altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPointsNew[innerLaneLineAltitudeCatmullPointsNew.length - 1], outerLaneLineAltitudeCatmullPointsNew[outerLaneLineAltitudeCatmullPointsNew.length - 1]],
            altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangentsNew[innerLaneLineAltitudeCatmullTangentsNew.length - 1], outerLaneLineAltitudeCatmullTangentsNew[outerLaneLineAltitudeCatmullTangentsNew.length - 1]],
            atlasLaneBoundaryVirtual: newAtlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: newAtlasLaneBoundaryType,
          },
        },
      } as LaneItemKeyInfo;

      // store lane id
      this.createdLaneId = newLaneItemKeyInfo.laneId;

      newLaneItemsKeyInfo = oldLaneItemsKeyInfo.map((oldLaneItemKeyInfo: LaneItemKeyInfo, laneIdx: number) => {
        return {
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
        } as LaneItemKeyInfo;
      });

      newLaneItemsKeyInfo.push(newLaneItemKeyInfo);
    } else {
      const prevLanesNew = [{
        laneId: this.prevLaneId,
        roadId: this.prevLaneRoadId,
        roadCategory: this.prevLaneRoadCategory,
      }];

      const nextLanesNew = [{
        laneId: this.nextLaneId,
        roadId: this.nextLaneRoadId,
        roadCategory: this.nextLaneRoadCategory,
      }];

      const newPrevLane = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(
        this.prevLaneId,
        this.prevLaneRoadId,
        this.prevLaneRoadCategory,
      ) as LaneItem;

      const newNextLane = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(
        this.nextLaneId,
        this.nextLaneRoadId,
        this.nextLaneRoadCategory,
      ) as LaneItem;

      // inner
      const rawInnerStartCatmullPoint = newPrevLane.laneLines.innerLaneLine.catmullPoints[newPrevLane.laneLines.innerLaneLine.catmullPoints.length - 1];
      const rawInnerEndCatmullPoint = newNextLane.laneLines.innerLaneLine.catmullPoints[0];
      const innerLaneLineCatmullPointsNew_raw = [
        rawInnerStartCatmullPoint,
        rawInnerEndCatmullPoint,
      ];

      const innerLaneLineCatmullTangentsNew_raw = [
        newPrevLane.laneLines.innerLaneLine.catmullTangents[newPrevLane.laneLines.innerLaneLine.catmullTangents.length - 1],
        newNextLane.laneLines.innerLaneLine.catmullTangents[0],
      ];

      const innerLaneLineSeriePointsNew_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
        innerLaneLineCatmullPointsNew_raw,
        innerLaneLineCatmullTangentsNew_raw,
        reflineSeriePoints.length,
      );

      const rawInnerStartAltitudeCatmullPoint = newPrevLane.laneLines.innerLaneLine.altitudeCatmullPoints[newPrevLane.laneLines.innerLaneLine.altitudeCatmullPoints.length - 1];
      const rawInnerEndAltitudeCatmullPoint = newNextLane.laneLines.innerLaneLine.altitudeCatmullPoints[0];
      const innerLaneLineAltitudeCatmullPointsNew = [
        new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawInnerStartCatmullPoint, rawInnerStartCatmullPoint), 0, rawInnerStartAltitudeCatmullPoint.z),
        new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawInnerEndCatmullPoint, rawInnerStartCatmullPoint), 0, rawInnerEndAltitudeCatmullPoint.z),
      ];

      const innerLaneLineAltitudeCatmullTangentsNew = [
        newPrevLane.laneLines.innerLaneLine.altitudeCatmullTangents[newPrevLane.laneLines.innerLaneLine.altitudeCatmullTangents.length - 1],
        newNextLane.laneLines.innerLaneLine.altitudeCatmullTangents[0],
      ];

      const appliedInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
        innerLaneLineCatmullPointsNew_raw,
        innerLaneLineSeriePointsNew_raw,
        innerLaneLineAltitudeCatmullPointsNew,
        innerLaneLineAltitudeCatmullTangentsNew,
      );

      const innerLaneLineCatmullPointsNew = appliedInner.appliedCatmullPoints;
      const innerLaneLineSeriePointsNew = appliedInner.appliedSeriePoints;
      const innerLaneLineCatmullTangentsNew = innerLaneLineCatmullTangentsNew_raw;


      // outer
      const rawOuterStartCatmullPoint = newPrevLane.laneLines.outerLaneLine.catmullPoints[newPrevLane.laneLines.outerLaneLine.catmullPoints.length - 1];
      const rawOuterEndCatmullPoint = newNextLane.laneLines.outerLaneLine.catmullPoints[0];
      const outerLaneLineCatmullPointsNew_raw = [
        rawOuterStartCatmullPoint,
        rawOuterEndCatmullPoint,
      ];

      const outerLaneLineCatmullTangentsNew_raw = [
        newPrevLane.laneLines.outerLaneLine.catmullTangents[newPrevLane.laneLines.outerLaneLine.catmullTangents.length - 1],
        newNextLane.laneLines.outerLaneLine.catmullTangents[0],
      ];

      const outerLaneLineSeriePointsNew_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
        outerLaneLineCatmullPointsNew_raw,
        outerLaneLineCatmullTangentsNew_raw,
        reflineSeriePoints.length,
      );

      const rawOuterStartAltitudeCatmullPoint = newPrevLane.laneLines.outerLaneLine.altitudeCatmullPoints[newPrevLane.laneLines.outerLaneLine.altitudeCatmullPoints.length - 1];
      const rawOuterEndAltitudeCatmullPoint = newNextLane.laneLines.outerLaneLine.altitudeCatmullPoints[0];
      const outerLaneLineAltitudeCatmullPointsNew = [
        new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawOuterStartCatmullPoint, rawOuterStartCatmullPoint), 0, rawOuterStartAltitudeCatmullPoint.z),
        new Vector3(this.scope.calculateAltitudeXViaPointXWithAlignToFirstPointX(rawOuterEndCatmullPoint, rawOuterStartCatmullPoint), 0, rawOuterEndAltitudeCatmullPoint.z),
      ];

      const outerLaneLineAltitudeCatmullTangentsNew = [
        newPrevLane.laneLines.outerLaneLine.altitudeCatmullTangents[newPrevLane.laneLines.outerLaneLine.altitudeCatmullTangents.length - 1],
        newNextLane.laneLines.outerLaneLine.altitudeCatmullTangents[0],
      ];

      const appliedOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
        outerLaneLineCatmullPointsNew_raw,
        outerLaneLineSeriePointsNew_raw,
        outerLaneLineAltitudeCatmullPointsNew,
        outerLaneLineAltitudeCatmullTangentsNew,
      );

      const outerLaneLineCatmullPointsNew = appliedOuter.appliedCatmullPoints;
      const outerLaneLineSeriePointsNew = appliedOuter.appliedSeriePoints;
      const outerLaneLineCatmullTangentsNew = outerLaneLineCatmullTangentsNew_raw;
      

      const laneId = `${connectionRoadItem.roadId}_0_${-currentGeneralLaneIndex}`;

      const newLaneItemKeyInfo = {
        laneSide: LaneSide.Right,
        laneWidthEditable: true,
        laneId: `${laneId}`,
        atlasLaneSpeedLimit: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneSpeedLimit,
        atlasLaneType: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneType,
        atlasLaneTurn: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneTurn,
        atlasLaneDirection: RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneDirection,
        prevLanes: prevLanesNew,
        nextLanes: nextLanesNew,
        laneLines: {
          innerLaneLine: {
            seriePoints: innerLaneLineSeriePointsNew,
            category: toExtendLaneLineInfo.category,
            options: {
              ...toExtendLaneLineInfo.options,
              lineId: `${laneId}_Inner_Line`,
            },
            laneLineSide: LaneLineSide.Inner,
            catmullPoints: innerLaneLineCatmullPointsNew,
            catmullTangents: innerLaneLineCatmullTangentsNew,
            altitudeCatmullPoints: innerLaneLineAltitudeCatmullPointsNew,
            altitudeCatmullTangents: innerLaneLineAltitudeCatmullTangentsNew,
            atlasLaneBoundaryVirtual: newAtlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: newAtlasLaneBoundaryType,
          },
          outerLaneLine: {
            seriePoints: outerLaneLineSeriePointsNew,
            category: toExtendLaneLineInfo.category,
            options: {
              ...toExtendLaneLineInfo.options,
              lineId: `${laneId}_Outer_Line`,
            },
            laneLineSide: LaneLineSide.Outer,
            catmullPoints: outerLaneLineCatmullPointsNew,
            catmullTangents: outerLaneLineCatmullTangentsNew,
            altitudeCatmullPoints: outerLaneLineAltitudeCatmullPointsNew,
            altitudeCatmullTangents: outerLaneLineAltitudeCatmullTangentsNew,
            atlasLaneBoundaryVirtual: newAtlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: newAtlasLaneBoundaryType,
          },
        },
        laneConnectors: {
          laneConnectorStart: {
            seriePoints: [innerLaneLineSeriePointsNew[0], outerLaneLineSeriePointsNew[0]],
            category: LineAndCurveCategory.TwoStraightLine,
            options: {
              lineType: LineType.Solid,
              lineColor: RendererConfig.mesh.solidLineColor,
              lineId: `${laneId}_ConnectorStart`,
            },
            laneLineSide: LaneLineSide.ConnectorStart,
            catmullPoints: [innerLaneLineCatmullPointsNew[0], outerLaneLineCatmullPointsNew[0]],
            catmullTangents: [innerLaneLineCatmullTangentsNew[0], outerLaneLineCatmullTangentsNew[0]],
            altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPointsNew[0], outerLaneLineAltitudeCatmullPointsNew[0]],
            altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangentsNew[0], outerLaneLineAltitudeCatmullTangentsNew[0]],
            atlasLaneBoundaryVirtual: newAtlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: newAtlasLaneBoundaryType,
          },
          laneConnectorEnd: {
            seriePoints: [innerLaneLineSeriePointsNew[innerLaneLineSeriePointsNew.length - 1], outerLaneLineSeriePointsNew[outerLaneLineSeriePointsNew.length - 1]],
            category: LineAndCurveCategory.TwoStraightLine,
            options: {
              lineType: LineType.Solid,
              lineColor: RendererConfig.mesh.solidLineColor,
              lineId: `${laneId}__ConnectorEnd`,
            },
            laneLineSide: LaneLineSide.ConnectorEnd,
            catmullPoints: [innerLaneLineCatmullPointsNew[innerLaneLineCatmullPointsNew.length - 1], outerLaneLineCatmullPointsNew[outerLaneLineCatmullPointsNew.length - 1]],
            catmullTangents: [innerLaneLineCatmullTangentsNew[innerLaneLineCatmullTangentsNew.length - 1], outerLaneLineCatmullTangentsNew[outerLaneLineCatmullTangentsNew.length - 1]],
            altitudeCatmullPoints: [innerLaneLineAltitudeCatmullPointsNew[innerLaneLineAltitudeCatmullPointsNew.length - 1], outerLaneLineAltitudeCatmullPointsNew[outerLaneLineAltitudeCatmullPointsNew.length - 1]],
            altitudeCatmullTangents: [innerLaneLineAltitudeCatmullTangentsNew[innerLaneLineAltitudeCatmullTangentsNew.length - 1], outerLaneLineAltitudeCatmullTangentsNew[outerLaneLineAltitudeCatmullTangentsNew.length - 1]],
            atlasLaneBoundaryVirtual: newAtlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: newAtlasLaneBoundaryType,
          },
        },
      } as LaneItemKeyInfo;

      // store lane id
      this.createdLaneId = newLaneItemKeyInfo.laneId;

      newLaneItemsKeyInfo = oldLaneItemsKeyInfo.map((oldLaneItemKeyInfo: LaneItemKeyInfo, laneIdx: number) => {
        return {
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
        } as LaneItemKeyInfo;
      });

      newLaneItemsKeyInfo.push(newLaneItemKeyInfo);
    }

    return newLaneItemsKeyInfo;
  }

  addLane() {
    const laneItemsKeyInfo = this.newLaneItemsKeyInfo as LaneItemKeyInfo[];
    const roadItem = this.connectionRoadItem as RoadItem;
    const reflineKeyPoints = [...roadItem.referenceLine.points] as Vector3[];
    const createdLaneId = this.createdLaneId as string;

    this.scope.emitEvent(UpdateOneSideLanesRoadEvent, {
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
      laneSide: this.connectionLaneSide,
      laneItemsKeyInfo: laneItemsKeyInfo,
      reflineKeyPoints: reflineKeyPoints,
    });

    const afterTargetLaneItem = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(createdLaneId, this.connectionLaneRoadId, this.connectionLaneRoadCategory) as LaneItem;
    this.scope.attachLaneInPrevAndNext(afterTargetLaneItem, roadItem);

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeAddLaneConnectionRoadEvent, {
      laneId: createdLaneId,
    });
  }

  removeLane() {
    const laneItemsKeyInfo = this.oldLaneItemsKeyInfo as LaneItemKeyInfo[];
    const roadItem = this.connectionRoadItem as RoadItem;
    const reflineKeyPoints = [...roadItem.referenceLine.points] as Vector3[];
    const createdLaneId = this.createdLaneId as string;

    const beforeTargetLaneItem = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(createdLaneId, this.connectionLaneRoadId, this.connectionLaneRoadCategory) as LaneItem;
    this.scope.detachLaneInPrevAndNext(beforeTargetLaneItem, roadItem);

    this.scope.emitEvent(UpdateOneSideLanesRoadEvent, {
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
      laneSide: this.connectionLaneSide,
      laneItemsKeyInfo: laneItemsKeyInfo,
      reflineKeyPoints: reflineKeyPoints,
    });

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });

    this.scope.emitEvent(InvokeRemoveLaneConnectionRoadEvent, {
      laneId: createdLaneId,
    });
  }
};