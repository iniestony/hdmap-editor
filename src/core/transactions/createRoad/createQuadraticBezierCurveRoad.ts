import {
  Vector3,
  Curve3,
  Mesh,
} from "@babylonjs/core";
import CreateRawCurveRoadTransaction from './createRawCurveRoad';
import { LineAndCurveCategory, RoadCategory, LaneSide, MarkerSide } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';
import {
  InvokeCreateQuadraticBezierCurveRoadEvent,
  InvokeRemoveQuadraticBezierCurveRoadEvent,
} from '../event';

export default class CreateQuadraticBezierCurveRoadTransaction extends CreateRawCurveRoadTransaction {
  constructor(options: Object) {
    super(options);

    this.referenceLineCategory = LineAndCurveCategory.QuadraticBezierCurve;
    this.roadCategory = RoadCategory.QuadraticBezierCurveRoad;
  }

  createCurve(points: Vector3[]) {
    return Curve3.CreateQuadraticBezier(
      points[0], // origin
      points[2], // control
      points[1], // destination
      RendererConfig.lineAndCurve.serieSteps,
    );
  }

  createLaneLineMarkers(seriePoints: Vector3[], isLaneLine: boolean, laneSide: LaneSide) {
    const first = 0;
    const last = seriePoints.length - 1;

    if (!isLaneLine) {
      const markerStart = this.scope.createMarker(seriePoints[first], RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerStart.metadata = {
        markerSide: MarkerSide.Start,
      };
      
      const markerEnd = this.scope.createMarker(seriePoints[last], RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerEnd.metadata = {
        markerSide: MarkerSide.End,
      };

      return {
        points: [seriePoints[first], seriePoints[last]],
        pointsMesh: [markerStart, markerEnd],
      };
    }

    const detailReflineSeriePoints = Curve3.CreateQuadraticBezier(
      this.points[0],
      this.points[2],
      this.points[1],
      10000,
    ).getPoints();

    const resolved = this.scope.calculateNormalsAndTangentsOfCurveSeriePoints(detailReflineSeriePoints);
    const detailReflineSerieNormals = resolved.serieNormals;

    if (laneSide === LaneSide.Left) {
      // serie.start - refline.end
      const lineDistanceFromRefLine = seriePoints[0].subtract(this.points[1]).length();

      const detailLineSeriePoints = detailReflineSeriePoints.map((v: Vector3, idx: number) => {
        return v.add(detailReflineSerieNormals[idx].multiplyByFloats(-lineDistanceFromRefLine, -lineDistanceFromRefLine, -lineDistanceFromRefLine));
      }).reverse();

      const control = this.scope.resolveControlForQuadraticBezierCurve(detailLineSeriePoints);

      const markerStart = this.scope.createMarker(seriePoints[first], RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerStart.metadata = {
        markerSide: MarkerSide.Start,
      };
      
      const markerEnd = this.scope.createMarker(seriePoints[last], RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerEnd.metadata = {
        markerSide: MarkerSide.End,
      };

      const markerControl = this.scope.createMarker(control, RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerControl.metadata = {
        markerSide: MarkerSide.Control,
      };

      return {
        points: [seriePoints[first], seriePoints[last], control],
        pointsMesh: [markerStart, markerEnd, markerControl],
      };
    } else if (laneSide === LaneSide.Right) {
      // serie.start - refline.start
      const lineDistanceFromRefLine = seriePoints[0].subtract(this.points[0]).length();

      const detailLineSeriePoints = detailReflineSeriePoints.map((v: Vector3, idx: number) => {
        return v.add(detailReflineSerieNormals[idx].multiplyByFloats(lineDistanceFromRefLine, lineDistanceFromRefLine, lineDistanceFromRefLine));
      });

      const control = this.scope.resolveControlForQuadraticBezierCurve(detailLineSeriePoints);

      const markerStart = this.scope.createMarker(seriePoints[first], RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerStart.metadata = {
        markerSide: MarkerSide.Start,
      };
      
      const markerEnd = this.scope.createMarker(seriePoints[last], RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerEnd.metadata = {
        markerSide: MarkerSide.End,
      };

      const markerControl = this.scope.createMarker(control, RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerControl.metadata = {
        markerSide: MarkerSide.Control,
      };

      return {
        points: [seriePoints[first], seriePoints[last], control],
        pointsMesh: [markerStart, markerEnd, markerControl],
      };
    }

    return {};
  }

  commit() {
    const result = super.commit();

    this.scope.emitEvent(InvokeCreateQuadraticBezierCurveRoadEvent, {
      roadId: this.meshId,
    });

    return result;
  }

  onUndo() {
    super.onUndo();

    this.scope.emitEvent(InvokeRemoveQuadraticBezierCurveRoadEvent, {
      roadId: this.meshId,
    });
  }

  onRedo() {
    super.onRedo();

    this.scope.emitEvent(InvokeCreateQuadraticBezierCurveRoadEvent, {
      roadId: this.meshId,
    });
  }
};