import {
  Vector3,
  Color3,
  Mesh,
  CloudPoint,
  PointerInfo,
  Color4,
  PickingInfo,
  Ray,
  ArcRotateCamera,
  StandardMaterial
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../../core/types/plugins/raw';
import { ExtendedNamespace } from '../../../core/types/plugins/raw';
import RendererConfig from '../../../core/renderer/config';
import { MouseInteractionMode } from '../mouseInteractor/type';
import {
  LasPoint2Dand3D,
  LasPoint2D,
} from '../octreeLoader/type';
import {
  ReceiveSegmentAlignCurrentLasPointEvent,
  StoreSegmentAlignPointEvent,
  StoreSegmentAlignEvent,
  UpdateSegmentAlign2DEvent,
  RemoveSegmentAlignEvent,
  EnterEditingSegmentAlignItemListEvent,
  CurrentSegmentAlignMoseMoveLASPointCloud2DEvent,
  InitSegmentAlignOctreeInfoEvent,
  UpdateSegmentAlignItemsAnd2DTipsEvent,
} from './constant';
import {
  SegmentAlignPointItem,
  SegmentAlignItem,
  SegmentAlignPointType,
} from './type';
import {
  AlterInteractionModeEvent
} from '../interactorManager/constant';
import {
  InteractionMode
} from '../interactorManager/type';

export default class SegmentAlignDrawerPlugin extends LogicalPlugin {
  private mousewheelTimer?: number | object;

  private actionPointAlignMeshIndex: number;
  private actionSegmentAlignMeshIndex: number;

  private oldAlpha?: number;
  private oldBeta?: number;
  private oldRadius?: number;

  private currentSegmentAlignMoseMoveMesh?: Mesh;

  private segmentAlignPointCollection: SegmentAlignPointItem[];
  private segmentAlignPointTwo: SegmentAlignPointItem[];

  private segmentAlignItemCollection: SegmentAlignItem[];

  private segmentAlignId?: string | null;

  private debouncedUpdateSegmentAlignItemsAnd2DTips: Function;


  constructor(options: PluginOptions) {
    super(options);

    this.actionPointAlignMeshIndex = 0;
    this.actionSegmentAlignMeshIndex = 0;

    this.segmentAlignPointCollection = [];

    this.segmentAlignPointTwo = [];

    this.segmentAlignItemCollection = [];

    const scope = this as unknown as (ExtendedNamespace & SegmentAlignDrawerPlugin);
    this.debouncedUpdateSegmentAlignItemsAnd2DTips = scope.makeDebounce(scope.updateSegmentAlignItemsAnd2DTips, 1500);
  }

  activate() {
    super.activate();

    this.init();
  }

  init() {
    this.initEvent();
  }
  initEvent() {
    const scope = this as unknown as ExtendedNamespace;

    scope.registerEvent(ReceiveSegmentAlignCurrentLasPointEvent);
    scope.onEvent(ReceiveSegmentAlignCurrentLasPointEvent, (params: { payload: Object | string | number | null }) => {
      const lasPoint2Dand3D = (params.payload as { lasPoint2Dand3D: LasPoint2Dand3D }).lasPoint2Dand3D;
      this.drawSegmentAlignPoint(lasPoint2Dand3D.position, lasPoint2Dand3D.lasPoint2D);
    });

    scope.registerEvent(StoreSegmentAlignPointEvent);
    scope.onEvent(StoreSegmentAlignPointEvent, (params: { payload: Object | string | number | null }) => {
      const segmentAlignPointItem = (params.payload as { segmentAlignPointItem: SegmentAlignPointItem; }).segmentAlignPointItem;
      this.segmentAlignPointCollection.push(segmentAlignPointItem);
    });

    scope.registerEvent(StoreSegmentAlignEvent);
    scope.onEvent(StoreSegmentAlignEvent, (params: { payload: Object | string | number | null }) => {
      const segmentAlignItem = (params.payload as { segmentAlignItem: SegmentAlignItem; }).segmentAlignItem;
      this.segmentAlignItemCollection.push(segmentAlignItem);

      scope.enterEditSegmentAlignItemList(this.segmentAlignItemCollection);
    });

    scope.registerEvent(RemoveSegmentAlignEvent);
    scope.onEvent(RemoveSegmentAlignEvent, (params: { payload: Object | string | number | null }) => {
      const segmentAlignId = params.payload;

      let removedIndex: number | null = null;

      this.segmentAlignItemCollection.forEach((item: SegmentAlignItem, idx: number) => {
        if (item.segmentAlignId === segmentAlignId) {
          item.segmentAlignMesh.dispose();
          item.segmentAlignPoints.forEach((segmentAlignPointItem: SegmentAlignPointItem) => {
            segmentAlignPointItem.pointMesh.dispose();
          })
          removedIndex = idx;
        }
      });

      if (removedIndex !== null) this.segmentAlignItemCollection.splice(removedIndex, 1);
      scope.enterEditSegmentAlignItemList(this.segmentAlignItemCollection);
    });


    scope.registerEvent(UpdateSegmentAlign2DEvent);
    scope.onEvent(UpdateSegmentAlign2DEvent, (params: { payload: Object | string | number | null }) => {
      scope.enterEditSegmentAlignItemList(this.segmentAlignItemCollection);
    })

    scope.registerEvent(UpdateSegmentAlignItemsAnd2DTipsEvent)
    scope.onEvent(UpdateSegmentAlignItemsAnd2DTipsEvent, (params: { payload: Object | string | number | null }) => {
      this.debouncedUpdateSegmentAlignItemsAnd2DTips();
    })

    scope.registerEvent(CurrentSegmentAlignMoseMoveLASPointCloud2DEvent);
    scope.onEvent(CurrentSegmentAlignMoseMoveLASPointCloud2DEvent, (params: { payload: Object | string | number | null }) => {
      const cloudPointPosition = (params.payload as { cloudPointPosition: Vector3 }).cloudPointPosition;

      if (!this.currentSegmentAlignMoseMoveMesh) return;

      if (!cloudPointPosition) return;

      this.currentSegmentAlignMoseMoveMesh.position = cloudPointPosition;

      scope.makeSceneDirty();
    });

    scope.onEvent(AlterInteractionModeEvent, (params: { payload: Object | string | number | null }) => {
      const interactionMode = params.payload as InteractionMode;
      if (!this.currentSegmentAlignMoseMoveMesh) return;
      if (interactionMode === InteractionMode.DrawSegmentAlign) {
        const standardMaterial = new StandardMaterial('mat', scope.getSceneManager().getContextScene());
        standardMaterial.alpha = 1;
        standardMaterial.diffuseColor = RendererConfig.align.mouse.move.pointMesh.color;
        this.currentSegmentAlignMoseMoveMesh.material = standardMaterial;
      } else {
        const standardMaterial = new StandardMaterial('mat', scope.getSceneManager().getContextScene());
        standardMaterial.alpha = 0;
        standardMaterial.diffuseColor = RendererConfig.align.mouse.move.pointMesh.color;
        this.currentSegmentAlignMoseMoveMesh.material = standardMaterial;
      }
    });

    scope.registerEvent(EnterEditingSegmentAlignItemListEvent);
    scope.registerEvent(InitSegmentAlignOctreeInfoEvent);
  }

  drawSegmentAlignPoint(position: Vector3, lasPoint2D: LasPoint2D) {
    let mark = false;
    for (let i = 0; i < this.segmentAlignPointCollection.length; i++) {
      const point = this.segmentAlignPointCollection[i].position;
      if (point.x === position.x && point.y === position.y && point.z === position.z) {
        mark = true;
        break;
      }
    }
    if (!mark) {
      const segmentAlignPointItem = this.createSegmentAlignPoint(position, lasPoint2D);
      if (segmentAlignPointItem.pointType === SegmentAlignPointType.start) {
        this.createSegmentAlignStart(segmentAlignPointItem);
      } else if (segmentAlignPointItem.pointType === SegmentAlignPointType.end) {
        this.createSegmentAlignEnd(segmentAlignPointItem);
        this.segmentAlignPointTwo = [];
      }
    }
  }

  createSegmentAlignStart(segmentAlignPointItem: SegmentAlignPointItem) {
    const scope = this as unknown as ExtendedNamespace;
    const segmentAlignId = `segmentAlign_Mesh_${this.actionSegmentAlignMeshIndex}`;
    const opt = {
      segmentAlignId: segmentAlignId,
      segmentAlignPoints: [segmentAlignPointItem],
      lasPlaneDistance: 0,
      lasAltitudeDistance: 0,
      lasSpaceDistance: 0,
      segmentAlignMesh: {}
    } as SegmentAlignItem;

    scope.emitEvent(StoreSegmentAlignEvent, { segmentAlignItem: opt });
    this.segmentAlignId = segmentAlignId;
    this.actionSegmentAlignMeshIndex++;
    scope.makeSceneDirty();
    scope.enterEditSegmentAlignItemList(this.segmentAlignItemCollection);
    return opt;
  }

  createSegmentAlignEnd(segmentAlignPointItem: SegmentAlignPointItem) {
    const scope = this as unknown as ExtendedNamespace;
    const segmentAlignItemIndex = this.segmentAlignItemCollection.findIndex((segmentAlignItem: SegmentAlignItem) => segmentAlignItem.segmentAlignId === this.segmentAlignId);
    if (segmentAlignItemIndex === -1) return;

    const segmentAlignItem = this.segmentAlignItemCollection[segmentAlignItemIndex];
    const newSegmentAlignPoints = segmentAlignItem.segmentAlignPoints.concat([segmentAlignPointItem]);
    const points: Vector3[] = [];

    newSegmentAlignPoints.forEach((newSegmentAlignPointItem) => {
      points.push(newSegmentAlignPointItem.position);
    })
    const mesh = scope.createSolidLine({
      points: points,
      color: RendererConfig.segmentAlign.lineMesh.color,
      id: segmentAlignItem.segmentAlignId,
    });

    this.segmentAlignItemCollection[segmentAlignItemIndex] = {
      segmentAlignId: segmentAlignItem.segmentAlignId,
      segmentAlignPoints: newSegmentAlignPoints,
      lasPlaneDistance: this.planeDistance(points[0], points[1]),
      lasAltitudeDistance: this.altitudeDistance(points[0], points[1]),
      lasSpaceDistance: this.spaceDistance(points[0], points[1]),
      segmentAlignMesh: mesh
    }
    this.segmentAlignId = null;
    scope.enterEditSegmentAlignItemList(this.segmentAlignItemCollection);
    scope.makeSceneDirty();
  }

  planeDistance(starPostion: Vector3, endPostion: Vector3) {
    const dx = Math.abs(starPostion._x - endPostion._x);
    const dz = Math.abs(starPostion._z - endPostion._z);
    const dis = parseFloat(Math.sqrt(Math.pow(dx, 2) + Math.pow(dz, 2))?.toFixed(2));
    return dis;
  }

  altitudeDistance(starPostion: Vector3, endPostion: Vector3) {
    const dis = parseFloat((Math.abs(endPostion._y - starPostion._y)).toFixed(2));
    return dis;
  }

  spaceDistance(starPostion: Vector3, endPostion: Vector3) {
    const dis = Math.sqrt((Math.pow((endPostion._x - starPostion._x), 2) + Math.pow((endPostion._y - starPostion._y), 2) + Math.pow((endPostion._z - starPostion._z), 2)));
    return parseFloat(dis?.toFixed(2));
  }

  createSegmentAlignPoint(
    point: Vector3,
    lasPoint2D: LasPoint2D,
  ) {

    const scope = this as unknown as ExtendedNamespace;
    const segmentAlignPointId = `segmentAlignPoint_Mesh_${this.actionPointAlignMeshIndex}`;
    const mesh = scope.createMarker(point, RendererConfig.segmentAlign.pointMesh.color, segmentAlignPointId);
    let pointType = SegmentAlignPointType.start;
    if (this.segmentAlignPointTwo.length === 0) {
      pointType = SegmentAlignPointType.start;
    } else {
      pointType = SegmentAlignPointType.end;
    }
    const opt = {
      segmentAlignPointId: segmentAlignPointId,
      position2D: lasPoint2D,
      position: point,
      pointMesh: mesh,
      pointType: pointType
    } as SegmentAlignPointItem;

    mesh.metadata = {
      belongingPointAlignItem: opt
    };

    this.segmentAlignPointTwo.push(opt);

    scope.emitEvent(StoreSegmentAlignPointEvent, { segmentAlignPointItem: opt });

    this.actionPointAlignMeshIndex++;

    scope.makeSceneDirty();

    return opt as SegmentAlignPointItem;
  }


  updateSegmentAlignItemsAnd2DTips() {
    const scope = this as unknown as ExtendedNamespace;
    scope.emitEvent(UpdateSegmentAlign2DEvent);
  }
}
