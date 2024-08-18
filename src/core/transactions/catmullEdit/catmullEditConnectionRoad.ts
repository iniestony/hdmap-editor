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
} from '../../plugins/statusManager/type';
import {
  UpdateOneSideLanesRoadEvent,
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  InvokeCatmullEditConnectionRoadEvent,
} from '../event';


export default class CatmullEditConnectionRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private laneId: string;
  private laneSide: LaneSide;
  private laneLineSide: LaneLineSide;
  private newLaneLineCatmullPoints: Vector3[];
  private newLaneLineCatmullTangents: Vector3[];
  private catmullIndex: number;
  private roadId: string;
  private roadCategory: RoadCategory;

  private roadItem?: RoadItem;
  private targetLaneIndex?: number;
  private oldLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private newLaneItemsKeyInfo?: LaneItemKeyInfo[];
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
   
    this.laneId = (options as unknown as { laneId: string }).laneId;
    this.laneSide = (options as unknown as { laneSide: LaneSide }).laneSide;
    this.laneLineSide = (options as unknown as { laneLineSide: LaneLineSide }).laneLineSide;
    this.newLaneLineCatmullPoints = (options as unknown as { newLaneLineCatmullPoints: Vector3[] }).newLaneLineCatmullPoints;
    this.newLaneLineCatmullTangents = (options as unknown as { newLaneLineCatmullTangents: Vector3[] }).newLaneLineCatmullTangents;
    this.catmullIndex = (options as unknown as { catmullIndex: number }).catmullIndex;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
  }

  commit() {
    super.commit();

    this.preValidateRoad(this.roadId, this.roadCategory);

    this.resolveNecessaryInfo();
    this.editNewRoadCatmull();

    this.postValidateRoad(this.roadId, this.roadCategory);

    this.dispatchInvalidRoadEvent(this.roadId, this.roadCategory);

    return { laneId: this.laneId };
  }

  onUndo() {
    super.onUndo();

    this.editOldRoadCatmull();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.editNewRoadCatmull();

    this.dispatchInvalidRoadEvent(this.roadId, this.roadCategory);
  }

  resolveNecessaryInfo() {
    this.roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;

    if (this.laneSide === LaneSide.Left) {
      this.oldLaneItemsKeyInfo = this.roadItem.laneItems.leftLanes.map((l: LaneItem) => {
        return this.scope.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
      });
    } else {
      this.oldLaneItemsKeyInfo = this.roadItem.laneItems.rightLanes.map((l: LaneItem) => {
        return this.scope.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
      });
    }

    this.targetLaneIndex = (this.oldLaneItemsKeyInfo as LaneItemKeyInfo[]).findIndex((laneItemKeyInfo: LaneItemKeyInfo) => {
      return laneItemKeyInfo.laneId === this.laneId;
    });
    
    this.newLaneItemsKeyInfo = this.generateNewKeyInfoFromOldKeyInfo(this.oldLaneItemsKeyInfo) as LaneItemKeyInfo[];
  }

  generateNewKeyInfoFromOldKeyInfo(oldLaneItemsKeyInfo: LaneItemKeyInfo[]) {
    const targetLaneIndex = this.targetLaneIndex as number;
    const targetLaneLineCatmullPoints = [...this.newLaneLineCatmullPoints];
    const targetLaneLineCatmullTangents = [...this.newLaneLineCatmullTangents];

    const newLaneItemsKeyInfo = oldLaneItemsKeyInfo.map((oldLaneItemKeyInfo: LaneItemKeyInfo, laneIdx: number) => {
      // altitude remain the same for all lanes
      const innerLaneLineAltitudeCatmullPoints = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullPoints];
      const innerLaneLineAltitudeCatmullTangents = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullTangents];

      const outerLaneLineAltitudeCatmullPoints = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullPoints];
      const outerLaneLineAltitudeCatmullTangents = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullTangents];

      // raw
      let innerLaneLineCatmullPoints_raw = [] as Vector3[];
      let innerLaneLineCatmullTangents_raw = [] as Vector3[];
      let innerLaneLineSeriePoints_raw = [] as Vector3[];

      let outerLaneLineCatmullPoints_raw = [] as Vector3[];
      let outerLaneLineCatmullTangents_raw = [] as Vector3[];
      let outerLaneLineSeriePoints_raw = [] as Vector3[];

      // actual
      let innerLaneLineCatmullPoints = [] as Vector3[];
      let innerLaneLineCatmullTangents = [] as Vector3[];
      let innerLaneLineSeriePoints = [] as Vector3[];

      let outerLaneLineCatmullPoints = [] as Vector3[];
      let outerLaneLineCatmullTangents = [] as Vector3[];
      let outerLaneLineSeriePoints = [] as Vector3[];
      
      if ((laneIdx < targetLaneIndex) || (laneIdx > targetLaneIndex)) {
        // inner
        innerLaneLineCatmullPoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints;
        innerLaneLineCatmullTangents_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents;
        innerLaneLineSeriePoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;

        innerLaneLineCatmullPoints = innerLaneLineCatmullPoints_raw;
        innerLaneLineSeriePoints = innerLaneLineSeriePoints_raw;
        innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;
        
        // outer
        outerLaneLineCatmullPoints_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints;
        outerLaneLineCatmullTangents_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents;
        outerLaneLineSeriePoints_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;

        outerLaneLineCatmullPoints = outerLaneLineCatmullPoints_raw;
        outerLaneLineSeriePoints = outerLaneLineSeriePoints_raw;
        outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;
      } else if (laneIdx === targetLaneIndex) {
        if (this.laneLineSide === LaneLineSide.Inner) {
          // inner
          innerLaneLineCatmullPoints_raw = [...targetLaneLineCatmullPoints];
          innerLaneLineCatmullTangents_raw = [...targetLaneLineCatmullTangents];
          innerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
            innerLaneLineCatmullPoints_raw,
            innerLaneLineCatmullTangents_raw,
            oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints.length,
          );

          const appliedInner = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
            innerLaneLineCatmullPoints_raw,
            innerLaneLineSeriePoints_raw,
            innerLaneLineAltitudeCatmullPoints,
            innerLaneLineAltitudeCatmullTangents,
          );
    
          innerLaneLineCatmullPoints = appliedInner.appliedCatmullPoints;
          innerLaneLineSeriePoints = appliedInner.appliedSeriePoints;
          innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;

          // outer
          outerLaneLineCatmullPoints_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints;
          outerLaneLineCatmullTangents_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents;
          outerLaneLineSeriePoints_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;

          outerLaneLineCatmullPoints = outerLaneLineCatmullPoints_raw;
          outerLaneLineSeriePoints = outerLaneLineSeriePoints_raw;
          outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;
        } else {
          // inner
          innerLaneLineCatmullPoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints;
          innerLaneLineCatmullTangents_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents;
          innerLaneLineSeriePoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;

          innerLaneLineCatmullPoints = innerLaneLineCatmullPoints_raw;
          innerLaneLineSeriePoints = innerLaneLineSeriePoints_raw;
          innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;

          // outer
          outerLaneLineCatmullPoints_raw = [...targetLaneLineCatmullPoints];
          outerLaneLineCatmullTangents_raw = [...targetLaneLineCatmullTangents];
          outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangentsWithControlRefineForConnectionRoad(
            outerLaneLineCatmullPoints_raw,
            outerLaneLineCatmullTangents_raw,
            oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints.length,
          );

          const appliedOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
            outerLaneLineCatmullPoints_raw,
            outerLaneLineSeriePoints_raw,
            outerLaneLineAltitudeCatmullPoints,
            outerLaneLineAltitudeCatmullTangents,
          );
    
          outerLaneLineCatmullPoints = appliedOuter.appliedCatmullPoints;
          outerLaneLineSeriePoints = appliedOuter.appliedSeriePoints;
          outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;
        }
      }

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
      } as LaneItemKeyInfo;
    });

    return newLaneItemsKeyInfo;
  }

  editNewRoadCatmull() {
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

    this.scope.emitEvent(InvokeCatmullEditConnectionRoadEvent, {
      laneId: this.laneId,
    });
  }

  editOldRoadCatmull() {
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

    this.scope.emitEvent(InvokeCatmullEditConnectionRoadEvent, {
      laneId: this.laneId,
    });
  }
};