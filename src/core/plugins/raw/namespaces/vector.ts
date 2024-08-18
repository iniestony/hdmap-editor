import {
  Vector3,
  Path3D,
  Ray,
} from "@babylonjs/core";
import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../renderer/config';

/**
 * calculated normals are on XZ plane
 * for Vector(direction.x, direction.y, direction.z) and Vector(direction.x, 0, direction.z)
 * their normals on XZ plane are the same one
 * thus only consider x and z value of direction
 */
export function calculateVectorNormalOnXZPlane(this: ExtendedNamespace, direction: Vector3) {
  const dx = direction.x;
  const dz = direction.z;

  const nz = (dx) / Math.sqrt(Math.pow(dx, 2) + Math.pow(dz, 2));
  const nx = -nz * (dz / dx);

  const normailized = [
    new Vector3(nx, 0, nz), // left
    new Vector3(-nx, 0, -nz), // right
  ];

  return normailized as Vector3[];
};

/**
 *                A
 *                *
 *              * | *
 *            *   |   *
 *          *   O |     *
 *        *     | |       *
 *      *       | |         *
 *    * * * * * * * * * * * * *
 *   B          M N            C
 * 
 *  OB = OC => BM = BC / 2
 *  Math.pow(AN - OM, 2) + Math.pow(MN, 2) = Math.pow(AO, 2) = Math.pow(BO, 2) = Math.pow(OM, 2) + Math.pow(BC / 2, 2)
 *  OM = (Math.pow(AN, 2) + Math.pow(MN, 2) - Math.pow(BC / 2, 2)) / (2 * AN)
 *     = (Math.pow(AN, 2) + Math.pow(BN - BC / 2, 2) - Math.pow(BC / 2, 2)) / (2 * AN)
 * 
 *  VOM = Vector.cross(VCB, Vector.cross(VBA, VBC))
 */
 export function calculateCenterOfThreeCircleCurve(this: ExtendedNamespace, points: Vector3[]) {
  const A = points[0] as Vector3;
  const B = points[1] as Vector3;
  const C = points[2] as Vector3;

  const VBC = C.subtract(B);
  const VBA = A.subtract(B);
  const VCB = B.subtract(C);

  const LBC = VBC.length();
  const LBA = VBA.length();

  const cosAngleBABC = Vector3.Dot(VBC, VBA) / (LBC * LBA);

  const LBN = cosAngleBABC * LBA;
  const LAN = Math.sqrt(Math.pow(LBA, 2) - Math.pow(LBN, 2));

  // length of OM
  const LOM = (Math.pow(LAN, 2) + Math.pow(LBN - LBC / 2, 2) - Math.pow(LBC / 2, 2)) / (2 * LAN);

  // direction of OM
  const VOM = Vector3.Cross(VCB, Vector3.Cross(VBA, VBC)).normalize();

  const M = B.add(C).multiplyByFloats(0.5, 0.5, 0.5);

  const O = M.subtract(VOM.multiplyByFloats(LOM, LOM, LOM));

  return O as Vector3;
};

export function calculateNormalsAndTangentsOfStraightSeriePoints(this: ExtendedNamespace, seriePoints: Vector3[]) {
  const publicTangent = seriePoints[1].subtract(seriePoints[0]).normalize();
  const publicNormal = this.calculateVectorNormalOnXZPlane(publicTangent)[1] as Vector3;
  
  const serieTangents = new Array(seriePoints.length).fill(publicTangent) as Vector3[];
  const serieNormals = new Array(seriePoints.length).fill(publicNormal) as Vector3[];

  return {
    serieTangents,
    serieNormals,
  };
};

export function calculateNormalsAndTangentsOfCurveSeriePoints(this: ExtendedNamespace, seriePoints: Vector3[]) {
  const path = new Path3D(seriePoints);
  
  const serieTangents = path.getTangents().map((t: Vector3) => {    
    return new Vector3(t.x, 0, t.z).normalize();
  });

  const serieNormals = path.getNormals().map((t: Vector3) => {    
    return new Vector3(t.x, 0, t.z).normalize();
  });

  return {
    serieTangents,
    serieNormals,
  };
};

export function resolveStraightSeriePoints(start: Vector3, end: Vector3) {
  const direction = end.subtract(start);
  const seriePoints = [start];

  for(let i = 0; i < RendererConfig.lineAndCurve.serieSteps; i++) {
    const ratio = (i + 1) / RendererConfig.lineAndCurve.serieSteps;
    seriePoints.push(start.add(direction.multiplyByFloats(ratio, ratio, ratio)));
  }

  return seriePoints;
};

export function resolveRaysIntersection(
  this: ExtendedNamespace,
  startPoint: Vector3,
  startDirection: Vector3,
  endPoint: Vector3,
  endDirection: Vector3,
) {
  const startIntersectionRay = new Ray(startPoint, startDirection.normalize(), 10000);
  const startIntersectionDistance = startIntersectionRay.intersectionSegment(endPoint, endPoint.add(endDirection.normalize().multiplyByFloats(10000, 10000, 10000)), 0.000001);

  if (startIntersectionDistance < 0) return startPoint.add(endPoint.subtract(startPoint).multiplyByFloats(0.5, 0.5, 0.5));

  return startPoint.add(startDirection.normalize().multiplyByFloats(startIntersectionDistance, startIntersectionDistance, startIntersectionDistance));
};

export function resolveControlForQuadraticBezierCurve(this: ExtendedNamespace, seriePoints: Vector3[]) {
  const startPoint = seriePoints[0];
  const endPoint = seriePoints[seriePoints.length - 1];

  const path = new Path3D(seriePoints);
  const serieTangents = path.getTangents();
  const startTangent = serieTangents[0].normalize();
  const endTangent = serieTangents[serieTangents.length - 1].normalize();

  const control = this.resolveRaysIntersection(startPoint, startTangent, endPoint, endTangent.multiplyByFloats(-1, -1, -1));

  return control;
};

export function resolveControlForCubicBezierCurve(this: ExtendedNamespace, seriePoints: Vector3[], distanceStartNearMarker: number, distanceEndNearMarker: number) {
  const startPoint = seriePoints[0];
  const endPoint = seriePoints[seriePoints.length - 1];

  const path = new Path3D(seriePoints);
  const serieTangents = path.getTangents();
  const startTangent = serieTangents[0].normalize();
  const endTangent = serieTangents[serieTangents.length - 1].normalize();

  const controlNearStart = startPoint.add(startTangent.multiplyByFloats(distanceStartNearMarker, distanceStartNearMarker, distanceStartNearMarker));
  const controlNearEnd = endPoint.subtract(endTangent.multiplyByFloats(distanceEndNearMarker, distanceEndNearMarker, distanceEndNearMarker))

  return {
    controlNearStart,
    controlNearEnd,
  };
};

export function resolveNearestVirtualPointPositionViaLineSeriePoints(
  this: ExtendedNamespace,
  seriePoints: Vector3[],
  targetPoint: Vector3,
) {
  const path = new Path3D(seriePoints);

  return path.getClosestPositionTo(targetPoint);
};

export function resolveNearestVirtualPointViaLineSeriePoints(
  this: ExtendedNamespace,
  seriePoints: Vector3[],
  targetPoint: Vector3,
) {
  const path = new Path3D(seriePoints);

  const pos = path.getClosestPositionTo(targetPoint);

  return path.getPointAt(pos);
};

export function resolveNearestActualPrevPointIndexViaLineSeriePoints(
  this: ExtendedNamespace,
  seriePoints: Vector3[],
  targetPoint: Vector3,
) {
  const path = new Path3D(seriePoints);

  const pos = path.getClosestPositionTo(targetPoint);

  return path.getPreviousPointIndexAt(pos);
};

export function isSegmentsIntersectedInProjectedXZPlane(
  this: ExtendedNamespace,
  segmentA: Vector3[],
  segmentB: Vector3[],
) {
  const projectionAS = new Vector3(segmentA[0].x, 0, segmentA[0].z);
  const projectionAE = new Vector3(segmentA[1].x, 0, segmentA[1].z);
  const projectionBS = new Vector3(segmentB[0].x, 0, segmentB[0].z);
  const projectionBE = new Vector3(segmentB[1].x, 0, segmentB[1].z);

  const ray = new Ray(projectionAS, projectionAE.subtract(projectionAS).normalize(), projectionAE.subtract(projectionAS).length() * 2);

  const isInter = ray.intersectionSegment(projectionBS, projectionBE, 0.001) > 0;

  const sameS = Math.abs(projectionAS.x - projectionBS.x) < 0.00001 && Math.abs(projectionAS.z - projectionBS.z) < 0.00001;
  const sameE = Math.abs(projectionAE.x - projectionBE.x) < 0.00001 && Math.abs(projectionAE.z - projectionBE.z) < 0.00001;

  return !sameS && !sameE && isInter;
};

export function isGeoConnectedPoint(this: ExtendedNamespace, newPoint: Vector3, oldPoint: Vector3) {
  const distance = newPoint.subtract(oldPoint).length();

  return distance <= RendererConfig.scene.minimumSeparatePointDistance;
};

export function isSerieStartPoint(this: ExtendedNamespace, point: Vector3, serie: Vector3[]) {
  if (!serie || serie.length === 0) return false;

  return this.isGeoConnectedPoint(point, serie[0]);
};

export function isSerieEndPoint(this: ExtendedNamespace, point: Vector3, serie: Vector3[]) {
  if (!serie || serie.length === 0) return false;

  return this.isGeoConnectedPoint(point, serie[serie.length - 1]);
};