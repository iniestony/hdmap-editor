import {
  BoundingInfo,
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
  Field,
  Type,
  Data,
  PcdHeader,
  PcdInfo,
  PcdOffsets,
  PcdVizOption,
} from '../../../../core/plugins/pcdLoader/type';
import {
  LoadPCDEvent,
  SetPCDInfoEvent,
} from '../../../../core/plugins/pcdLoader/constant';
import {
  AlterGroundAltitudeEvent,
} from '../../mouseInteractor/constant';

export function genPcdColorGradient(this: ExtendedNamespace, vizOption: PcdVizOption) {
  const colorGradient = new ColorGradient();

  if (vizOption === PcdVizOption.Intensity) {
    const hexPath = RendererConfig.scene.pointCloudIntensityColorPath.map((c: Color3) => {
      return c.toHexString();
    });
  
    return colorGradient.setColorGradient(...hexPath).setMidpoint(RendererConfig.scene.pointCloudColorLinearRangeNum).getColors();
  } else if (vizOption === PcdVizOption.Height) {
    const hexPath = RendererConfig.scene.pointCloudHeightColorPath.map((c: Color3) => {
      return c.toHexString();
    });
  
    return colorGradient.setColorGradient(...hexPath).setMidpoint(RendererConfig.scene.pointCloudColorLinearRangeNum).getColors();
  }
  
  return [] as string[];
};

export function genPCDRange(this: ExtendedNamespace, start: number, end: number) {
  return new Array(end - start).fill(0).map((_, i) => i + start);
};

export function extractPCDHeaderAndBody(this: ExtendedNamespace, buffer: ArrayBuffer) {
  const chars = new Uint8Array(buffer);
  
  let header = "";

  let i = 0;
  for (; i < chars.length && header.search(/[\r\n]DATA\s(\S*)\s/i) === -1; i++) {
    header += String.fromCharCode(chars[i]);
  }

  return {
    header: header.replace(/\#.*/gi, ""),
    body: buffer.slice(i),
  };
};

export function parsePCDHeaderAndBody(this: ExtendedNamespace, buffer: ArrayBuffer) {
  const { header, body } = this.extractPCDHeaderAndBody(buffer);

  const versionMatch = /VERSION (.*)/i.exec(header);
  if (versionMatch === null) {
    throw new Error("Missing version");
  }
  const version = parseFloat(versionMatch[1]);

  const fieldsMatch = /FIELDS (.*)/i.exec(header);
  if (!fieldsMatch) {
    throw new Error("Missing fields");
  }
  const fields = fieldsMatch[1].split(" ") as Field[];

  const sizeMatch = /SIZE (.*)/i.exec(header);
  if (!sizeMatch) {
    throw new Error("Missing size");
  }
  const size = sizeMatch[1].split(" ").map(_ => parseInt(_, 10));

  const typeMatch = /TYPE (.*)/i.exec(header);
  if (!typeMatch) {
    throw new Error("Missing type");
  }
  const type = typeMatch[1].split(" ") as Type[];

  const countMatch = /COUNT (.*)/i.exec(header);
  let optionalCount: number[] | null = null;
  if (countMatch) {
    optionalCount = countMatch[1].split(" ").map(_ => parseInt(_, 10));
  }
  const count = optionalCount || fields.map(_ => 1);

  const widthMatch = /WIDTH (.*)/i.exec(header);
  if (!widthMatch) {
    throw new Error("Missing width");
  }
  const width = parseInt(widthMatch[1], 10);

  const heightMatch = /HEIGHT (.*)/i.exec(header);
  if (!heightMatch) {
    throw new Error("Missing height");
  }
  const height = parseInt(heightMatch[1], 10);

  const pointsMatch = /POINTS (.*)/i.exec(header);
  let optionalPoints: number | null = null;
  if (pointsMatch) {
    optionalPoints = parseInt(pointsMatch[1], 10);
  }
  const points = optionalPoints || width * height;

  const dataMatch = /DATA (.*)/i.exec(header);
  if (!dataMatch) {
    throw new Error("Missing data");
  }
  const data = dataMatch[1] as Data;

  return {
    header: {
      version,
      fields,
      size,
      type,
      count,
      height,
      width,
      points,
      data,
    },
    body,
  };
};

export function calculatePCDHeaderOffsets(this: ExtendedNamespace, header: PcdHeader) {
  const empty: PcdOffsets = {
    x: null,
    y: null,
    z: null,
    intensity: null,
  };

  return header.fields.reduce(({ offsets, rowSize }, field, i) => {
    offsets[field] = rowSize;
    rowSize += header.size[i] * header.count[i];

    return {
      offsets,
      rowSize,
    };
  }, {
    offsets: empty,
    rowSize: 0
  });
};

export function parsePcdWithIntensity(this: ExtendedNamespace, arrayBuffer: ArrayBuffer) {
  const { header, body } = this.parsePCDHeaderAndBody(arrayBuffer);

  const { offsets, rowSize } = this.calculatePCDHeaderOffsets(header);

  let positions: Float32Array | null = null;
  let intensities: Float32Array | null = null;

  if (offsets.x !== null && offsets.y !== null && offsets.z !== null) {
    positions = new Float32Array(header.points * 3);
  }
    
  if (offsets.intensity !== null) {
    intensities = new Float32Array(header.points);
  }

  const view = new DataView(body);

  this.genPCDRange(0, header.points).forEach((i: number) => {
    if (positions) {
      positions[i * 3 + 0] = view.getFloat32((offsets.x || 0) + i * rowSize, true);
      positions[i * 3 + 1] = view.getFloat32((offsets.y || 0) + i * rowSize, true);
      positions[i * 3 + 2] = view.getFloat32((offsets.z || 0) + i * rowSize, true);
    }

    if (intensities) {
      intensities[i] = view.getFloat32((offsets.intensity || 0) + i * rowSize, true);
    }
  });

  return {
    header,
    positions,
    intensities,
    colors: null,
  } as PcdInfo;
};

export async function loadPcdWithIntensity(this: ExtendedNamespace, path: string) {
  const response = await fetch(path);

  const arrayBuffer = await response.arrayBuffer();

  return this.parsePcdWithIntensity(arrayBuffer);
};

export function createPCDPointCloudMeshWithIntensity(this: ExtendedNamespace, pcdInfo: PcdInfo) {
  const pcs = new PointsCloudSystem("RibbonPointsCloudSystem", 1, this.getSceneManager().getContextScene());

  const positions = pcdInfo.positions as Float32Array;
  const intensities = pcdInfo.intensities as Float32Array;
  const pointsNum = intensities.length;

  const formatPointCloud = (cloudPoint: CloudPoint, i: number) => {
    // switch y and z
    cloudPoint.position = new Vector3(positions[i * 3 + 0], positions[i * 3 + 2], positions[i * 3 + 1]);
    cloudPoint.color = new Color4(
      RendererConfig.scene.pointCloudDefaultColor.r,
      RendererConfig.scene.pointCloudDefaultColor.g,
      RendererConfig.scene.pointCloudDefaultColor.b,
      1,
    );
  };

  pcs.addPoints(pointsNum, formatPointCloud);

  pcs.buildMeshAsync().then((mesh: Mesh) => {
    this.emitEvent(SetPCDInfoEvent, {
      pointsCloudSystem: pcs,
      pcdMesh: mesh,
      pcdInfo,
    });

    this.makeSceneDirty();
  });
};

export function loadPCDPointCloudWithPath(this: ExtendedNamespace, path: string) {
  this.emitEvent(LoadPCDEvent, { path });
};

export function alterOrbitCameraViewOnBoundingInfo(this: ExtendedNamespace, boundingInfo: BoundingInfo) {
  const contextScene = this.getSceneManager().getContextScene();
  const activeCamera = contextScene.activeCamera as ArcRotateCamera;

  const { center, maximum, minimum } = boundingInfo.boundingBox;

  const { x: xcenter, y: ycenter, z: zcenter } = center;
  const { x: xmax, y: ymax, z: zmax } = maximum;
  const { x: xmin, y: ymin, z: zmin } = minimum;

  const groundAltitude = ymin;
  const height = ymax - groundAltitude;
  const depth = zmax - zmin;

  activeCamera.target = new Vector3(xcenter, ycenter, zcenter);

  activeCamera.setPosition(new Vector3(
    xcenter,
    ymax + 80,
    zmin - 120,
  ));

  const initRadius = activeCamera.radius;
  activeCamera.lowerRadiusLimit = initRadius * 0.001;
  activeCamera.upperRadiusLimit = initRadius * 2;

  this.emitEvent(AlterGroundAltitudeEvent, RendererConfig.scene.groundDefaultAltitude);
  this.makeSceneDirty();
};