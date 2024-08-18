import {
  Vector3,
  Color3,
  MeshBuilder,
  LinesMesh,
  Mesh,
  Curve3,
} from "@babylonjs/core";
import StandardTransaction from '../general/standard';
import { LineAndCurveCategory, LineAndCurveItem } from '../../plugins/statusManager/type';
import { StoreLineAndCurveEvent, RemoveLineAndCurveEvent } from '../../plugins/statusManager/constant';
import { LineType, DashAlignType } from '../../plugins/lineDrawer/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';

export default class CreateTwoStraightLineTransaction extends StandardTransaction {
  private scope: ExtendedNamespace;
  private meshId: string;
  private points: Vector3[];
  private pointsMesh: Mesh[];
  private color: Color3;
  private lineType: LineType;
  private dashAlignType: DashAlignType;
  
  private straightDashLength?: number;
  private straightDashSize?: number;
  private straightGapSize?: number;
  
  constructor(options: Object) {
    super(options);

    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;

    this.meshId = (options as unknown as { id: string }).id;
    this.points = (options as unknown as { points: Vector3[] }).points;
    this.pointsMesh = (options as unknown as { pointsMesh: Mesh[] }).pointsMesh;
    this.color = (options as unknown as { color: Color3 }).color;
    this.lineType = (options as unknown as { lineType: LineType }).lineType;
    this.dashAlignType = (options as unknown as { dashAlignType: DashAlignType }).dashAlignType;

    this.straightDashLength = (options as unknown as { straightDashLength?: number }).straightDashLength;
    this.straightDashSize = (options as unknown as { straightDashSize?: number }).straightDashSize;
    this.straightGapSize = (options as unknown as { straightGapSize?: number }).straightGapSize;
  }

  commit() {
    super.commit();

    const entity = this.createLine();
    return { entity };
  }

  onUndo() {
    super.onUndo();
    this.removeLine();
  }

  onRedo() {
    super.onRedo();
    this.createLine()
  }

  createLine() {
    let tsl: LinesMesh | null = null;
    let drawingPoints: Vector3[] | null = null;

    const seriePoints = this.scope.resolveStraightSeriePoints(this.points[0], this.points[1]);

    if (this.lineType === LineType.Solid) {
      const options = {
        points: [...seriePoints],
        updatable: true,
      };

      tsl = MeshBuilder.CreateLines(this.meshId, options, this.scope.getSceneManager().getContextScene());
      tsl.color = this.color;

      tsl = MeshBuilder.CreateLines(this.meshId, { points: [...seriePoints], instance: tsl });

      drawingPoints = [...seriePoints];
    } else if (this.lineType === LineType.Dashed) {
      const ps = new Vector3(this.points[0].x, this.points[0].y, this.points[0].z);
      const pe = new Vector3(this.points[1].x, this.points[1].y, this.points[1].z);

      const straightDashLength = this.straightDashLength as number;
      const gapDashRatio = (this.straightGapSize as number) / (this.straightDashSize as number)
      const straightGapLength = straightDashLength * gapDashRatio;

      const distance = Vector3.Distance(ps, pe);
      const direction = pe.subtract(ps);

      let points = [ps, pe];
      let dashNb = 1;

      if (this.dashAlignType === DashAlignType.DashStartDashEnd) {
        dashNb = Math.floor((distance - straightDashLength) / (straightDashLength + straightGapLength)) + 1;
        // at least two dash in DashStartDashEnd
        dashNb = Math.max(dashNb, 2);

        const gapNb = dashNb - 1;
        const gapRatio = 1 / (gapNb + dashNb / gapDashRatio);
        const oneGapStep = direction.multiplyByFloats(gapRatio, gapRatio, gapRatio);

        points = [ps, pe.add(oneGapStep)];
      } else if (this.dashAlignType === DashAlignType.DashStartGapEnd) {
        dashNb = Math.floor(distance / (straightDashLength + straightGapLength));
        // at least one dash in DashStartGapEnd
        dashNb = Math.max(dashNb, 1);

        points = [ps, pe];
      } else if (this.dashAlignType === DashAlignType.GapStartDashEnd) {
        dashNb = Math.floor(distance / (straightDashLength + straightGapLength));
        // at least one dash in GapStartDashEnd
        dashNb = Math.max(dashNb, 1);

        const gapNb = dashNb;
        const gapRatio = 1 / (gapNb + dashNb / gapDashRatio);
        const oneGapStep = direction.multiplyByFloats(gapRatio, gapRatio, gapRatio);

        points = [ps.add(oneGapStep), pe.add(oneGapStep)];
      } else if (this.dashAlignType === DashAlignType.GapStartGapEnd) {
        dashNb = Math.floor((distance - straightGapLength) / (straightDashLength + straightGapLength));
        // at least one dash in GapStartGapEnd
        dashNb = Math.max(dashNb, 1);

        const gapNb = dashNb + 1;
        const gapRatio = 1 / (gapNb + dashNb / gapDashRatio);
        const oneGapStep = direction.multiplyByFloats(gapRatio, gapRatio, gapRatio);

        points = [ps.add(oneGapStep), pe];
      }

      const options = {
        points,
        updatable: true,
        dashNb,
        dashSize: this.straightDashSize,
        gapSize: this.straightGapSize,
      };

      tsl = MeshBuilder.CreateDashedLines(this.meshId, options, this.scope.getSceneManager().getContextScene());
      tsl.color = this.color;

      tsl = MeshBuilder.CreateDashedLines(this.meshId, { points, instance: tsl });

      drawingPoints = [...points];
    }

    const resolved = this.scope.calculateNormalsAndTangentsOfStraightSeriePoints(seriePoints);
    const serieTangents = resolved.serieTangents;
    const serieNormals = resolved.serieNormals;
    
    const lineAndCurveItem = {
      points: this.points,
      pointsMesh: this.pointsMesh,
      lineAndCurveMesh: tsl,
      markerDisposed: false,
      category: LineAndCurveCategory.TwoStraightLine,
      drawingPoints: drawingPoints as Vector3[],
      seriePoints,
      serieNormals,
      serieTangents,
      options: {
        lineType: this.lineType,
        lineColor: this.color,
        dashAlignType: this.dashAlignType,
        straightDashLength: this.straightDashLength,
        straightDashSize: this.straightDashSize,
        straightGapSize: this.straightGapSize,
      },
    } as LineAndCurveItem;

    (tsl as LinesMesh).metadata = {
      lineAndCurveItem,
    };

    this.scope.emitEvent(StoreLineAndCurveEvent, lineAndCurveItem);

    this.scope.makeSceneDirty();

    return lineAndCurveItem;
  }

  removeLine() {
    this.scope.emitEvent(RemoveLineAndCurveEvent, {
      id: this.meshId,
      category: LineAndCurveCategory.TwoStraightLine,
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