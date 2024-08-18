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
  InvokeLaneWidthEditCatmullSerieRoadEvent,
} from '../event';


export default class LaneWidthEditCatmullSerieRoadTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private targetDistance: number;
  private laneId: string;
  private laneSide: LaneSide;
  private roadId: string;
  private roadCategory: RoadCategory;

  private roadItem?: RoadItem;
  private targetLaneIndex?: number;
  private oldLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private newLaneItemsKeyInfo?: LaneItemKeyInfo[];
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.targetDistance = (options as unknown as { targetDistance: number }).targetDistance;
    this.laneId = (options as unknown as { laneId: string }).laneId;
    this.laneSide = (options as unknown as { laneSide: LaneSide }).laneSide;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
  }

  commit() {
    super.commit();

    this.preValidateRoad(this.roadId, this.roadCategory);

    this.resolveNecessaryInfo();
    this.editNewRoadLaneWidth();

    this.postValidateRoad(this.roadId, this.roadCategory);

    this.dispatchInvalidRoadEvent(this.roadId, this.roadCategory);

    return { laneId: this.laneId };
  }

  onUndo() {
    super.onUndo();

    this.editOldRoadLaneWidth();
  }

  onRedo() {
    super.onRedo();

    this.resolveNecessaryInfo();
    this.editNewRoadLaneWidth();

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
    
    this.newLaneItemsKeyInfo = this.generateNewKeyInfoFromOldKeyInfo(this.oldLaneItemsKeyInfo, this.laneSide) as LaneItemKeyInfo[];
  }

  generateNewKeyInfoFromOldKeyInfo(oldLaneItemsKeyInfo: LaneItemKeyInfo[], laneSide: LaneSide) {
    const targetLaneIndex = this.targetLaneIndex as number;

    const reflineSeriePoints = (this.roadItem as RoadItem).referenceLine.seriePoints;
    const reflineSerieNormals = (this.roadItem as RoadItem).referenceLine.serieNormals;

    let newLaneItemsKeyInfo = [] as LaneItemKeyInfo[];

    if (this.laneSide === LaneSide.Left) {
      newLaneItemsKeyInfo = oldLaneItemsKeyInfo.map((oldLaneItemKeyInfo: LaneItemKeyInfo, laneIdx: number) => {
        let innerLaneLineSeriePoints = [] as Vector3[];
        let outerLaneLineSeriePoints = [] as Vector3[];
        
        if (laneIdx < targetLaneIndex) {
          // both inner and outer remain the same
          innerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;
          outerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;
        } else if (laneIdx === targetLaneIndex) {
          // change outer only
          innerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;

          outerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
            const oldOuterLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints].reverse()[idx];
            const distance = v.subtract(oldOuterLaneLinePoint).length() + this.targetDistance;

            return v.add(reflineSerieNormals[idx].multiplyByFloats(-distance, -distance, -distance));
          }).reverse();
        } else if (laneIdx > targetLaneIndex) {
          innerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
            const oldInnerLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints].reverse()[idx];
            const distance = v.subtract(oldInnerLaneLinePoint).length() + this.targetDistance;

            return v.add(reflineSerieNormals[idx].multiplyByFloats(-distance, -distance, -distance));
          }).reverse();
          
          outerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
            const oldOuterLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints].reverse()[idx];
            const distance = v.subtract(oldOuterLaneLinePoint).length() + this.targetDistance;

            return v.add(reflineSerieNormals[idx].multiplyByFloats(-distance, -distance, -distance));
          }).reverse();
        }

        // for resolving old catmull indices
        const oldInnerLaneLineSeriePoints = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints];
        const oldOuterLaneLineSeriePoints = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints];
        const oldInnerLaneLineCatmullPoints = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints];
        const oldOuterLaneLineCatmullPoints = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints];

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
              catmullPoints: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: outerLaneLineSeriePoints,
              category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints],
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
    } else {
      newLaneItemsKeyInfo = oldLaneItemsKeyInfo.map((oldLaneItemKeyInfo: LaneItemKeyInfo, laneIdx: number) => {
        let innerLaneLineSeriePoints = [] as Vector3[];
        let outerLaneLineSeriePoints = [] as Vector3[];
        
        if (laneIdx < targetLaneIndex) {
          // both inner and outer remain the same
          innerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;
          outerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;
        } else if (laneIdx === targetLaneIndex) {
          // change outer only
          innerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;

          outerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
            const oldOuterLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints][idx];
            const distance = v.subtract(oldOuterLaneLinePoint).length() + this.targetDistance;

            return v.add(reflineSerieNormals[idx].multiplyByFloats(distance, distance, distance));
          });
        } else if (laneIdx > targetLaneIndex) {
          innerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
            const oldInnerLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints][idx];
            const distance = v.subtract(oldInnerLaneLinePoint).length() + this.targetDistance;

            return v.add(reflineSerieNormals[idx].multiplyByFloats(distance, distance, distance));
          });

          outerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
            const oldOuterLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints][idx];
            const distance = v.subtract(oldOuterLaneLinePoint).length() + this.targetDistance;

            return v.add(reflineSerieNormals[idx].multiplyByFloats(distance, distance, distance));
          });
        }

        // for resolving old catmull indices
        const oldInnerLaneLineSeriePoints = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints];
        const oldOuterLaneLineSeriePoints = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints];
        const oldInnerLaneLineCatmullPoints = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints];
        const oldOuterLaneLineCatmullPoints = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints];

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
              catmullPoints: [...oldLaneItemKeyInfo.laneLines.innerLaneLine.catmullPoints],
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: outerLaneLineSeriePoints,
              category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
              catmullPoints: [...oldLaneItemKeyInfo.laneLines.outerLaneLine.catmullPoints],
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
    }

    return newLaneItemsKeyInfo;
  }

  editNewRoadLaneWidth() {
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

    this.scope.emitEvent(InvokeLaneWidthEditCatmullSerieRoadEvent, {
      laneId: this.laneId,
    });
  }

  editOldRoadLaneWidth() {
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

    this.scope.emitEvent(InvokeLaneWidthEditCatmullSerieRoadEvent, {
      laneId: this.laneId,
    });
  }
};