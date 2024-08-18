import {
  Vector3,
  Curve3,
  Mesh,
} from "@babylonjs/core";
import CreateRawCurveRoadTransaction from './createRawCurveRoad';
import { LineAndCurveCategory, RoadCategory, LaneSide, MarkerSide } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';
import {
  InvokeCreateCubicBezierCurveRoadEvent,
  InvokeRemoveCubicBezierCurveRoadEvent,
} from '../event';

export default class CreateCubicBezierCurveRoadTransaction extends CreateRawCurveRoadTransaction {
  constructor(options: Object) {
    super(options);

    this.referenceLineCategory = LineAndCurveCategory.CubicBezierCurve;
    this.roadCategory = RoadCategory.CubicBezierCurveRoad;
  }

  createCurve(points: Vector3[]) {
    return Curve3.CreateCubicBezier(
      points[0], // origin
      points[2], // control1
      points[3], // control2
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

    // ref line marker-handler distance
    const reflineDistanceStartNearMarker = this.points[0].subtract(this.points[2]).length();
    const reflineDistanceEndNearMarker = this.points[1].subtract(this.points[3]).length();

    const detailReflineSeriePoints = Curve3.CreateCubicBezier(
      this.points[0],
      this.points[2],
      this.points[3],
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

      const distanceStartNearMarker = reflineDistanceEndNearMarker;
      const distanceEndNearMarker = reflineDistanceStartNearMarker;
      const controls = this.scope.resolveControlForCubicBezierCurve(detailLineSeriePoints, distanceStartNearMarker, distanceEndNearMarker);

      const markerStart = this.scope.createMarker(seriePoints[first], RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerStart.metadata = {
        markerSide: MarkerSide.Start,
      };
      
      const markerEnd = this.scope.createMarker(seriePoints[last], RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerEnd.metadata = {
        markerSide: MarkerSide.End,
      };

      const markerControlNearStart = this.scope.createMarker(controls.controlNearStart, RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerControlNearStart.metadata = {
        markerSide: MarkerSide.ControlNearStart,
      };

      const markerControlNearEnd = this.scope.createMarker(controls.controlNearEnd, RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerControlNearEnd.metadata = {
        markerSide: MarkerSide.ControlNearEnd,
      };

      return {
        points: [seriePoints[first], seriePoints[last], controls.controlNearStart, controls.controlNearEnd],
        pointsMesh: [markerStart, markerEnd, markerControlNearStart, markerControlNearEnd],
      };
    } else if (laneSide === LaneSide.Right) {
      // serie.start - refline.start
      const lineDistanceFromRefLine = seriePoints[0].subtract(this.points[0]).length();

      const detailLineSeriePoints = detailReflineSeriePoints.map((v: Vector3, idx: number) => {
        return v.add(detailReflineSerieNormals[idx].multiplyByFloats(lineDistanceFromRefLine, lineDistanceFromRefLine, lineDistanceFromRefLine));
      });

      const distanceStartNearMarker = reflineDistanceStartNearMarker;
      const distanceEndNearMarker = reflineDistanceEndNearMarker;
      const controls = this.scope.resolveControlForCubicBezierCurve(detailLineSeriePoints, distanceStartNearMarker, distanceEndNearMarker);

      const markerStart = this.scope.createMarker(seriePoints[first], RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerStart.metadata = {
        markerSide: MarkerSide.Start,
      };
      
      const markerEnd = this.scope.createMarker(seriePoints[last], RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerEnd.metadata = {
        markerSide: MarkerSide.End,
      };

      const markerControlNearStart = this.scope.createMarker(controls.controlNearStart, RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerControlNearStart.metadata = {
        markerSide: MarkerSide.ControlNearStart,
      };

      const markerControlNearEnd = this.scope.createMarker(controls.controlNearEnd, RendererConfig.mesh.reflineMarkerColor) as Mesh;
      markerControlNearEnd.metadata = {
        markerSide: MarkerSide.ControlNearEnd,
      };

      return {
        points: [seriePoints[first], seriePoints[last], controls.controlNearStart, controls.controlNearEnd],
        pointsMesh: [markerStart, markerEnd, markerControlNearStart, markerControlNearEnd],
      };
    }

    return {};
  }

  commit() {
    const result = super.commit();

    this.scope.emitEvent(InvokeCreateCubicBezierCurveRoadEvent, {
      roadId: this.meshId,
    });

    return result;
  }

  onUndo() {
    super.onUndo();

    this.scope.emitEvent(InvokeRemoveCubicBezierCurveRoadEvent, {
      roadId: this.meshId,
    });
  }

  onRedo() {
    super.onRedo();

    this.scope.emitEvent(InvokeCreateCubicBezierCurveRoadEvent, {
      roadId: this.meshId,
    });
  }
};