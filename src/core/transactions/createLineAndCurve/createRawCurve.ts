import {
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  LinesMesh,
  Mesh,
  Curve3,
  Path3D,
} from "@babylonjs/core";
import StandardTransaction from '../general/standard';
import { LineAndCurveCategory, LineAndCurveItem } from '../../plugins/statusManager/type';
import { StoreLineAndCurveEvent, RemoveLineAndCurveEvent } from '../../plugins/statusManager/constant';
import { LineType, DashAlignType } from '../../plugins/lineDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';

export default class CreateRawCurveTransaction extends StandardTransaction {
  protected scope: ExtendedNamespace;
  protected meshId: string;
  protected points: Vector3[];
  protected pointsMesh: Mesh[];
  protected color: Color3;
  protected lineType: LineType;
  protected dashAlignType: DashAlignType;
  
  protected curveDashLength?: number;
  protected curveDashSize?: number;
  protected curveGapSize?: number;

  protected curve: Curve3;
  protected curveCategory: LineAndCurveCategory;
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.meshId = (options as unknown as { id: string }).id;
    this.points = (options as unknown as { points: Vector3[] }).points;
    this.pointsMesh = (options as unknown as { pointsMesh: Mesh[] }).pointsMesh;
    this.color = (options as unknown as { color: Color3 }).color;
    this.lineType = (options as unknown as { lineType: LineType }).lineType;
    this.dashAlignType = (options as unknown as { dashAlignType: DashAlignType }).dashAlignType;

    this.curveDashLength = (options as unknown as { curveDashLength?: number }).curveDashLength;
    this.curveDashSize = (options as unknown as { curveDashSize?: number }).curveDashSize;
    this.curveGapSize = (options as unknown as { curveGapSize?: number }).curveGapSize;

    this.curve = new Curve3([]);
    this.curveCategory = LineAndCurveCategory.ThreeCircleCurve;
  }

  commit() {
    super.commit();

    const entity = this.createCurve();
    return { entity };
  }

  onUndo() {
    super.onUndo();
    this.removeCurve();
  }

  onRedo() {
    super.onRedo();
    this.createCurve();
  }

  createCurve() {
    let curve: LinesMesh | null = null;
    let drawingPoints: Vector3[] | null = null;

    const seriePoints = this.curve.getPoints();

    if (this.lineType === LineType.Solid) {
      const options = {
        points: [...seriePoints],
        updatable: true,
      };
  
      curve = MeshBuilder.CreateLines(this.meshId, options, this.scope.getSceneManager().getContextScene());
      curve.color = this.color;
  
      curve = MeshBuilder.CreateLines(this.meshId, { points: [...seriePoints], instance: curve });

      drawingPoints = [...seriePoints];
    } else if (this.lineType === LineType.Dashed) {
      const curveDashLength = this.curveDashLength as number;
      const gapDashRatio = (this.curveGapSize as number) / (this.curveDashSize as number)
      const curveGapLength = curveDashLength * gapDashRatio;

      const distance = this.curve.length();
      const curvePoints = this.curve.getPoints();
      const pointsCount = curvePoints.length;

      const oneDashPointsCount = Math.floor(pointsCount * curveDashLength / distance);
      const oneGapPointsCount = Math.floor(pointsCount * curveGapLength / distance);

      const points = [] as Array<Vector3>;
      const colors = [] as Array<Color4>;

      if (this.dashAlignType === DashAlignType.DashStartDashEnd) {
        let dashNb = Math.floor((pointsCount - oneDashPointsCount) / (oneDashPointsCount + oneGapPointsCount)) + 1;
        // at least two dash in DashStartDashEnd
        dashNb = Math.max(dashNb, 2);
        const gapNb = dashNb - 1;

        // less than oneDashPointsCount * 2 + oneGapPointsCount
        const tailPointsCount = pointsCount - oneGapPointsCount * gapNb - oneDashPointsCount * (dashNb - 1);

        for(let i = 0; i < pointsCount; i++) {
          let isDash = false;
          let isHeadDash = false;
          let isTailDash = false;

          if (i < (pointsCount - tailPointsCount)) {
            const ri = i % (oneGapPointsCount + oneDashPointsCount);
            isDash = (ri >= 0) && (ri < oneDashPointsCount);
            isHeadDash = ri === 0;
            isTailDash = ri === oneDashPointsCount - 1;
          } else {
            const ri = i - (pointsCount - tailPointsCount);

            isDash = true;
            isHeadDash = ri === 0;
            isTailDash = ri === tailPointsCount - 1;
          }   

          if (isDash) {
            if (isHeadDash) {
              points.push(curvePoints[i]);
              colors.push(new Color4(0, 0, 0, 0));
            }

            points.push(curvePoints[i]);
            colors.push(new Color4(this.color.r, this.color.g, this.color.b, 1));

            if (isTailDash) {
              points.push(curvePoints[i]);
              colors.push(new Color4(0, 0, 0, 0));
            }
          } else {
            points.push(curvePoints[i]);
            colors.push(new Color4(0, 0, 0, 0));
          }
        }
      } else if (this.dashAlignType === DashAlignType.DashStartGapEnd) {
        let dashNb = Math.floor(pointsCount / (oneDashPointsCount + oneGapPointsCount));
        // at least one dash in DashStartGapEnd
        dashNb = Math.max(dashNb, 1);
        const gapNb = dashNb;

        // less than oneDashPointsCount + oneGapPointsCount
        const tailPointsCount = pointsCount - oneGapPointsCount * gapNb - oneDashPointsCount * dashNb;

        for(let i = 0; i < pointsCount; i++) {
          let isDash = false;
          let isHeadDash = false;
          let isTailDash = false;

          if (i < (pointsCount - tailPointsCount)) {
            const ri = i % (oneGapPointsCount + oneDashPointsCount);
            isDash = (ri >= 0) && (ri < oneDashPointsCount);
            isHeadDash = ri === 0;
            isTailDash = ri === oneDashPointsCount - 1;
          } else {
            isDash = false;
            isHeadDash = false;
            isTailDash = false;
          }   

          if (isDash) {
            if (isHeadDash) {
              points.push(curvePoints[i]);
              colors.push(new Color4(0, 0, 0, 0));
            }

            points.push(curvePoints[i]);
            colors.push(new Color4(this.color.r, this.color.g, this.color.b, 1));

            if (isTailDash) {
              points.push(curvePoints[i]);
              colors.push(new Color4(0, 0, 0, 0));
            }
          } else {
            points.push(curvePoints[i]);
            colors.push(new Color4(0, 0, 0, 0));
          }
        }
      } else if (this.dashAlignType === DashAlignType.GapStartDashEnd) {
        let gapNb = Math.floor(pointsCount / (oneDashPointsCount + oneGapPointsCount));
        // at least one gap in GapStartDashEnd
        gapNb = Math.max(gapNb, 1);
        const dashNb = gapNb;

        // less than oneDashPointsCount + oneGapPointsCount
        const tailPointsCount = pointsCount - oneGapPointsCount * gapNb - oneDashPointsCount * dashNb;

        for(let i = 0; i < pointsCount; i++) {
          let isDash = false;
          let isHeadDash = false;
          let isTailDash = false;

          if (i < (pointsCount - tailPointsCount)) {
            const ri = i % (oneGapPointsCount + oneDashPointsCount);
            isDash = ri > oneGapPointsCount;
            isHeadDash = ri === oneGapPointsCount + 1;
            // last point is not tailDash
            isTailDash = (ri === oneGapPointsCount + oneDashPointsCount - 1) && (i !== (pointsCount - tailPointsCount - 1));
          } else {
            isDash = true;
            isHeadDash = false;
            isTailDash = i === pointsCount - 1;
          }   

          if (isDash) {
            if (isHeadDash) {
              points.push(curvePoints[i]);
              colors.push(new Color4(0, 0, 0, 0));
            }

            points.push(curvePoints[i]);
            colors.push(new Color4(this.color.r, this.color.g, this.color.b, 1));

            if (isTailDash) {
              points.push(curvePoints[i]);
              colors.push(new Color4(0, 0, 0, 0));
            }
          } else {
            points.push(curvePoints[i]);
            colors.push(new Color4(0, 0, 0, 0));
          }
        }
      } else if (this.dashAlignType === DashAlignType.GapStartGapEnd) {
        let gapNb = Math.floor((pointsCount - oneGapPointsCount) / (oneDashPointsCount + oneGapPointsCount)) + 1;
        // at least two gap in GapStartGapEnd
        gapNb = Math.max(gapNb, 2);
        const dashNb = gapNb - 1;

        // less than oneDashPointsCount + oneGapPointsCount * 2
        const tailPointsCount = pointsCount - oneGapPointsCount * (gapNb - 1) - oneDashPointsCount * dashNb;

        for(let i = 0; i < pointsCount; i++) {
          let isDash = false;
          let isHeadDash = false;
          let isTailDash = false;

          if (i < (pointsCount - tailPointsCount)) {
            const ri = i % (oneGapPointsCount + oneDashPointsCount);
            isDash = ri > oneGapPointsCount;
            isHeadDash = ri === oneGapPointsCount + 1;
            isTailDash = ri === oneGapPointsCount + oneDashPointsCount - 1;
          } else {
            isDash = false;
            isHeadDash = false;
            isTailDash = false;
          }   

          if (isDash) {
            if (isHeadDash) {
              points.push(curvePoints[i]);
              colors.push(new Color4(0, 0, 0, 0));
            }

            points.push(curvePoints[i]);
            colors.push(new Color4(this.color.r, this.color.g, this.color.b, 1));

            if (isTailDash) {
              points.push(curvePoints[i]);
              colors.push(new Color4(0, 0, 0, 0));
            }
          } else {
            points.push(curvePoints[i]);
            colors.push(new Color4(0, 0, 0, 0));
          }
        }
      }

      const options = {
        points,
        colors,
        updatable: true,
      };

      curve = MeshBuilder.CreateLines(this.meshId, options, this.scope.getSceneManager().getContextScene());
      curve = MeshBuilder.CreateLines(this.meshId, { points, instance: curve });

      drawingPoints = [...points];
    }

    const path = new Path3D(seriePoints as Vector3[]);
    const serieNormals = path.getNormals();
    const serieTangents = path.getTangents();

    const lineAndCurveItem = {
      points: this.points,
      pointsMesh: this.pointsMesh,
      lineAndCurveMesh: curve,
      markerDisposed: false,
      category: this.curveCategory,
      drawingPoints: drawingPoints as Vector3[],
      seriePoints,
      serieNormals,
      serieTangents,
      options: {
        lineType: this.lineType,
        lineColor: this.color,
        dashAlignType: this.dashAlignType,
        curveDashLength: this.curveDashLength,
        curveDashSize: this.curveDashSize,
        curveGapSize: this.curveGapSize,
      },
    } as LineAndCurveItem;

    (curve as LinesMesh).metadata = {
      lineAndCurveItem,
    };

    this.scope.emitEvent(StoreLineAndCurveEvent, lineAndCurveItem);

    this.scope.makeSceneDirty();

    return lineAndCurveItem;
  }

  removeCurve() {
    this.scope.emitEvent(RemoveLineAndCurveEvent, {
      id: this.meshId,
      category: this.curveCategory,
      callback: (item: LineAndCurveItem) => {
        item.lineAndCurveMesh.dispose();
        if (!item.markerDisposed) {
          item.pointsMesh.forEach((m: Mesh) => {
            m.dispose();
          });
        }
        this.scope.makeSceneDirty();
      }
    });
  }
};