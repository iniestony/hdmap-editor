import {
  CloudPoint,
  Vector3,
  Color3,
  Color4,
  PointsCloudSystem,
  Mesh,
  ArcRotateCamera,
} from "@babylonjs/core";
import ColorGradient from "javascript-color-gradient";
import { ExtendedNamespace } from '../../../types/plugins/raw';
import RendererConfig from '../../../../core/renderer/config';
import {
  LASTileInfo,
  LASInfo,
  LASVizOption,
  LasTilesRange,
} from '../../../../core/plugins/lasLoader/type';
import {
  LoadLASEvent,
  ColorSinglePointsCloudSystem,
  ClearCrossFrameTaskEvent,
  AddCrossFrameTaskEvent,
} from '../../../../core/plugins/lasLoader/constant';

import {
  AlterGroundAltitudeEvent,
} from '../../mouseInteractor/constant';
import { PcdInfo } from "../../pcdLoader/type";

export async function getProjectInfo(
  this: ExtendedNamespace,
  projectId: string,
) {
  return this.createHttpRequest({
    method: 'get',
    ns: `v1/project/${projectId}`,
  });
};

export async function getLasPointCloudInfo(
  this: ExtendedNamespace,
  lasId: string,
) {
  return this.createHttpRequest({
    method: 'get',
    ns: `v1/pointcloud/${lasId}`,
  });
};

export function genLasColorGradient(this: ExtendedNamespace, vizOption: LASVizOption) {
  const colorGradient = new ColorGradient();

  if (vizOption === LASVizOption.Intensity) {
    const hexPath = RendererConfig.scene.pointCloudIntensityColorPath.map((c: Color3) => {
      return c.toHexString();
    });
    const colorCount = RendererConfig.scene.pointCloudColorIntensityShare
    return colorGradient.setColorGradient(...hexPath).setMidpoint(colorCount).getColors();
  } else if (vizOption === LASVizOption.Height) {

    const hexPath = RendererConfig.scene.pointCloudHeightColorPath.map((c: Color3) => {
      return c.toHexString();
    });

    return colorGradient.setColorGradient(...hexPath).setMidpoint(RendererConfig.scene.pointCloudColorLinearRangeNum).getColors();
  }

  return [] as string[];
};

export function genLasColorSections(this: ExtendedNamespace, min: number, max: number) {
  const share = RendererConfig.scene.pointCloudColorIntensityShare;
  let difference = max - min;
  let average = difference / share;
  const array = [min];
  for (let i = 0; i < share - 2; i++) {
    const sum = min + i * average
    array.push(sum);
  }
  array.push(max);
  return array as number[];
}
export function getLasTilesRange(this: ExtendedNamespace,
  options: {
    lasId: string;
    level: number;
    tileX: number;
    tileY: number;
  }[]) {
  const lasTilesRange = [];
  for (let i = 0; i < options.length; i++) {
    const start = 1 / Math.pow(4, i);
    let last = 1 / Math.pow(4, i + 1);
    if (i === options.length - 1) {
      last = 0;
    };
    lasTilesRange.push({
      level: options[i].level,
      viewDistanceSection: [start, last]
    } as LasTilesRange);
  }
  return lasTilesRange as LasTilesRange[];
};

export function loadLASPointCloud(this: ExtendedNamespace, lasId: string) {
  this.emitEvent(LoadLASEvent, { lasId });
};

export async function loadLasTilePoints(
  this: ExtendedNamespace,
  options: {
    lasId: string;
    level: number;
    tileX: number;
    tileY: number;
  },
) {
  const url = this.createGetUrl({
    ns: `v1/pointcloud/${options.lasId}/tile/${options.level}/${options.tileX}/${options.tileY}`,
  });

  const response = await fetch(url);

  if (response.status >= 200 && response.status < 400) {
    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength > 10) {
      return this.parsePcdWithIntensity(arrayBuffer);
    } else {
      return {
        header: {},
        positions: null,
        intensities: null,
        colors: null,
      } as PcdInfo;
    }
  } else {
    return {
      header: {},
      positions: null,
      intensities: null,
      colors: null,
    } as PcdInfo;
  }
};

export function normalizeLASPositionVector(this: ExtendedNamespace, lasInfo: LASInfo, position: Vector3) {
  const { xcenter, ycenter, zcenter } = lasInfo.pointRange;

  return new Vector3(position.x - xcenter, position.y - zcenter, position.z - ycenter);
};

export function denormalizeLASPositionVector(this: ExtendedNamespace, lasInfo: LASInfo, position: Vector3) {
  const { xcenter, ycenter, zcenter } = lasInfo.pointRange;

  return new Vector3(position.x + xcenter, position.y + zcenter, position.z + ycenter);
};

export function alterOrbitCameraViewOnLasInfo(this: ExtendedNamespace, lasInfo: LASInfo) {
  const contextScene = this.getSceneManager().getContextScene();
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  const { xcenter, ycenter, zcenter } = lasInfo.pointRange;
  const { xmax, xmin, ymax, ymin, zmax, zmin } = lasInfo.pointRange;

  const groundAltitude = zmin;
  const height = zmax - groundAltitude;
  const depth = ymax - ymin;

  // init target new Vector3(xcenter, zcenter, ycenter), normalized to Zero Point
  activeCamera.target = this.normalizeLASPositionVector(lasInfo, new Vector3(xcenter, zcenter, ycenter));

  activeCamera.setPosition(this.normalizeLASPositionVector(lasInfo, new Vector3(
    xcenter,
    zmax + RendererConfig.orbitCamera.targetHeightOffset,
    ymin - RendererConfig.orbitCamera.targetDepthOffset,
  )));


  const initRadius = activeCamera.radius;
  activeCamera.lowerRadiusLimit = initRadius * RendererConfig.orbitCamera.lowerRadiusRatioOnInitRadius;
  activeCamera.upperRadiusLimit = initRadius * RendererConfig.orbitCamera.upperRadiusRatioOnInitRadius;

  // - zenter to normalize 
  // this.emitEvent(AlterGroundAltitudeEvent, groundAltitude + 0.25 * height - zcenter);
  this.emitEvent(AlterGroundAltitudeEvent, RendererConfig.scene.groundDefaultAltitude - zcenter);
  this.makeSceneDirty();
};


export function resolveLevelViaLasInfo(this: ExtendedNamespace, lasInfo: LASInfo) {
  const contextScene = this.getSceneManager().getContextScene();
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  const currentRadius = activeCamera.radius as number;

  const lowerRadiusLimit = activeCamera.lowerRadiusLimit as number;
  const upperRadiusLimit = activeCamera.upperRadiusLimit as number;

  const radiusRatio = (currentRadius - lowerRadiusLimit) / (upperRadiusLimit - lowerRadiusLimit);
  const lasTilesRange = this.getLasTilesRange(lasInfo.tiles);
  let level = 0;
  for (let i = 0; i < lasTilesRange.length; i++) {
    if (radiusRatio >= lasTilesRange[i].viewDistanceSection[1] && radiusRatio <= lasTilesRange[i].viewDistanceSection[0]) {
      level = i;
      break;
    }
  }
  return level;
};


export function resolveTileXYViaLasInfoAndLevelInfo(
  this: ExtendedNamespace,
  lasInfo: LASInfo,
  level: number,
) {
  const levelInfo = lasInfo.tiles.filter((tile: LASTileInfo) => {
    return tile.level === level;
  })[0] as LASTileInfo;

  if (!levelInfo) return;

  const levelTileSize = levelInfo.tileSize;
  const { xmin, ymin } = lasInfo.pointRange;

  const cameraTarget = this.resolveOrbitCameraTargetInWorld() as Vector3;
  const denormalizedCameraTarget = this.denormalizeLASPositionVector(lasInfo, cameraTarget);

  const tileX = Math.floor((denormalizedCameraTarget.x - xmin) / levelTileSize);
  const tileY = Math.floor((denormalizedCameraTarget.z - ymin) / levelTileSize);

  return {
    tileX,
    tileY,
  };
};

export function expandCenterTileXYToNearTilesXY(
  this: ExtendedNamespace,
  lasInfo: LASInfo,
  level: number,
  centerX: number,
  centerY: number,
) {
  const levelInfo = lasInfo.tiles.filter((tile: LASTileInfo) => {
    return tile.level === level;
  })[0] as LASTileInfo;


  const lasTilesRange = this.getLasTilesRange(lasInfo.tiles);

  // 得出当前层级的比例值下标0, 表示进入当前层级, 下标1是离开当前层级
  const viewDistanceSectionFirst = lasTilesRange.filter((lasTilesRange: LasTilesRange) => {
    return lasTilesRange.level === level;
  })[0].viewDistanceSection[0];

  if (!levelInfo) return;

  // levelInfo.tileX 是接口X轴最大格子数   乘比例值得出缩放后的格子数  /2 是因为下面算法以移动的中心点往-x x y -y 4个方向去扩展
  let xLen = Math.ceil((levelInfo.tileX * viewDistanceSectionFirst) / 2);

  // levelInfo.tileY 是接口y轴最大格子数   乘比例值得出缩放后的格子数  /2 是因为下面算法以移动的中心点往-x x y -y 4个方向去扩展
  let yLen = Math.ceil((levelInfo.tileY * viewDistanceSectionFirst) / 2);

  if (xLen > 2) { xLen = 2 };

  if (yLen > 2) { yLen = 2 };

  const tiles: { x: number; y: number }[] = [];

  const conditionalPush = (_x: number, _y: number) => {
    if (_x >= 0 && _x < levelInfo.tileX && _y >= 0 && _y < levelInfo.tileY) {
      tiles.push({
        x: _x,
        y: _y,
      });
    }
  };

  const formInX = (_x: number) => {
    conditionalPush(_x, centerY);

    for (let i = 1; i <= yLen; i++) {
      conditionalPush(_x, centerY - i);
      conditionalPush(_x, centerY + i);
    }
  };

  formInX(centerX);

  for (let i = 1; i <= xLen; i++) {
    formInX(centerX - i);
    formInX(centerX + i);
  }

  return tiles;
};

export async function resolveAllRelatedTilesPcdInfo(
  this: ExtendedNamespace,
  cachedTilePcdInfo: Map<string, PcdInfo>,
  lasInfo: LASInfo,
  opts: {
    level: number,
    tileX: number,
    tileY: number,
  },
) {
  const tilesXYInfo = this.expandCenterTileXYToNearTilesXY(lasInfo, opts.level, opts.tileX, opts.tileY);

  const rawTiles = await Promise.all(tilesXYInfo.map((tInfo: { x: number; y: number }) => {
    return (async () => {
      const cachedKey = `${lasInfo.id}-${opts.level}-${tInfo.x}-${tInfo.y}`;
      const cachedPcdInfo = cachedTilePcdInfo.get(cachedKey);

      if (cachedPcdInfo) {
        return {
          cachedKey,
          pcdInfo: cachedPcdInfo,
        };
      }

      const loadedPcdInfo = await this.loadLasTilePoints({
        lasId: lasInfo.id,
        level: opts.level,
        tileX: tInfo.x,
        tileY: tInfo.y,
      });

      if (loadedPcdInfo && loadedPcdInfo.positions) {
        cachedTilePcdInfo.set(cachedKey, loadedPcdInfo);
      }

      return {
        cachedKey,
        pcdInfo: loadedPcdInfo,
      };
    })();
  }));

  return rawTiles.filter((rt: {
    cachedKey: string,
    pcdInfo: PcdInfo,
  }) => {
    return !!rt.pcdInfo.positions;
  });
};

export  function resolveACloudPoint2D(this: ExtendedNamespace, point: Vector3) {
  const scope = this as unknown as ExtendedNamespace;

  const contextCanvas = scope.getSceneManager().contextCanvas;
  const height = contextCanvas.height;
  const width = contextCanvas.width;

  const contextScene = scope.getSceneManager().getContextScene();
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  const transform = activeCamera.getTransformationMatrix();
  const v = Vector3.TransformCoordinates(point, transform);
  
  const height2 = height / 2
  const width2 = width / 2

  const pixelX = Math.round((v.x * width2) + width2);
  const pixelY = Math.round((-v.y * height2) + height2);


  if (pixelX >= 0 && pixelX <= width && pixelY >= 0 && pixelY <= height) {
    return { pixelX: pixelX, pixelY: pixelY };
  }

  return null;
}

export async function createLASPointCloudMesh(
  this: ExtendedNamespace,
  cachedTilePcdInfo: Map<string, PcdInfo>,
  currentPointsCloudSystemCollection: Map<string, PointsCloudSystem>,
  lasInfo: LASInfo,
  opts: {
    level: number,
    tileX: number,
    tileY: number,
  },
  lasPointSize: number,
) {
  this.emitEvent(ClearCrossFrameTaskEvent);

  const relatedTiles = await this.resolveAllRelatedTilesPcdInfo(cachedTilePcdInfo, lasInfo, {
    level: opts.level,
    tileX: opts.tileX,
    tileY: opts.tileY,
  }) as Array<{
    cachedKey: string,
    pcdInfo: PcdInfo,
  }>;

  const involvedKeys = [...currentPointsCloudSystemCollection.keys()];

  const pcsPromiseCollection = relatedTiles.map((tile: {
    cachedKey: string,
    pcdInfo: PcdInfo,
  }, tileIdx: number) => {

    return async () => {
      const isExist = involvedKeys.indexOf(tile.cachedKey) >= 0;
      if (isExist) return;

      const genPCSAction = async () => {
        const pcs = new PointsCloudSystem("RibbonPointsCloudSystem", lasPointSize, this.getSceneManager().getContextScene());
        pcs.vars.pcdIntensities = [] as number[];

        const pcdInfo = tile.pcdInfo;

        const positions = pcdInfo.positions as Float32Array;
        const pointsNum = positions.length / 3;

        const formatPointCloud = (cloudPoint: CloudPoint, globalIdx: number, groupIdx: number) => {
          // switch y and z
          cloudPoint.position = this.normalizeLASPositionVector(lasInfo, new Vector3(
            positions[groupIdx * 3 + 0],
            positions[groupIdx * 3 + 2],
            positions[groupIdx * 3 + 1],
          ));

          cloudPoint.color = new Color4(
            RendererConfig.scene.pointCloudDefaultColor.r,
            RendererConfig.scene.pointCloudDefaultColor.g,
            RendererConfig.scene.pointCloudDefaultColor.b,
            1,
          );
        };

        pcs.addPoints(pointsNum, formatPointCloud);

        // update ref info
        const intensities = pcdInfo.intensities as Float32Array;
        for (let i = 0; i < intensities.length; i++) {
          pcs.vars.pcdIntensities.push(intensities[i]);
        }

        currentPointsCloudSystemCollection.set(tile.cachedKey, pcs);

        await pcs.buildMeshAsync();

        this.emitEvent(ColorSinglePointsCloudSystem, { pcs });

        this.makeSceneDirty();
      };

      if (tileIdx < RendererConfig.frame.firstSceneTileOffset) {
        await genPCSAction();
      } else {
        this.emitEvent(AddCrossFrameTaskEvent, { task: genPCSAction });
      }
    };
  });

  await Promise.all(pcsPromiseCollection.map((gp: () => Promise<any>) => {
    return gp();
  }));
};