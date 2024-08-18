import {
  Vector3,
  Curve3,
  Mesh,
} from "@babylonjs/core";
import CreateRawCurveRoadTransaction from './createRawCurveRoad';
import { LineAndCurveCategory, RoadCategory, LaneSide, MarkerSide } from '../../plugins/statusManager/type';
import RendererConfig from '../../renderer/config';
import {
  InvokeCreateThreeCircleCurveRoadEvent,
  InvokeRemoveThreeCircleCurveRoadEvent,
} from '../event';

export default class CreateThreeCircleCurveRoadTransaction extends CreateRawCurveRoadTransaction {
  constructor(options: Object) {
    super(options);

    this.referenceLineCategory = LineAndCurveCategory.ThreeCircleCurve;
    this.roadCategory = RoadCategory.ThreeCircleCurveRoad;
  }

  createCurve(points: Vector3[]) {
    return Curve3.ArcThru3Points(
      points[0],
      points[1],
      points[2],
      RendererConfig.lineAndCurve.serieSteps,
    );
  }

  createLaneLineMarkers(seriePoints: Vector3[], isLaneLine: boolean, laneSide: LaneSide) {
    const first = 0;
    const last = seriePoints.length - 1;
    const half = Math.floor(seriePoints.length / 2);

    const markerStart = this.scope.createMarker(seriePoints[first], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerStart.metadata = {
      markerSide: MarkerSide.Start,
    };

    const markerMiddle = this.scope.createMarker(seriePoints[half], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerMiddle.metadata = {
      markerSide: MarkerSide.Middle,
    };
    
    const markerEnd = this.scope.createMarker(seriePoints[last], RendererConfig.mesh.reflineMarkerColor) as Mesh;
    markerEnd.metadata = {
      markerSide: MarkerSide.End,
    };

    if (!isLaneLine) {
      return {
        points: [seriePoints[first], seriePoints[last]],
        pointsMesh: [markerStart, markerEnd],
      };
    }

    return {
      points: [seriePoints[first], seriePoints[half], seriePoints[last]],
      pointsMesh: [markerStart, markerMiddle, markerEnd],
    };
  }

  commit() {
    const result = super.commit();

    this.scope.emitEvent(InvokeCreateThreeCircleCurveRoadEvent, {
      roadId: this.meshId,
    });

    return result;
  }

  onUndo() {
    super.onUndo();

    this.scope.emitEvent(InvokeRemoveThreeCircleCurveRoadEvent, {
      roadId: this.meshId,
    });
  }

  onRedo() {
    super.onRedo();

    this.scope.emitEvent(InvokeCreateThreeCircleCurveRoadEvent, {
      roadId: this.meshId,
    });
  }
};