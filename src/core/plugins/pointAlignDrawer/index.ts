import {
  Vector3,
  Color3,
  Mesh,
  CloudPoint,
  PointerInfo,
  Color4,
  PickingInfo,
  Ray,
  StandardMaterial,
  ArcRotateCamera
} from "@babylonjs/core";
import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../../core/types/plugins/raw';
import { ExtendedNamespace } from '../../../core/types/plugins/raw';
import RendererConfig from '../../../core/renderer/config';
import { MouseInteractionMode } from '../mouseInteractor/type';
import {
  ReceivePointAlignCurrentLasPointEvent,
  EnterEditingPointAlignItemListEvent,
  CurrentPointAlignMoseMoveLASPointCloud2DEvent,
  StorePointAlignEvent,
  RemovePointAlignEvent,
  UpdatePointAlign2DEvent,
  InitPointAlignOctreeInfoEvent,
  UpdatePointAlignItemsAnd2DTipsEvent,
} from './constant';
import {
  PointAlignItem
} from './type';
import {
  LasPoint2Dand3D,
  LasPoint2D,
} from '../octreeLoader/type';
import { TransactionType } from '../../transactions';
import {
  AlterInteractionModeEvent
} from '../interactorManager/constant';
import {
  InteractionMode
} from '../interactorManager/type';

export default class PointAlignDrawerPlugin extends LogicalPlugin {
  private actionMeshIndex: number;
  private pointAlignCollection: PointAlignItem[];
  private mousewheelTimer?: number | object;
  private oldAlpha?: number;
  private oldBeta?: number;
  private oldRadius?: number;
  private currentPointAlignMoseMoveMesh?: Mesh;

  private debouncedUpdatePointAlignItemsAnd2DTips: Function;

  constructor(options: PluginOptions) {
    super(options);

    this.actionMeshIndex = 0;
    this.pointAlignCollection = [];

    const scope = this as unknown as (ExtendedNamespace & PointAlignDrawerPlugin);
    this.debouncedUpdatePointAlignItemsAnd2DTips = scope.makeDebounce(scope.updatePointAlignItemsAnd2DTips, 1500);
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

    scope.registerEvent(ReceivePointAlignCurrentLasPointEvent);
    scope.onEvent(ReceivePointAlignCurrentLasPointEvent, (params: { payload: Object | string | number | null }) => {
      const lasPoint2Dand3D = (params.payload as { lasPoint2Dand3D: LasPoint2Dand3D }).lasPoint2Dand3D;
      this.drawPointAlign(lasPoint2Dand3D.position, lasPoint2Dand3D.lasPoint2D);
    });


    scope.registerEvent(StorePointAlignEvent);
    scope.onEvent(StorePointAlignEvent, (params: { payload: Object | string | number | null }) => {
      const pointAlignItem = params.payload as { pointAlignItem: PointAlignItem; };
      this.pointAlignCollection.push(pointAlignItem.pointAlignItem);
      scope.enterEditPointAlignItemList(this.pointAlignCollection);
    })

    scope.registerEvent(RemovePointAlignEvent);
    scope.onEvent(RemovePointAlignEvent, (params: { payload: Object | string | number | null }) => {
      const pointAlignId = params.payload;

      let removedIndex: number | null = null;

      this.pointAlignCollection.forEach((item: PointAlignItem, idx: number) => {
        if (item.pointAlignId === pointAlignId) {
          item.pointAlignPointMesh.dispose();
          removedIndex = idx;
        }
      });

      if (removedIndex !== null) this.pointAlignCollection.splice(removedIndex, 1);
      scope.enterEditPointAlignItemList(this.pointAlignCollection);
    })

    scope.registerEvent(UpdatePointAlign2DEvent);
    scope.onEvent(UpdatePointAlign2DEvent, (params: { payload: Object | string | number | null }) => {
      scope.enterEditPointAlignItemList(this.pointAlignCollection);
    })


    scope.registerEvent(UpdatePointAlignItemsAnd2DTipsEvent);
    scope.onEvent(UpdatePointAlignItemsAnd2DTipsEvent, async (params: { payload: Object | string | number | null }) => {
      this.debouncedUpdatePointAlignItemsAnd2DTips();
    });

    scope.registerEvent(CurrentPointAlignMoseMoveLASPointCloud2DEvent);
    scope.onEvent(CurrentPointAlignMoseMoveLASPointCloud2DEvent, (params: { payload: Object | string | number | null }) => {
      const cloudPointPosition = (params.payload as { cloudPointPosition: Vector3 }).cloudPointPosition;

      if (!this.currentPointAlignMoseMoveMesh) return;

      if (!cloudPointPosition) return;

      this.currentPointAlignMoseMoveMesh.position = cloudPointPosition;

      scope.makeSceneDirty();
    });

    scope.onEvent(AlterInteractionModeEvent, (params: { payload: Object | string | number | null }) => {
      const interactionMode = params.payload as InteractionMode;
      if (!this.currentPointAlignMoseMoveMesh) return;
      if (interactionMode === InteractionMode.DrawPointAlign) {
        const standardMaterial = new StandardMaterial('mat', scope.getSceneManager().getContextScene());
        standardMaterial.alpha = 1;
        standardMaterial.diffuseColor = RendererConfig.align.mouse.move.pointMesh.color;
        this.currentPointAlignMoseMoveMesh.material = standardMaterial;
      } else {
        const standardMaterial = new StandardMaterial('mat', scope.getSceneManager().getContextScene());
        standardMaterial.alpha = 0;
        standardMaterial.diffuseColor = RendererConfig.align.mouse.move.pointMesh.color;
        this.currentPointAlignMoseMoveMesh.material = standardMaterial;
      }
    });

    scope.registerEvent(EnterEditingPointAlignItemListEvent);
    scope.registerEvent(InitPointAlignOctreeInfoEvent);
  }

  drawPointAlign(position: Vector3, lasPoint2D: LasPoint2D) {
    let mark = false;
    for (let i = 0; i < this.pointAlignCollection.length; i++) {
      const point = this.pointAlignCollection[i].pointAlignPoint;
      if (point.x === position.x && point.y === position.y && point.z === position.z) {
        mark = true;
        break;
      }
    }
    if (!mark) {
      this.createPointAlig(position, lasPoint2D);
    }
  }

  createPointAlig(
    point: Vector3,
    lasPoint2D: LasPoint2D,
  ) {

    const scope = this as unknown as ExtendedNamespace;
    const pointAlignId = `pointsAlign_Mesh_${this.actionMeshIndex}`;
    const mesh = scope.createMarker(point, RendererConfig.pointAlign.pointMesh.color, pointAlignId);
    const opt = {
      pointAlignId: pointAlignId,
      pointAlignPoint: point,
      pointAlignlasPoint2D: lasPoint2D,
      pointAlignPointMesh: mesh
    }

    mesh.metadata = {
      belongingPointAlignItem: opt
    };


    scope.emitEvent(StorePointAlignEvent, { pointAlignItem: opt });


    this.actionMeshIndex++;

    scope.makeSceneDirty();

  }

  updatePointAlignItemsAnd2DTips() {
    const scope = this as unknown as ExtendedNamespace;
    scope.emitEvent(UpdatePointAlign2DEvent);
  }
}