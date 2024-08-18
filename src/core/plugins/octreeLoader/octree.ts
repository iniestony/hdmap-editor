import {
  ActionManager,
  AxesViewer,
  BoundingBox,
  BoundingSphere,
  CloudPoint,
  Color3,
  Color4,
  ExecuteCodeAction,
  Frustum,
  Matrix,
  Mesh,
  MeshBuilder,
  Plane,
  PointsCloudSystem,
  Scene,
  StandardMaterial,
  Vector3,
  Viewport,
} from "@babylonjs/core";
import { PriorityQueue } from "@js-sdsl/priority-queue";
import { PcdInfo } from '../pcdLoader/type';
import RendererConfig from '../../renderer/config';
import { ExtendedNamespace } from "../../types/plugins/raw";
import {
  PCSCrossFrameTaskStartEvent,
  PCSCrossFrameTaskEndEvent,
} from '../crossFrameRenderer/constant';

const MIN_VISIBLE_NODE_SIZE_PX = 40;
const MAX_NUM_POINTS_BUDGET = 4 * 1000 * 1000;
const MAX_VISIBLE_NODES = 50;

export class OctreeCloudNode {
  public readonly id: number;
  public readonly box: BoundingBox;
  public readonly numPoints: number;
  public scene: Scene;
  public readonly parent?: OctreeCloudNode;

  public boundingSphere: BoundingSphere;
  public sizePx: number = 0;
  public children: OctreeCloudNode[] = [];
  
  private cloudMesh?: Mesh;
  private cloudVisible: boolean = false;

  public pcdInfo?: PcdInfo;

  constructor(
    id: number,
    box: BoundingBox,
    numPoints: number,
    scene: Scene,
    parent?: OctreeCloudNode
  ) {
    this.id = id;
    this.box = box;
    this.numPoints = numPoints;
    this.scene = scene;
    this.parent = parent;

    this.boundingSphere = this.createBoundingSphere(scene, id, box);
  }

  createBoundingSphere(scene: Scene, id: number, box: BoundingBox) {
    // root id = 1
    // 1 1x 1xx 1xxx
    const space = Math.ceil(Math.max(Math.log10(id), 1));

    const boxMesh = MeshBuilder.CreateBox(
      `octree-node-${id}`,
      { size: box.maximum.x - box.minimum.x - space },
      scene
    );

    boxMesh.position = new Vector3(box.center.x, box.center.y, box.center.z);

    const boundingSphere = boxMesh.getBoundingInfo().boundingSphere;
    boxMesh.dispose();

    return boundingSphere;
  }

  setPointCloudMesh(mesh: Mesh, enableNode: boolean) {
    this.clearPointCloudMesh();

    this.cloudMesh = mesh;
    this.cloudMesh.setEnabled(enableNode);
  }

  clearPointCloudMesh() {
    if (this.cloudMesh) {
      this.cloudMesh.dispose();
    }

    this.cloudMesh = undefined;
  }

  isLoaded() {
    return !this.cloudMesh;
  }

  show() {
    this.cloudVisible = true;

    if (this.cloudMesh) {
      this.cloudMesh.setEnabled(true);
    }
  }

  hide() {
    this.cloudVisible = false;

    if (this.cloudMesh) {
      this.cloudMesh.setEnabled(false);
    }
  }

  screenSize(transform: Matrix, viewport: Viewport) {
    const pixelA = Vector3.Project(
      this.box.maximum,
      this.box.getWorldMatrix(),
      transform,
      viewport
    );
    const pixelB = Vector3.Project(
      this.box.minimum,
      this.box.getWorldMatrix(),
      transform,
      viewport
    );
    return pixelA.subtract(pixelB).length();
  }

  checkVisible(
    frustumPlanes: Plane[],
    transform: Matrix,
    viewport: Viewport,
    cameraPosition: Vector3,
    slope: number
  ) {
    // for debug, only show top most n levels.
    // const level = Math.floor(Math.log10(this.id));
    // return level === 4;

    // The root node is always visible.
    if (this.id === 1) {
      return true;
    }

    if (!this.box.isInFrustum(frustumPlanes)) {
      return false;
    }
    
    // check screen size of the box
    // skip top 2 levels
    if (this.id > 100) {
      const sizePx = this.getWeight(cameraPosition, viewport.height, slope);
      // const sizePx = this.screenSize(transform, viewport);
      this.sizePx = sizePx;
      // hide small box
      if (sizePx <= MIN_VISIBLE_NODE_SIZE_PX) {
        return false;
      }
    }

    return true;
  }

  getWeight(cameraPosition: Vector3, viewHeight: number, slope: number) {
    const distance = Vector3.Distance(cameraPosition, this.box.center);
    const radius = this.boundingSphere.radius;

    const projFactor = (0.5 * viewHeight) / (slope * distance);
    const screenPixelRadius = radius * projFactor;

    return Math.round(screenPixelRadius);
  }
}

export class OctreePointCloud {
  public rootBoundingBox: BoundingBox;
  public maxDepth: number;
  public candidateNodePointsMap: Map<number, number>;
  public scene: Scene;
  public pScope: ExtendedNamespace;

  private rootNode: OctreeCloudNode;
  private allNodes: Map<number, OctreeCloudNode> = new Map();
  private visibleNodes: OctreeCloudNode[] = [];
  private enableLAS: boolean = true;
  private isLoadingAndRenderingOctree: boolean = false;
  private crossFrameTaskExecCancellable: number | undefined = undefined;

  private loadingIds: Set<number> = new Set();
  private loadedIds: Set<number> = new Set();
  private needLoadIds: PriorityQueue<number> = new PriorityQueue(
    [],
    (x, y) => x - y
  );

  private loadFn?: Function;

  constructor(
    rootBoundingBox: BoundingBox,
    maxDepth: number,
    candidateNodePointsMap: Map<number, number>,
    scene: Scene,
    pScope: ExtendedNamespace,
  ) {
    this.rootBoundingBox = rootBoundingBox;
    this.maxDepth = maxDepth;
    this.candidateNodePointsMap = candidateNodePointsMap;
    this.scene = scene;
    this.pScope = pScope;
 
    this.rootNode = new OctreeCloudNode(1, this.rootBoundingBox, this.candidateNodePointsMap.get(1)!, scene);
    this.visibleNodes = [this.rootNode];
    this.allNodes.set(this.rootNode.id, this.rootNode);

    // BFS
    const queue: OctreeCloudNode[] = [];
    queue.push(this.rootNode);

    while (queue.length > 0) {
      if (this.candidateNodePointsMap.size == 0) {
        break;
      }

      const parentNode = queue.shift()!;
      const children: OctreeCloudNode[] = [];

      const p_min = parentNode.box.minimum;
      const p_max = parentNode.box.maximum;
      
      // from root node, y and z is already switched
      const childBlockSize = new Vector3(
        (p_max.x - p_min.x) / 2,
        (p_max.y - p_min.y) / 2,
        (p_max.z - p_min.z) / 2
      );

      // generate all nodes hierarchy before start loading
      // x = 0 or 1
      for (let x = 0; x < 2; x++) {
        // y = 0 or 1
        for (let y = 0; y < 2; y++) {
          // z = 0 or 1
          for (let z = 0; z < 2; z++) {
            const localMin = p_min.add(childBlockSize.multiplyByFloats(x, y, z));
            const localMax = p_min.add(childBlockSize.multiplyByFloats(x + 1, y + 1, z + 1));

            const childBox: BoundingBox = new BoundingBox(localMin, localMax);

            // switch back y and z, as binary
            const childId = parentNode.id * 10 + Number.parseInt(`${x}${z}${y}`, 2) + 1;

            if (this.candidateNodePointsMap.has(childId)) {
              const numPoints = this.candidateNodePointsMap.get(childId)!;

              const child = new OctreeCloudNode(
                childId,
                childBox,
                numPoints,
                scene,
                parentNode,
              );

              children.push(child);
              this.allNodes.set(child.id, child);

              if (Math.floor(Math.log10(childId)) < this.maxDepth) {
                queue.push(child);
              }
            }
          }
        }
      }

      // assign children
      parentNode.children = children;
    }
  }

  getAllAltitudeProjectionWithInPcdInfoOctreeNodes(
    keyPoints: Vector3[],
  ) {
    const allPcdInfoList: Array<PcdInfo> = [];

    [...this.allNodes.values()].forEach((node: OctreeCloudNode) => {
      if (!node.pcdInfo) return;

      const boundingBox = node.box;
      const minV = boundingBox.minimumWorld;
      const maxV = boundingBox.maximumWorld;

      const isWithIn = keyPoints.some((p: Vector3) => {
        return p.x >= minV.x && p.x <= maxV.x && p.z >= minV.z && p.z <= maxV.z;
      });

      if (isWithIn) {
        allPcdInfoList.push(node.pcdInfo);
      }
    });

    return allPcdInfoList;
  }

  setLoadPCDFunction(loadFn: Function) {
    this.loadFn = loadFn;
  }

  updateVisible(
    transform: Matrix,
    viewport: Viewport,
    cameraPosition: Vector3,
    fov: number
  ) {
    if (!this.enableLAS) return;

    const frustumPlanes = Frustum.GetPlanes(transform);
    const slope = Math.tan(fov / 2);

    const newVisibleCandidates: OctreeCloudNode[] = [];
    let numVisiblePoints = 0;

    // BFS
    const queue: OctreeCloudNode[] = [];
    queue.push(this.rootNode);

    while (queue.length > 0) {
      const node = queue.shift()!;

      const nodeVisible = node.checkVisible(
        frustumPlanes,
        transform,
        viewport,
        cameraPosition,
        slope,
      );

      // const budgetOk = numVisiblePoints + node.points < MAX_NUM_POINTS_BUDGET;
      // const notTooManyVisibleNodes = candidates.length < MAX_VISIBLE_NODES;
      // visible = visible && budgetOk && notTooManyVisibleNodes;

      if (nodeVisible) {
        newVisibleCandidates.push(node);
        numVisiblePoints += node.numPoints;
      }

      queue.push(...node.children);
    }

    // hide old
    for (const node of this.visibleNodes) {
      node.hide();
    }

    // load new
    newVisibleCandidates.forEach((node) => {
      if (!(this.loadedIds.has(node.id) || this.loadingIds.has(node.id))) {
        this.needLoadIds.push(node.id);
      }
    });

    this.loadAndRenderOctree();

    // assign & show new
    this.visibleNodes = [...newVisibleCandidates];

    for (const node of this.visibleNodes) {
      node.show();
    }
  }

  allHide() {
    const allNodes = this.allNodes.values();

    for (let node of allNodes) {
      node.hide();
    }

    this.enableLAS = false;
  }

  allShow() {
    const allNodes = this.allNodes.values();

    for (let node of allNodes) {
      node.show();
    }

    this.enableLAS = true;
  }

  reRenderOctree() {
    // rerender all visible nodes
    this.visibleNodes.forEach((node) => this.needLoadIds.push(node.id));

    this.loadedIds.clear();
    this.loadingIds.clear();

    for (const node of this.allNodes.values()) {
      node.clearPointCloudMesh();
    }

    this.loadAndRenderOctree();
  }

  loadAndRenderOctree() {
    if (this.isLoadingAndRenderingOctree) return;

    this.isLoadingAndRenderingOctree = true;

    this.pScope.emitEvent(PCSCrossFrameTaskStartEvent);

    const setTimeout = window.setTimeout;
    const clearTimeout = window.clearTimeout;

    if (this.crossFrameTaskExecCancellable !== undefined) {
      clearTimeout(this.crossFrameTaskExecCancellable as number);
      this.crossFrameTaskExecCancellable = undefined;
    }
  
    const execFunction: TimerHandler = () => {
      const loadingSize = this.loadingIds.size;

      if (loadingSize < RendererConfig.frame.crossFrameMaximumParallelTask) {
        const id = this.needLoadIds.pop();
        if (id) this.renderNodeMesh(id);
      }

      if (this.crossFrameTaskExecCancellable !== undefined) {
        clearTimeout(this.crossFrameTaskExecCancellable as number);
        this.crossFrameTaskExecCancellable = undefined;
      }

      if (this.needLoadIds.size() > 0) {
        this.crossFrameTaskExecCancellable = setTimeout(execFunction, 20);
      } else {
        this.pScope.emitEvent(PCSCrossFrameTaskEndEvent);
        this.isLoadingAndRenderingOctree = false;
      }
    };

    this.crossFrameTaskExecCancellable = setTimeout(execFunction, 20);
  }

  loadAndRenderOctreeRIC() {
    if (this.isLoadingAndRenderingOctree) return;

    this.isLoadingAndRenderingOctree = true;

    this.pScope.emitEvent(PCSCrossFrameTaskStartEvent);

    const requestIdleCallback = window.requestIdleCallback;
    const cancelIdleCallback = window.cancelIdleCallback;

    if (this.crossFrameTaskExecCancellable !== undefined) {
      cancelIdleCallback(this.crossFrameTaskExecCancellable as number);
      this.crossFrameTaskExecCancellable = undefined;
    }

    const gapWaitingTimeout = RendererConfig.frame.crossFrameTaskGapWaitingTimeout;
  
    const execFunction: IdleRequestCallback = (ddl: IdleDeadline) => {
      if (ddl.timeRemaining() > 0 || ddl.didTimeout) {
        const loadingSize = this.loadingIds.size;

        if (loadingSize < RendererConfig.frame.crossFrameMaximumParallelTask) {
          const id = this.needLoadIds.pop();
          if (id) this.renderNodeMesh(id);
        }
      };

      if (this.crossFrameTaskExecCancellable !== undefined) {
        cancelIdleCallback(this.crossFrameTaskExecCancellable as number);
        this.crossFrameTaskExecCancellable = undefined;
      }

      if (this.needLoadIds.size() > 0) {
        this.crossFrameTaskExecCancellable = requestIdleCallback(execFunction, { timeout: gapWaitingTimeout });
      } else {
        this.pScope.emitEvent(PCSCrossFrameTaskEndEvent);
        this.isLoadingAndRenderingOctree = false;
      }
    };

    this.crossFrameTaskExecCancellable = requestIdleCallback(execFunction, { timeout: gapWaitingTimeout });
  }

  async renderNodeMesh(id: number) {
    if (!this.loadFn) return;

    // prevent load multiple times
    if (this.loadedIds.has(id) || this.loadingIds.has(id)) {
      return;
    }

    this.pScope.makeSceneDirty();

    this.loadingIds.add(id);

    const nodeInfo = await this.loadFn(id);

    if (nodeInfo) {
      this.loadingIds.delete(id);
      this.loadedIds.add(id);

      const _node = this.allNodes.get(id);

      if (_node && nodeInfo) {
        _node.setPointCloudMesh(nodeInfo.mesh, this.enableLAS);
        _node.pcdInfo = nodeInfo.pcdInfo;
      }
    }
  }
}
