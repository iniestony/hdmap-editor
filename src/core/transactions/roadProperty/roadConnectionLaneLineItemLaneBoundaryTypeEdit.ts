import {
  RoadItem,
  LaneItemKeyInfo,
  LaneItem,
  RoadCategory,
  LaneLineItem,
  LaneLineSide,
  LaneSide,
} from '../../plugins/statusManager/type';
import {
  StoreDirtyRoadEvent,
} from '../../plugins/statusManager/constant';
import {
  AtlasLaneBoundaryType,
  AtlasLane,
} from '../../plugins/atlasConverter/type';
import { ExtendedNamespace } from '../../types/plugins/raw';
import StandardTransaction from '../general/standard';
import {
  InvokeRoadConnectionLaneInnerAttributeEditEvent,
  InvokeRoadConnectionLaneOuterAttributeEditEvent
} from '../event';
import RendererConfig from '../../renderer/config';

export default class RoadConnectionLaneLineItemLaneBoundaryTypeEdit extends StandardTransaction {
  private scope: ExtendedNamespace;
  private roadId: string;
  private landId: string;
  private roadCategory: RoadCategory;
  private laneLineSide: LaneLineSide;

  private atlasLaneBoundaryType: AtlasLaneBoundaryType.Type;
  private oldatlasLaneBoundaryType?: AtlasLaneBoundaryType.Type;

  private atlasLaneBoundaryVirtual: boolean;
  private oldAtlasLaneBoundaryVirtual?: boolean;

  constructor(options: Object) {
    super(options);
    this.scope = (options as unknown as { scope: ExtendedNamespace }).scope;
    this.roadCategory = (options as unknown as { roadCategory: RoadCategory }).roadCategory;
    this.roadId = (options as unknown as { roadId: string }).roadId;
    this.landId = (options as unknown as { landId: string }).landId;
    this.laneLineSide = (options as unknown as { laneLineSide: LaneLineSide }).laneLineSide;

    this.atlasLaneBoundaryType = (options as unknown as { atlasLaneBoundaryType: AtlasLaneBoundaryType.Type }).atlasLaneBoundaryType;
    this.atlasLaneBoundaryVirtual = (options as unknown as { atlasLaneBoundaryVirtual: boolean }).atlasLaneBoundaryVirtual;
  }

  commit() {
    super.commit();
    this.resolveNecessaryInfo();
    this.reformatNewRoad();

    return { roadId: this.roadId };
  }

  onUndo() {
    super.onUndo();
    this.reformatOldRoad();
  }

  onRedo() {
    super.onRedo();
    this.resolveNecessaryInfo();
    this.reformatNewRoad();
  }

  resolveNecessaryInfo() {
    const laneItem = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(this.landId, this.roadId, this.roadCategory) as LaneItem;

    if (this.laneLineSide === LaneLineSide.Inner) {
      const laneLineItem = laneItem.laneLines.innerLaneLine;
      this.oldatlasLaneBoundaryType = laneLineItem.atlasLaneBoundaryType;
      this.oldAtlasLaneBoundaryVirtual = laneLineItem.atlasLaneBoundaryVirtual;
    } else if (this.laneLineSide === LaneLineSide.Outer) {
      const laneLineItem = laneItem.laneLines.outerLaneLine;
      this.oldatlasLaneBoundaryType = laneLineItem.atlasLaneBoundaryType;
      this.oldAtlasLaneBoundaryVirtual = laneLineItem.atlasLaneBoundaryVirtual;
    }
  }

  reformatNewRoad() {
    const roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;

    if (this.laneLineSide === LaneLineSide.Inner) {
      this.updateInnerLine('Redo');
      this.updateRoadLaneLine();

      this.scope.emitEvent(InvokeRoadConnectionLaneInnerAttributeEditEvent, {
        landId: this.landId,
      });
    } else if (this.laneLineSide === LaneLineSide.Outer) {
      this.updateOuterLine('Redo');
      this.updateRoadLaneLine();

      this.scope.emitEvent(InvokeRoadConnectionLaneOuterAttributeEditEvent, {
        landId: this.landId,
      });
    }

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });
  }

  reformatOldRoad() {
    const roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;

    if (this.laneLineSide === LaneLineSide.Inner) {
      this.updateInnerLine('Undo');
      this.updateRoadLaneLine();

      this.scope.emitEvent(InvokeRoadConnectionLaneInnerAttributeEditEvent, {
        landId: this.landId,
      });
    } else if (this.laneLineSide === LaneLineSide.Outer) {
      this.updateOuterLine('Undo');
      this.updateRoadLaneLine();

      this.scope.emitEvent(InvokeRoadConnectionLaneOuterAttributeEditEvent, {
        landId: this.landId,
      });
    }

    this.scope.emitEvent(StoreDirtyRoadEvent, {
      roadPID: roadItem.roadPID,
      roadId: roadItem.roadId,
      roadCategory: roadItem.category,
    });
  }

  updateInnerLine(type: string) {
    const laneItem = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(this.landId, this.roadId, this.roadCategory) as LaneItem;
    const roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;

    const laneLineItem = laneItem.laneLines.innerLaneLine;

    if (type === 'Redo') {
      laneLineItem.atlasLaneBoundaryType = this.atlasLaneBoundaryType;
      laneLineItem.atlasLaneBoundaryVirtual = this.atlasLaneBoundaryVirtual;
    } else if (type === 'Undo') {
      if (this.oldatlasLaneBoundaryType !== undefined && this.oldAtlasLaneBoundaryVirtual !== undefined) {
        laneLineItem.atlasLaneBoundaryType = this.oldatlasLaneBoundaryType;
        laneLineItem.atlasLaneBoundaryVirtual = this.oldAtlasLaneBoundaryVirtual;
      }
    }
  }

  updateOuterLine(type: string) {
    const laneItem = this.scope.resolveLaneByLaneRoadIdAndRoadCategory(this.landId, this.roadId, this.roadCategory) as LaneItem;
    const roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;

    const laneLineItem = laneItem.laneLines.outerLaneLine;

    if (type === 'Redo') {
      laneLineItem.atlasLaneBoundaryType = this.atlasLaneBoundaryType;
      laneLineItem.atlasLaneBoundaryVirtual = this.atlasLaneBoundaryVirtual;
    } else if (type === 'Undo') {
      if (this.oldatlasLaneBoundaryType !== undefined && this.oldAtlasLaneBoundaryVirtual !== undefined) {
        laneLineItem.atlasLaneBoundaryType = this.oldatlasLaneBoundaryType;
        laneLineItem.atlasLaneBoundaryVirtual = this.oldAtlasLaneBoundaryVirtual;
      }
    }
  }

  updateRoadLaneLine() {
    const roadItem = this.scope.resolveRoadByRoadIdAndRoadCategory(this.roadId, this.roadCategory) as RoadItem;
    const roadItemKeyInfo = this.scope.resolveRoadItemKeyInfo(roadItem);
    
    this.scope.inlineReformatRoadLeftAndRightLanes(roadItemKeyInfo, roadItem);
  }
}