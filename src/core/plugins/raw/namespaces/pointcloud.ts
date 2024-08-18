import { ExtendedNamespace } from "@/core/types/plugins/raw";
import {
  CloudPoint,
  Vector3,
  Color4,
  Color3,
  PointsCloudSystem,
  Mesh,
  MeshBuilder,
} from "@babylonjs/core";
import { LoadOctreePointCloud } from "@/core/plugins/octreeLoader/constant";
import { PcdInfo, PcdVizOption } from "../../pcdLoader/type";
import RendererConfig from "../../../../core/renderer/config";
import { OctreeInfo, AlterLASInfo, LASVizOption } from "../../octreeLoader/type";
import { clamp } from "@/core/utils/math";

// storage
const pointcloudOptions: { viz: AlterLASInfo } = {
  viz: {
    lasIntensityRanges: [],
    lasIntensitySection: { min: RendererConfig.scene.pointCloudColorIntensityMin, max: RendererConfig.scene.pointCloudColorIntensityMax },
    lasPointSize: 1,
    lasVizOption: LASVizOption.Intensity,
    octreeInfo: undefined,
  },
};

const cachedPCDInfoMap: Map<string, PcdInfo> = new Map();


export async function loadOctreePointCloud(
  this: ExtendedNamespace
) {
  const octreeInfo = {
    pointcloud: {
      worldTransform: {
        position: { x: 567.6701812744141, y: -49.41612720489502, z: 25.427024364471436 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      },
      bbox: {
        min: { x: 492.6741638183594, y: -124.41253662109375, z: 5.635024070739746 },
        max: { x: 642.6661987304688, y: 25.58028221130371, z: 45.219024658203125 },
      },
    },
    octree: {
      bbox: {
        min: { x: 492.6741638183594, y: -124.41253662109375, z: 5.635024070739746 },
        max: { x: 642.6661987304688, y: 25.58028221130371, z: 45.219024658203125 },
      },
      levels: 2,
      visibleNodes: [1, 11],
      visibleNodePoints: [1000000, 1000000]
    }
  } as OctreeInfo;

  this.emitEvent(LoadOctreePointCloud, { octreeInfo });
};

export async function loadOctreeNode(
  this: ExtendedNamespace,
  id: number,
): Promise<{
  mesh: Mesh;
  pcdInfo: PcdInfo;
} | undefined> {
  const cacheId = `Octree_PCD__${id}`;
  const cacheInfo = cachedPCDInfoMap.get(cacheId);

  if (cacheInfo) {
    const mesh = await this.createOctreeNodeMeshWithIntensity(cacheInfo, id);

    return {
      mesh,
      pcdInfo: cacheInfo,
    };
  }

  const pcdInfo = await this.loadPcdWithIntensity(`/demo.pcd`);
  cachedPCDInfoMap.set(cacheId, pcdInfo);

  const mesh = await this.createOctreeNodeMeshWithIntensity(pcdInfo, id);

  return {
    mesh,
    pcdInfo,
  };
};

export function setPointCloudInfo(opts: AlterLASInfo) {
  pointcloudOptions.viz = opts;
};

export function getPointCloudInfo(): AlterLASInfo {
  return pointcloudOptions.viz;
};

export async function createOctreeNodeMeshWithIntensity(
  this: ExtendedNamespace,
  pcdInfo: PcdInfo,
  id: string,
) {
  const vizOpts = this.getPointCloudInfo() as AlterLASInfo;
  if (!vizOpts.octreeInfo) return
  const colors = this.genLasColorGradient(vizOpts.lasVizOption);
  const minHeight = vizOpts.octreeInfo.octree.bbox.min.z;
  const maxHeight = vizOpts.octreeInfo.octree.bbox.max.z;

  const pcs = new PointsCloudSystem(
    "RibbonPointsCloudSystem",
    vizOpts.lasPointSize,
    this.getSceneManager().getContextScene()
  );

  const positions = pcdInfo.positions as Float32Array;
  const intensities = pcdInfo.intensities as Float32Array;
  const pointsNum = intensities.length;


  const formatPointCloud = (cloudPoint: CloudPoint, i: number) => {
    
    // switch y and z
    cloudPoint.position = new Vector3(
      positions[i * 3 + 0],
      positions[i * 3 + 2],
      positions[i * 3 + 1]
    );

    if (vizOpts.lasVizOption === LASVizOption.Intensity) {
      if (intensities) {
        const intensity = intensities[cloudPoint.idx];
        const bars = vizOpts.lasIntensityRanges;
        
        let idx = 0;
        if (intensity > vizOpts.lasIntensitySection.max) {
          if (bars.length > 0) {
            idx = bars.length - 1
          }

        } else if (intensity < vizOpts.lasIntensitySection.min) {
          idx = 0
        } else {
          for (let i = 0; i < bars.length - 2; i++) {
            if (intensity >= bars[i] && intensity < bars[i + 1]) {
              idx = i;
              break;
            }
          }
        }
        // if(idx >= 0){
        const color3 = Color3.FromHexString(colors[idx]);
        cloudPoint.color = new Color4(color3.r, color3.g, color3.b, 1);
      }
    } else if (vizOpts.lasVizOption === LASVizOption.Height) {

      const height = cloudPoint.position.y;

      let ratio = (height - minHeight) / (maxHeight - minHeight);
      ratio = Math.floor(ratio * RendererConfig.scene.pointCloudColorLinearRangeNum);

      const idx = clamp(ratio, 0, RendererConfig.scene.pointCloudColorLinearRangeNum - 1);

      const color3 = Color3.FromHexString(colors[idx]);
      cloudPoint.color = new Color4(color3.r, color3.g, color3.b, 1);
    }

  };

  pcs.addPoints(pointsNum, formatPointCloud);

  const mesh = await pcs.buildMeshAsync();
  mesh.metadata = {
    id: id,
    positions: pcdInfo.positions as Float32Array
  }
  return mesh;
};
