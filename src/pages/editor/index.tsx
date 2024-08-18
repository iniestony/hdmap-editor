import useCreateRenderer from "../../core/hooks/createRenderer";
import { Renderer } from '../../core/renderer';
import StatusManagerPlugin from '../../core/plugins/statusManager';
import LineDrawerPlugin from '../../core/plugins/lineDrawer';
import RoadDrawerPlugin from '../../core/plugins/roadDrawer';
import RoadEditorPlugin from '../../core/plugins/roadEditor';
import RoadAltitudeAdaptorPlugin from '../../core/plugins/roadAltitudeAdaptor';
import RoadLaneEditorPlugin from '../../core/plugins/roadLaneEditor';
import RoadLaneAltitudeAdaptorPlugin from '../../core/plugins/roadLaneAltitudeAdaptor';
import RoadConnectionDrawerPlugin from '../../core/plugins/roadConnectionDrawer';
import RoadConnectionEditorPlugin from '../../core/plugins/roadConnectionEditor';
import RoadConnectionAltitudeAdaptorPlugin from '../../core/plugins/roadConnectionAltitudeAdaptor';
import RoadConnectionLaneEditorPlugin from "@/core/plugins/roadConnectionLaneEditor";
import JunctionDrawerPlugin from '../../core/plugins/junctionDrawer';
import JunctionEditorPlugin from '../../core/plugins/junctionEditor';
import MouseInteractorPlugin from '../../core/plugins/mouseInteractor';
import InteractorManagerPlugin from '../../core/plugins/interactorManager';
import CameraManagerPlugin from "../../core/plugins/cameraManager";
import PCDLoaderPlugin from '../../core/plugins/pcdLoader';
import OctreePointCloudLoaderPlugin from '../../core/plugins/octreeLoader';
import PersistenceAdaptorPlugin from '../../core/plugins/persistenceAdaptor';
import CrossFrameRendererPlugin from '../../core/plugins/crossFrameRenderer';
import PointAlignDrawerPlugin from '../../core/plugins/pointAlignDrawer';
import SegmentAlignDrawerPlugin from '../../core/plugins/segmentAlignDrawer';
import SignalDrawerPlugin from '../../core/plugins/signalDrawer';
import SignalEditorPlugin from '../../core/plugins/signalEditor';
import ControlPanelPlugin from '../../business/plugins/controlPanel';
import PreProcessorPlugin from '../../business/plugins/preProcessor';
import RoadPropertyPanelPlugin from '../../business/plugins/roadPropertyPanel';
import RoadLanePropertyPanelPlugin from '../../business/plugins/roadLanePropertyPanel';
import RoadConnectionPropertyPanelPlugin from '../../business/plugins/roadConnectionPropertyPanel';
import RoadConnectionLanePropertyPanelPlugin from '../../business/plugins/roadConnectionLanePropertyPanel';
import JunctionPropertyPanelPlugin from '../../business/plugins/junctionPropertyPanel';
import SignalPropertyPanelPlugin from '../../business/plugins/signalPropertyPanel';
import PointAlignPropertyPanelPlugin from "@/business/plugins/pointAlignPropertyPanel";
import SegmentAlignPropertyPanelPlugin from "@/business/plugins/segmentAlignPropertyPanel/index";
import {
  ControlPanelConfig,
  RoadPropertyPanelConfig,
  RoadLanePropertyPanelConfig,
  RoadConnectionPropertyPanelConfig,
  RoadConnectionLanePropertyPanelConfig,
  JunctionPropertyPanelConfig,
  SignalPropertyPanelConfig,
  PointAlignPropertyPanelConfig,
  SegmentAlignPropertyPanelConfig,
} from '../../business/constant';
import "./index.scss";

function HDMap() {
  useCreateRenderer({
    canvas: 'hdmap_canvas',
    house: 'plugins_house'
  }, (renderer: Renderer) => {
    renderer.getPluginManager()
      .registerPlugin(new StatusManagerPlugin({
        name: 'status_manager',
      }))
      .registerPlugin(new LineDrawerPlugin({
        name: 'line_drawer',
      }))
      .registerPlugin(new RoadDrawerPlugin({
        name: 'road_drawer',
      }))
      .registerPlugin(new RoadEditorPlugin({
        name: 'road_editor',
      }))
      .registerPlugin(new RoadAltitudeAdaptorPlugin({
        name: 'road_altitude_adaptor',
      }))
      .registerPlugin(new RoadLaneEditorPlugin({
        name: 'road_lane_editor',
      }))
      .registerPlugin(new RoadLaneAltitudeAdaptorPlugin({
        name: 'road_lane_altitude_adaptor',
      }))
      .registerPlugin(new RoadConnectionDrawerPlugin({
        name: 'road_connection_drawer',
      }))
      .registerPlugin(new RoadConnectionEditorPlugin({
        name: 'road_connection_editor',
      }))
      .registerPlugin(new RoadConnectionAltitudeAdaptorPlugin({
        name: 'road_connection_altitude_adaptor',
      }))
      .registerPlugin(new RoadConnectionLaneEditorPlugin({
        name: 'road_connection_lane_editor',
      }))
      .registerPlugin(new JunctionDrawerPlugin({
        name: 'junction_drawer',
      }))
      .registerPlugin(new JunctionEditorPlugin({
        name: 'junction_editor',
      }))
      .registerPlugin(new MouseInteractorPlugin({
        name: 'mouse_interactor',
      }))
      .registerPlugin(new InteractorManagerPlugin({
        name: 'interactor_manager',
      }))
      .registerPlugin(new CameraManagerPlugin({
        name: 'camera_manager'
      }))
      .registerPlugin(new PCDLoaderPlugin({
        name: 'pcd_loader',
      }))
      .registerPlugin(new OctreePointCloudLoaderPlugin({
        name: 'octree_loader',
      }))
      .registerPlugin(new PersistenceAdaptorPlugin({
        name: 'persistence_adaptor',
      }))
      .registerPlugin(new CrossFrameRendererPlugin({
        name: 'cross_frame_renderer',
      }))
      .registerPlugin(new PointAlignDrawerPlugin({
        name: 'point_align_drawer',
      }))
      .registerPlugin(new SegmentAlignDrawerPlugin({
        name: 'segment_align_drawer',
      }))
      .registerPlugin(new SignalDrawerPlugin({
        name: 'signal_drawer',
      }))
      .registerPlugin(new SignalEditorPlugin({
        name: 'signal_editor',
      }))
      .registerPlugin(new ControlPanelPlugin(ControlPanelConfig))
      .registerPlugin(new PreProcessorPlugin({
        name: 'pre_processor',
      }))
      .registerPlugin(new RoadPropertyPanelPlugin(RoadPropertyPanelConfig))
      .registerPlugin(new RoadLanePropertyPanelPlugin(RoadLanePropertyPanelConfig))
      .registerPlugin(new RoadConnectionPropertyPanelPlugin(RoadConnectionPropertyPanelConfig))
      .registerPlugin(new RoadConnectionLanePropertyPanelPlugin(RoadConnectionLanePropertyPanelConfig))
      .registerPlugin(new JunctionPropertyPanelPlugin(JunctionPropertyPanelConfig))
      .registerPlugin(new SignalPropertyPanelPlugin(SignalPropertyPanelConfig))
      .registerPlugin(new PointAlignPropertyPanelPlugin(PointAlignPropertyPanelConfig))
      .registerPlugin(new SegmentAlignPropertyPanelPlugin(SegmentAlignPropertyPanelConfig))
      .activateAllPlugins();
  });

  return (
    <div className="hdmap-wrapper" id="hdmap-general-wrapper">
      <canvas id="hdmap_canvas" />
      <div id="plugins_house">
        <canvas id="road_altitude_canvas" width={960} height={240} />
        <canvas id="road_connection_altitude_canvas" width={960} height={240} />
        <canvas id="road_lane_altitude_canvas" width={960} height={240} />
        <canvas id="road_connection_lane_altitude_canvas" width={960} height={240} />
      </div>
    </div>
  );
}

export default HDMap;
