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
  InvokeCatmullEditCatmullSerieRoadEvent,
} from '../event';


export default class CatmullAltitudeLaneEditCatmullSerieRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private laneId: string;
  private laneSide: LaneSide;
  private laneLineSide: LaneLineSide;
  private newLaneLineAltitudeCatmullPoints: Vector3[];
  private newLaneLineAltitudeCatmullTangents: Vector3[];
  private isStartCatmull: boolean;
  private isEndCatmull: boolean;
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
    this.newLaneLineAltitudeCatmullPoints = (options as unknown as { newLaneLineAltitudeCatmullPoints: Vector3[] }).newLaneLineAltitudeCatmullPoints;
    this.newLaneLineAltitudeCatmullTangents = (options as unknown as { newLaneLineAltitudeCatmullTangents: Vector3[] }).newLaneLineAltitudeCatmullTangents;
    this.isStartCatmull = (options as unknown as { isStartCatmull: boolean }).isStartCatmull;
    this.isEndCatmull = (options as unknown as { isEndCatmull: boolean }).isEndCatmull;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
  }

  commit() {
    super.commit();

    this.preValidateRoad(this.roadId, this.roadCategory);

    this.resolveNecessaryInfo();
    this.laneEditNewRoad();

    this.postValidateRoad(this.roadId, this.roadCategory);

    this.dispatchInvalidRoadEvent(this.roadId, this.roadCategory);

    return { laneId: this.laneId };
  }

  onUndo() {
    super.onUndo();

    this.laneEditOldRoad();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.laneEditNewRoad();

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
    const targetLaneLineAltitudeCatmullPoints = [...this.newLaneLineAltitudeCatmullPoints];
    const targetLaneLineAltitudeCatmullTangents = [...this.newLaneLineAltitudeCatmullTangents];

    const newLaneItemsKeyInfo = oldLaneItemsKeyInfo.map((oldLaneItemKeyInfo: LaneItemKeyInfo, laneIdx: number) => {
      // raw
      let innerLaneLineCatmullPoints_raw = [] as Vector3[];
      let innerLaneLineCatmullTangents_raw = [] as Vector3[];
      let innerLaneLineSeriePoints_raw = [] as Vector3[];

      let outerLaneLineCatmullPoints_raw = [] as Vector3[];
      let outerLaneLineCatmullTangents_raw = [] as Vector3[];
      let outerLaneLineSeriePoints_raw = [] as Vector3[];

      // actual
      let innerLaneLineAltitudeCatmullPoints = [] as Vector3[];
      let innerLaneLineAltitudeCatmullTangents = [] as Vector3[];
      let innerLaneLineCatmullPoints = [] as Vector3[];
      let innerLaneLineCatmullTangents = [] as Vector3[];
      let innerLaneLineSeriePoints = [] as Vector3[];

      let outerLaneLineAltitudeCatmullPoints = [] as Vector3[];
      let outerLaneLineAltitudeCatmullTangents = [] as Vector3[];
      let outerLaneLineCatmullPoints = [] as Vector3[];
      let outerLaneLineCatmullTangents = [] as Vector3[];
      let outerLaneLineSeriePoints = [] as Vector3[];
      
      if ((laneIdx < targetLaneIndex - 1) || (laneIdx > targetLaneIndex + 1)) {
        // inner
        innerLaneLineCatmullPoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints;
        innerLaneLineCatmullTangents_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents;
        innerLaneLineSeriePoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;

        innerLaneLineAltitudeCatmullPoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullPoints;
        innerLaneLineAltitudeCatmullTangents = oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullTangents;
        innerLaneLineCatmullPoints = innerLaneLineCatmullPoints_raw;
        innerLaneLineSeriePoints = innerLaneLineSeriePoints_raw;
        innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;
        
        // outer
        outerLaneLineCatmullPoints_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints;
        outerLaneLineCatmullTangents_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents;
        outerLaneLineSeriePoints_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;

        outerLaneLineAltitudeCatmullPoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullPoints;
        outerLaneLineAltitudeCatmullTangents = oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullTangents;
        outerLaneLineCatmullPoints = outerLaneLineCatmullPoints_raw;
        outerLaneLineSeriePoints = outerLaneLineSeriePoints_raw;
        outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;
      } else if (laneIdx === targetLaneIndex) {
        if (this.laneLineSide === LaneLineSide.Inner) {
          // inner
          innerLaneLineCatmullPoints_raw = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints];
          innerLaneLineCatmullTangents_raw = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents];
          innerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(
            innerLaneLineCatmullPoints_raw,
            innerLaneLineCatmullTangents_raw,
            oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints.length,
          );

          innerLaneLineAltitudeCatmullPoints = [...targetLaneLineAltitudeCatmullPoints];
          innerLaneLineAltitudeCatmullTangents = [...targetLaneLineAltitudeCatmullTangents];

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

          outerLaneLineAltitudeCatmullPoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullPoints;
          outerLaneLineAltitudeCatmullTangents = oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullTangents;
          outerLaneLineCatmullPoints = outerLaneLineCatmullPoints_raw;
          outerLaneLineSeriePoints = outerLaneLineSeriePoints_raw;
          outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;
        } else {
          // inner
          innerLaneLineCatmullPoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints;
          innerLaneLineCatmullTangents_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents;
          innerLaneLineSeriePoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;

          innerLaneLineAltitudeCatmullPoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullPoints;
          innerLaneLineAltitudeCatmullTangents = oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullTangents;
          innerLaneLineCatmullPoints = innerLaneLineCatmullPoints_raw;
          innerLaneLineSeriePoints = innerLaneLineSeriePoints_raw;
          innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;

          // outer
          outerLaneLineCatmullPoints_raw = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints];
          outerLaneLineCatmullTangents_raw = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents];
          outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(
            outerLaneLineCatmullPoints_raw,
            outerLaneLineCatmullTangents_raw,
            oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints.length,
          );

          outerLaneLineAltitudeCatmullPoints = [...targetLaneLineAltitudeCatmullPoints];
          outerLaneLineAltitudeCatmullTangents = [...targetLaneLineAltitudeCatmullTangents];

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
      } else if (laneIdx === targetLaneIndex + 1) {
        if (this.laneLineSide === LaneLineSide.Inner) {
          // inner
          innerLaneLineCatmullPoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints;
          innerLaneLineCatmullTangents_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents;
          innerLaneLineSeriePoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;

          innerLaneLineAltitudeCatmullPoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullPoints;
          innerLaneLineAltitudeCatmullTangents = oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullTangents;
          innerLaneLineCatmullPoints = innerLaneLineCatmullPoints_raw;
          innerLaneLineSeriePoints = innerLaneLineSeriePoints_raw;
          innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;
          
          // outer
          outerLaneLineCatmullPoints_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints;
          outerLaneLineCatmullTangents_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents;
          outerLaneLineSeriePoints_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;

          outerLaneLineAltitudeCatmullPoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullPoints;
          outerLaneLineAltitudeCatmullTangents = oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullTangents;
          outerLaneLineCatmullPoints = outerLaneLineCatmullPoints_raw;
          outerLaneLineSeriePoints = outerLaneLineSeriePoints_raw;
          outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;
        } else {
          // inner
          innerLaneLineCatmullPoints_raw = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints];
          innerLaneLineCatmullTangents_raw = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents];
          innerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(
            innerLaneLineCatmullPoints_raw,
            innerLaneLineCatmullTangents_raw,
            oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints.length,
          );

          innerLaneLineAltitudeCatmullPoints = [...targetLaneLineAltitudeCatmullPoints];
          innerLaneLineAltitudeCatmullTangents = [...targetLaneLineAltitudeCatmullTangents];

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

          outerLaneLineAltitudeCatmullPoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullPoints;
          outerLaneLineAltitudeCatmullTangents = oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullTangents;
          outerLaneLineCatmullPoints = outerLaneLineCatmullPoints_raw;
          outerLaneLineSeriePoints = outerLaneLineSeriePoints_raw;
          outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;
        }
      } else if (laneIdx === targetLaneIndex - 1) {
        if (this.laneLineSide === LaneLineSide.Inner) {
          // inner
          innerLaneLineCatmullPoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints;
          innerLaneLineCatmullTangents_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents;
          innerLaneLineSeriePoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;

          innerLaneLineAltitudeCatmullPoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullPoints;
          innerLaneLineAltitudeCatmullTangents = oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullTangents;
          innerLaneLineCatmullPoints = innerLaneLineCatmullPoints_raw;
          innerLaneLineSeriePoints = innerLaneLineSeriePoints_raw;
          innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;

          // outer
          outerLaneLineCatmullPoints_raw = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints];
          outerLaneLineCatmullTangents_raw = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents];
          outerLaneLineSeriePoints_raw = this.scope.generateHermiteSerieAlignedNumLineSeriePointsViaCatmullPointsAndCatmullTangents(
            outerLaneLineCatmullPoints_raw,
            outerLaneLineCatmullTangents_raw,
            oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints.length,
          );

          outerLaneLineAltitudeCatmullPoints = [...targetLaneLineAltitudeCatmullPoints];
          outerLaneLineAltitudeCatmullTangents = [...targetLaneLineAltitudeCatmullTangents];

          const appliedOuter = this.scope.applyAltitudeToHermiteSerieLaneLineCatmullPointsAndSeriePointsViaReflineAltitude(
            outerLaneLineCatmullPoints_raw,
            outerLaneLineSeriePoints_raw,
            outerLaneLineAltitudeCatmullPoints,
            outerLaneLineAltitudeCatmullTangents,
          );
    
          outerLaneLineCatmullPoints = appliedOuter.appliedCatmullPoints;
          outerLaneLineSeriePoints = appliedOuter.appliedSeriePoints;
          outerLaneLineCatmullTangents = outerLaneLineCatmullTangents_raw;
        } else {
          // inner
          innerLaneLineCatmullPoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints;
          innerLaneLineCatmullTangents_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullTangents;
          innerLaneLineSeriePoints_raw = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;

          innerLaneLineAltitudeCatmullPoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullPoints;
          innerLaneLineAltitudeCatmullTangents = oldLaneItemKeyInfo.laneLines.innerLaneLine.altitudeCatmullTangents;
          innerLaneLineCatmullPoints = innerLaneLineCatmullPoints_raw;
          innerLaneLineSeriePoints = innerLaneLineSeriePoints_raw;
          innerLaneLineCatmullTangents = innerLaneLineCatmullTangents_raw;
          
          // outer
          outerLaneLineCatmullPoints_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints;
          outerLaneLineCatmullTangents_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullTangents;
          outerLaneLineSeriePoints_raw = oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;

          outerLaneLineAltitudeCatmullPoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullPoints;
          outerLaneLineAltitudeCatmullTangents = oldLaneItemKeyInfo.laneLines.outerLaneLine.altitudeCatmullTangents;
          outerLaneLineCatmullPoints = outerLaneLineCatmullPoints_raw;
          outerLaneLineSeriePoints = outerLaneLineSeriePoints_raw;
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

  laneEditNewRoad() {
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

    this.scope.emitEvent(InvokeCatmullEditCatmullSerieRoadEvent, {
      laneId: this.laneId,
    });
  }

  laneEditOldRoad() {
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

    this.scope.emitEvent(InvokeCatmullEditCatmullSerieRoadEvent, {
      laneId: this.laneId,
    });
  }
};