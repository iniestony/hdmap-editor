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
export default class AddLaneRawCurveRoadTransaction extends StandardTransaction {
  protected scope: ExtendedNamespace;
  protected roadId: string;
  protected roadCategory: RoadCategory;
  protected laneSide: LaneSide;
  protected laneIndex: number;
  protected addLaneSide: AddLaneSide;

  private lastUnchangedLaneIndex?: number;
  private roadItem?: RoadItem;
  private currentGeneralLaneIndex?: number;
  private oldLaneItemsKeyInfo?: LaneItemKeyInfo[];
  private newLaneItemsKeyInfo?: LaneItemKeyInfo[];

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

    this.resolveNecessaryInfo();
    this.addLane();
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
    } else {
      this.oldLaneItemsKeyInfo = this.roadItem.laneItems.rightLanes.map((l: LaneItem) => {
        return this.scope.resolveLaneItemKeyInfo(l) as LaneItemKeyInfo;
      });
    }

    this.newLaneItemsKeyInfo = this.generateNewKeyInfoFromOldKeyInfo(this.oldLaneItemsKeyInfo) as LaneItemKeyInfo[];
  }

  generateNewKeyInfoFromOldKeyInfo(oldLaneItemsKeyInfo: LaneItemKeyInfo[]) {
    const roadItem = this.roadItem as RoadItem;
    const reflineSeriePoints = roadItem.referenceLine.seriePoints;
    const reflineSerieNormals = roadItem.referenceLine.serieNormals;

    const lastUnchangedLaneIndex = this.lastUnchangedLaneIndex as number;
    const currentGeneralLaneIndex = this.currentGeneralLaneIndex as number;
    const newLaneItemsKeyInfo = [] as LaneItemKeyInfo[];

    // new lane
    let newLaneItemKeyInfo: LaneItemKeyInfo | undefined = undefined;

    if (this.laneSide === LaneSide.Left) {
      const reflineItemKeyInfo = this.scope.resolveReferenceLineItemKeyInfo(roadItem.referenceLine);

      let innerLaneLineSeriePoints: Vector3[] = [];
      let toExtendLaneLineInfo = reflineItemKeyInfo;

      if (lastUnchangedLaneIndex >= 0) {
        const lastUnchangedLaneItemKeyInfo = oldLaneItemsKeyInfo[lastUnchangedLaneIndex];

        innerLaneLineSeriePoints = lastUnchangedLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;
        toExtendLaneLineInfo = lastUnchangedLaneItemKeyInfo.laneLines.outerLaneLine;
      } else {
        innerLaneLineSeriePoints = [...reflineSeriePoints].reverse();
        toExtendLaneLineInfo = reflineItemKeyInfo;
      }

      const outerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
        const relativeInnerLaneLinePoint = [...innerLaneLineSeriePoints].reverse()[idx];
        const distance = v.subtract(relativeInnerLaneLinePoint).length() + RendererConfig.mesh.defaultLaneWidth;

        return v.add(reflineSerieNormals[idx].multiplyByFloats(-distance, -distance, -distance));
      }).reverse();


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
            options: { ...toExtendLaneLineInfo.options },
            laneLineSide: LaneLineSide.Inner,
            catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(innerLaneLineSeriePoints),
            catmullTangents: [],
            altitudeCatmullPoints: [],
            altitudeCatmullTangents: [],
            atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
          },
          outerLaneLine: {
            seriePoints: outerLaneLineSeriePoints,
            category: toExtendLaneLineInfo.category,
            options: { ...toExtendLaneLineInfo.options },
            laneLineSide: LaneLineSide.Outer,
            catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(outerLaneLineSeriePoints),
            catmullTangents: [],
            altitudeCatmullPoints: [],
            altitudeCatmullTangents: [],
            atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
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
            catmullPoints: [innerLaneLineSeriePoints[0], outerLaneLineSeriePoints[0]],
            catmullTangents: [],
            altitudeCatmullPoints: [],
            altitudeCatmullTangents: [],
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
            catmullPoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
            catmullTangents: [],
            altitudeCatmullPoints: [],
            altitudeCatmullTangents: [],
            atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
          },
        },
      } as LaneItemKeyInfo;
    } else {
      const reflineItemKeyInfo = this.scope.resolveReferenceLineItemKeyInfo(roadItem.referenceLine);

      let innerLaneLineSeriePoints: Vector3[] = [];
      let toExtendLaneLineInfo = reflineItemKeyInfo;

      if (lastUnchangedLaneIndex >= 0) {
        const lastUnchangedLaneItemKeyInfo = oldLaneItemsKeyInfo[lastUnchangedLaneIndex];

        innerLaneLineSeriePoints = lastUnchangedLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;
        toExtendLaneLineInfo = lastUnchangedLaneItemKeyInfo.laneLines.outerLaneLine;
      } else {
        innerLaneLineSeriePoints = [...reflineSeriePoints];
        toExtendLaneLineInfo = reflineItemKeyInfo;
      }

      const outerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
        const relativeInnerLaneLinePoint = [...innerLaneLineSeriePoints][idx];
        const distance = v.subtract(relativeInnerLaneLinePoint).length() + RendererConfig.mesh.defaultLaneWidth;

        return v.add(reflineSerieNormals[idx].multiplyByFloats(distance, distance, distance));
      });


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
            options: { ...toExtendLaneLineInfo.options },
            laneLineSide: LaneLineSide.Inner,
            catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(innerLaneLineSeriePoints),
            catmullTangents: [],
            altitudeCatmullPoints: [],
            altitudeCatmullTangents: [],
            atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
          },
          outerLaneLine: {
            seriePoints: outerLaneLineSeriePoints,
            category: toExtendLaneLineInfo.category,
            options: { ...toExtendLaneLineInfo.options },
            laneLineSide: LaneLineSide.Outer,
            catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(outerLaneLineSeriePoints),
            catmullTangents: [],
            altitudeCatmullPoints: [],
            altitudeCatmullTangents: [],
            atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
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
            catmullPoints: [innerLaneLineSeriePoints[0], outerLaneLineSeriePoints[0]],
            catmullTangents: [],
            altitudeCatmullPoints: [],
            altitudeCatmullTangents: [],
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
            catmullPoints: [innerLaneLineSeriePoints[innerLaneLineSeriePoints.length - 1], outerLaneLineSeriePoints[outerLaneLineSeriePoints.length - 1]],
            catmullTangents: [],
            altitudeCatmullPoints: [],
            altitudeCatmullTangents: [],
            atlasLaneBoundaryVirtual: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual,
            atlasLaneBoundaryType: RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType,
          },
        },
      } as LaneItemKeyInfo;
    }


    // generate new lanes

    // inner most, add new lane first
    if (lastUnchangedLaneIndex === -1) {
      newLaneItemsKeyInfo.push(newLaneItemKeyInfo);
    }

    oldLaneItemsKeyInfo.forEach((oldLaneItemKeyInfo: LaneItemKeyInfo, idx: number) => {
      if (idx < lastUnchangedLaneIndex) {
        // push lane itself
        const innerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;
        const outerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;

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
              catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(innerLaneLineSeriePoints),
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: outerLaneLineSeriePoints,
              category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
              catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(outerLaneLineSeriePoints),
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
        } as LaneItemKeyInfo);
      } else if (idx === lastUnchangedLaneIndex) {
        // push lane itself and new lane
        const innerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints;
        const outerLaneLineSeriePoints = oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints;

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
              catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(innerLaneLineSeriePoints),
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: outerLaneLineSeriePoints,
              category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
              catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(outerLaneLineSeriePoints),
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
        } as LaneItemKeyInfo);

        newLaneItemsKeyInfo.push(newLaneItemKeyInfo as LaneItemKeyInfo);
      } else if (idx > lastUnchangedLaneIndex) {
        let innerLaneLineSeriePoints = [] as Vector3[];
        let outerLaneLineSeriePoints = [] as Vector3[];

        if (this.laneSide === LaneSide.Left) {
          innerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
            const oldInnerLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints].reverse()[idx];
            const distance = v.subtract(oldInnerLaneLinePoint).length() + RendererConfig.mesh.defaultLaneWidth;

            return v.add(reflineSerieNormals[idx].multiplyByFloats(-distance, -distance, -distance));
          }).reverse();

          outerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
            const oldOuterLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints].reverse()[idx];
            const distance = v.subtract(oldOuterLaneLinePoint).length() + RendererConfig.mesh.defaultLaneWidth;

            return v.add(reflineSerieNormals[idx].multiplyByFloats(-distance, -distance, -distance));
          }).reverse();
        } else {
          innerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
            const oldInnerLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.innerLaneLine.seriePoints][idx];
            const distance = v.subtract(oldInnerLaneLinePoint).length() + RendererConfig.mesh.defaultLaneWidth;

            return v.add(reflineSerieNormals[idx].multiplyByFloats(distance, distance, distance));
          });

          outerLaneLineSeriePoints = reflineSeriePoints.map((v: Vector3, idx: number) => {
            const oldOuterLaneLinePoint = [...oldLaneItemKeyInfo.laneLines.outerLaneLine.seriePoints][idx];
            const distance = v.subtract(oldOuterLaneLinePoint).length() + RendererConfig.mesh.defaultLaneWidth;

            return v.add(reflineSerieNormals[idx].multiplyByFloats(distance, distance, distance));
          });
        }

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
              catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(innerLaneLineSeriePoints),
              atlasLaneBoundaryVirtual: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
              atlasLaneBoundaryType: oldLaneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
            },
            outerLaneLine: {
              seriePoints: outerLaneLineSeriePoints,
              category: oldLaneItemKeyInfo.laneLines.outerLaneLine.category,
              options: { ...oldLaneItemKeyInfo.laneLines.outerLaneLine.options },
              laneLineSide: oldLaneItemKeyInfo.laneLines.outerLaneLine.laneLineSide,
              catmullPoints: this.scope.resolveCatmullPointsBySeriePoints(outerLaneLineSeriePoints),
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
  }
};