import {
  Mesh,
  PointerInfo,
  PickingInfo,
  Ray,
  Color3,
  Vector3,
} from "@babylonjs/core";
import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../../core/renderer/config';

export function resolveMouseRayPickingInfoOnSpecificMesh(this: ExtendedNamespace, pointerInfo: PointerInfo, meshId: string) {
  if (!pointerInfo?.pickInfo?.ray) return null;

  const mouseRay = (pointerInfo.pickInfo as PickingInfo).ray as Ray;
  const pickingRay = new Ray(mouseRay.origin, mouseRay.direction, 1000);

  const picked = this.getSceneManager().getContextScene().pickWithRay(pickingRay, (mesh: Mesh) => {
    return mesh.id === meshId;
  });

  return picked || null;
};

export function resolveMouseRayPickingInfoOnDummyXZPlane(this: ExtendedNamespace, pointerInfo: PointerInfo, opts: {
  yOffset: number,
}) {
  const id = "temp_dummy_xz_plane";

  const tempDummyMesh = this.createXZPlane({
    id,
    yOffset: opts.yOffset,
    width: RendererConfig.scene.groundWidth,
    depth: RendererConfig.scene.groundDepth,
    matColor: new Color3(0, 0, 0),
    matAlpha: 0,
  });

  this.makeSceneDirty();

  return this.makeAsync(() => {
    const picked = this.resolveMouseRayPickingInfoOnSpecificMesh(pointerInfo, id);

    tempDummyMesh.dispose();

    return picked;
  });
};

export function resolveMousePickingRoadItemInfo(this: ExtendedNamespace, pointerInfo: PointerInfo) {

  if (!pointerInfo?.pickInfo || !pointerInfo?.pickInfo?.ray) return null;

  const mouseRay = (pointerInfo.pickInfo as PickingInfo).ray as Ray;
  const pickingRay = new Ray(mouseRay.origin, mouseRay.direction, 1000);

  const picked = this.getSceneManager().getContextScene().pickWithRay(pickingRay, (mesh: Mesh) => {
    return mesh.id.endsWith('__LaneMesh');
  });

  if (!picked || !picked.pickedMesh) return null;

  const pickedMesh = picked.pickedMesh;

  return (pickedMesh?.metadata?.belongingRoadItem) || null;
};

export function resolveMousePickingLaneItemInfo(this: ExtendedNamespace, pointerInfo: PointerInfo) {
  if (!pointerInfo?.pickInfo || !pointerInfo?.pickInfo?.ray) return null;

  const mouseRay = (pointerInfo.pickInfo as PickingInfo).ray as Ray;
  const pickingRay = new Ray(mouseRay.origin, mouseRay.direction, 1000);
  const picked = this.getSceneManager().getContextScene().pickWithRay(pickingRay, (mesh: Mesh) => {
    return mesh.id.endsWith('__LaneMesh');
  });

  if (!picked || !picked.pickedMesh) return null;

  const pickedMesh = picked.pickedMesh;

  const belongingRoadItem = pickedMesh?.metadata?.belongingRoadItem;
  const belongingLaneItem = pickedMesh?.metadata?.belongingLaneItem;

  if (!belongingRoadItem || !belongingLaneItem) return null;

  return {
    belongingRoadItem,
    belongingLaneItem,
  };
};

export function resolveMousePickingJunctionItemInfo(this: ExtendedNamespace, pointerInfo: PointerInfo) {
  if (!pointerInfo?.pickInfo || !pointerInfo?.pickInfo?.ray) return null;

  const mouseRay = (pointerInfo.pickInfo as PickingInfo).ray as Ray;
  const pickingRay = new Ray(mouseRay.origin, mouseRay.direction, 1000);

  const picked = this.getSceneManager().getContextScene().pickWithRay(pickingRay, (mesh: Mesh) => {
    return mesh.id.endsWith('__junctionMesh');
  });

  if (!picked || !picked.pickedMesh) return null;

  const pickedMesh = picked.pickedMesh;

  return (pickedMesh?.metadata?.belongingJunctionItem) || null;
};

export function resolveMousePickingSignalItemInfo(this: ExtendedNamespace, pointerInfo: PointerInfo) {
  if (!pointerInfo?.pickInfo || !pointerInfo?.pickInfo?.ray) return null;

  const mouseRay = (pointerInfo.pickInfo as PickingInfo).ray as Ray;
  const pickingRay = new Ray(mouseRay.origin, mouseRay.direction, 1000);

  const picked = this.getSceneManager().getContextScene().pickWithRay(pickingRay, (mesh: Mesh) => {
    return mesh.id.endsWith('__SignalMesh');
  });

  if (!picked || !picked.pickedMesh) return null;

  const pickedMesh = picked.pickedMesh;

  return (pickedMesh?.metadata?.belongingSignalItem) || null;
};

export function resolveMousePickingReferenceLineItemInfo(this: ExtendedNamespace, pointerInfo: PointerInfo) {
  if (!pointerInfo?.pickInfo || !pointerInfo?.pickInfo?.ray) return null;

  const pickInfo = pointerInfo.pickInfo as PickingInfo;
  const mouseRay = (pointerInfo.pickInfo as PickingInfo).ray as Ray;
  const pickingRay = new Ray(mouseRay.origin, mouseRay.direction, 1000);

  const picked = this.getSceneManager().getContextScene().pickWithRay(pickingRay, (mesh: Mesh) => {
    return mesh.id.includes('ReferenceLine');
  });

  if (!picked || !picked.pickedMesh) return null;

  const pickedMesh = picked.pickedMesh;
  const pickedPoint = picked.pickedPoint;

  const belongingRoadItem = pickedMesh.metadata?.belongingRoadItem;

  return {
    belongingRoadItem,
    pickedPoint,
  };
};

export function resolveMousePickingLaneLineItemInfo(this: ExtendedNamespace, pointerInfo: PointerInfo) {
  if (!pointerInfo?.pickInfo || !pointerInfo?.pickInfo?.ray) return null;

  const pickInfo = pointerInfo.pickInfo as PickingInfo;
  const mouseRay = (pointerInfo.pickInfo as PickingInfo).ray as Ray;
  const pickingRay = new Ray(mouseRay.origin, mouseRay.direction, 1000);

  const picked = this.getSceneManager().getContextScene().multiPickWithRay(pickingRay, (mesh: Mesh) => {
    return mesh.id.includes('Inner_Line') || mesh.id.includes('Outer_Line');
  }) as PickingInfo[] | null;

  if (!picked || picked.length === 0) return null;

  return picked.map((p: PickingInfo) => {
    const pickedMesh = p.pickedMesh;
    const pickedPoint = p.pickedPoint;

    const belongingRoadItem = pickedMesh?.metadata?.belongingRoadItem;
    const belongingLaneItem = pickedMesh?.metadata?.belongingLaneItem;
    const belongingLaneLineItem = pickedMesh?.metadata?.lineAndCurveItem;

    return {
      belongingRoadItem,
      belongingLaneItem,
      belongingLaneLineItem,
      pickedPoint,
    };
  });
};

export function resolveMousePickingJunctionEdgeItemInfo(this: ExtendedNamespace, pointerInfo: PointerInfo) {
  if (!pointerInfo?.pickInfo || !pointerInfo?.pickInfo?.ray) return null;

  const pickInfo = pointerInfo.pickInfo as PickingInfo;
  const mouseRay = (pointerInfo.pickInfo as PickingInfo).ray as Ray;
  const pickingRay = new Ray(mouseRay.origin, mouseRay.direction, 1000);

  const picked = this.getSceneManager().getContextScene().pickWithRay(pickingRay, (mesh: Mesh) => {
    return mesh.id.includes('edge');
  });

  if (!picked || !picked.pickedMesh) return null;

  const pickedMesh = picked.pickedMesh;
  const pickedPoint = picked.pickedPoint;

  const belongingJunctionEdgeItem = pickedMesh.metadata?.belongingJunctionEdgeItem;

  return {
    belongingJunctionEdgeItem,
    pickedPoint,
  };
};

export function resolveMousePickingPCSItemInfo(this: ExtendedNamespace, pointerInfo: PointerInfo) {
  if (!pointerInfo?.pickInfo || !pointerInfo?.pickInfo?.ray) return null;

  const pickInfo = pointerInfo.pickInfo as PickingInfo;
  const mouseRay = (pointerInfo.pickInfo as PickingInfo).ray as Ray;
  const pickingRay = new Ray(mouseRay.origin, mouseRay.direction, 1000);

  // fake pick, iterate meshes
  const meshes = [] as Mesh[];
  this.getSceneManager().getContextScene().multiPickWithRay(pickingRay, (mesh: Mesh) => {
    if (mesh.id.includes('RibbonPointsCloudSystem')) {
      meshes.push(mesh);
    }
  });

  return meshes;
};

export function resolveMouseRayPickingInfoOnRoadPlane(this: ExtendedNamespace, pointerInfo: PointerInfo, opts: {
  altitude: number,
}) {
  const id = "temp_dummy_road_plane";

  const tempDummyRoad = this.createXZPlane({
    id,
    yOffset: opts.altitude,
    width: RendererConfig.scene.groundWidth,
    depth: RendererConfig.scene.groundDepth,
    matColor: new Color3(0, 0, 0),
    matAlpha: 0,
  }) as Mesh;

  this.makeSceneDirty();

  return this.makeAsync(() => {
    const picked = this.resolveMouseRayPickingInfoOnSpecificMesh(pointerInfo, id);

    tempDummyRoad.dispose();

    return picked;
  });
};