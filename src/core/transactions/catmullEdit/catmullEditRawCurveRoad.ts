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
import { LineType } from '../../plugins/lineDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';


export default class CatmullEditRawCurveRoadTransaction extends StandardTransaction {
  protected scope: ExtendedNamespace;
  protected laneId: string;
  protected laneSide: LaneSide;
  protected newLaneLineCatmullPoints: Vector3[];
  protected roadId: string;
  protected roadCategory: RoadCategory;

  private roadItem?: RoadItem;
  private targetLaneIndex?: number;
  private oldLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private newLaneItemsKeyInfo?: LaneItemKeyInfo[];
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.laneId = (options as unknown as { laneId: string }).laneId;
    this.laneSide = (options as unknown as { laneSide: LaneSide }).laneSide;
    this.newLaneLineCatmullPoints = (options as unknown as { newLaneLineCatmullPoints: Vector3[] }).newLaneLineCatmullPoints;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
  }

  commit() {
    super.commit();

    this.resolveNecessaryInfo();
    this.editNewRoadCatmull();
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
    const targetOuterLaneLineCatmullPoints = [...this.newLaneLineCatmullPoints];

    const newLaneItemsKeyInfo = oldLaneItemsKeyInfo.map((oldLaneItemKeyInfo: LaneItemKeyInfo, laneIdx: number) => {
      let innerLaneLineSeriePoints = [] as Vector3[];
      let outerLaneLineSeriePoints = [] as Vector3[];
      let innerLaneLineCatmullPoints = [] as Vector3[];
      let outerLaneLineCatmullPoints = [] as Vector3[];
      
      if ((laneIdx < targetLaneIndex) || (laneIdx > targetLaneIndex + 1)) {
        // both inner and outer remain the same
        innerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;
        outerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;
        innerLaneLineCatmullPoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints;
        outerLaneLineCatmullPoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints;
      } else if (laneIdx === targetLaneIndex) {
        // change outer only
        innerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;
        innerLaneLineCatmullPoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints;

        outerLaneLineCatmullPoints = [...targetOuterLaneLineCatmullPoints];
        outerLaneLineSeriePoints = this.scope.generateSeriePointsViaCatmullPoints(outerLaneLineCatmullPoints);
      } else if (laneIdx === targetLaneIndex + 1) {
        // change inner only
        outerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;
        outerLaneLineCatmullPoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints;

        innerLaneLineCatmullPoints = [...targetOuterLaneLineCatmullPoints];
        innerLaneLineSeriePoints = this.scope.generateSeriePointsViaCatmullPoints(innerLaneLineCatmullPoints);
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
            atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
          },
          outerLaneLine: {
            seriePoints: outerLaneLineSeriePoints,
            category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
            options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
            laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
            catmullPoints: outerLaneLineCatmullPoints,
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
            catmullPoints: [innerLaneLineSeriePoints[0], outerLaneLineSeriePoints[0]],
            atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: oldLaneItemKeyInfo.laneConnectors.laneConnectorStart.atlasLaneBoundaryType,
          },
          laneConnectorEnd: {
            seriePoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
            category: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.category,
            options: { ...oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.options },
            laneLineSide: oldLaneItemKeyInfo.laneConnectors.laneConnectorEnd.laneLineSide,
            catmullPoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
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
  }
};