import { RawPlugin } from './index';
import { PluginOptions, ExtendedNamespace } from '../../types/plugins/raw';
import * as NSRendererFunc from './namespaces/renderer';
import * as NSSceneFunc from './namespaces/scene';
import * as NSEventFunc from './namespaces/event';
import * as NSMouseFunc from './namespaces/mouse';
import * as NSTransactionFunc from './namespaces/transaction';
import * as NSMeshFunc from './namespaces/mesh';
import * as NSVectorFunc from './namespaces/vector';
import * as NSReformatFunc from './namespaces/reformat';
import * as NSAdjustCatmullFunc from './namespaces/adjustCatmull';
import * as NSLaneWidthEditFunc from './namespaces/laneWidthEdit';
import * as NSAddAndRemoveLaneFunc from './namespaces/addAndRemoveLane';
import * as NSCameraFunc from './namespaces/camera';
import * as NSAtlasFunc from './namespaces/atlas';
import * as NSPCDFunc from './namespaces/pcd';
import * as NSLASFunc from './namespaces/las';
import * as NSPointCloudFunc from './namespaces/pointcloud';
import * as NSCatmullEditFunc from './namespaces/catmullEdit';
import * as NSConnectionFunc from './namespaces/connection';
import * as NSJunctionFunc from './namespaces/junction';
import * as NSPersistFunc from './namespaces/persist';
import * as NSCatmullSerieFunc from './namespaces/catmullSerie';
import * as NSHermiteSerieFunc from './namespaces/hermiteSerie';
import * as NSRoadPropertyFunc from './namespaces/roadProperty';
import * as NSJunctionPropertyFunc from './namespaces/junctionProperty';
import * as NSUIFunc from './namespaces/ui';
import * as NSAltitudeFunc from './namespaces/altitude';
import * as NSSignalFunc from './namespaces/signal';

export class LogicalPlugin extends RawPlugin {
  name: string;

  constructor(options: PluginOptions) {
    super();

    this.name = options.name;
  }

  activate() {
    super.activate();

    this.activated = true;
  }
  
  deactivate() {
    super.deactivate();

    this.activated = false;
  }
};

Object.keys(NSRendererFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSRendererFunc as ExtendedNamespace)[n];
});
Object.keys(NSSceneFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSSceneFunc as ExtendedNamespace)[n];
});
Object.keys(NSEventFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSEventFunc as ExtendedNamespace)[n];
});
Object.keys(NSMouseFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSMouseFunc as ExtendedNamespace)[n];
});
Object.keys(NSTransactionFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSTransactionFunc as ExtendedNamespace)[n];
});
Object.keys(NSMeshFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSMeshFunc as ExtendedNamespace)[n];
});
Object.keys(NSVectorFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSVectorFunc as ExtendedNamespace)[n];
});
Object.keys(NSReformatFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSReformatFunc as ExtendedNamespace)[n];
});
Object.keys(NSAdjustCatmullFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSAdjustCatmullFunc as ExtendedNamespace)[n];
});
Object.keys(NSLaneWidthEditFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSLaneWidthEditFunc as ExtendedNamespace)[n];
});
Object.keys(NSAddAndRemoveLaneFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSAddAndRemoveLaneFunc as ExtendedNamespace)[n];
});
Object.keys(NSCameraFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSCameraFunc as ExtendedNamespace)[n];
});
Object.keys(NSAtlasFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSAtlasFunc as ExtendedNamespace)[n];
});
Object.keys(NSPCDFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSPCDFunc as ExtendedNamespace)[n];
});
Object.keys(NSLASFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSLASFunc as ExtendedNamespace)[n];
});
Object.keys(NSPointCloudFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSPointCloudFunc as ExtendedNamespace)[n];
});
Object.keys(NSCatmullEditFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSCatmullEditFunc as ExtendedNamespace)[n];
});
Object.keys(NSConnectionFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSConnectionFunc as ExtendedNamespace)[n];
});
Object.keys(NSJunctionFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSJunctionFunc as ExtendedNamespace)[n];
});
Object.keys(NSPersistFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSPersistFunc as ExtendedNamespace)[n];
});
Object.keys(NSCatmullSerieFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSCatmullSerieFunc as ExtendedNamespace)[n];
});
Object.keys(NSHermiteSerieFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSHermiteSerieFunc as ExtendedNamespace)[n];
});
Object.keys(NSRoadPropertyFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSRoadPropertyFunc as ExtendedNamespace)[n];
});
Object.keys(NSJunctionPropertyFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSJunctionPropertyFunc as ExtendedNamespace)[n];
});
Object.keys(NSUIFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSUIFunc as ExtendedNamespace)[n];
});
Object.keys(NSAltitudeFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSAltitudeFunc as ExtendedNamespace)[n];
});
Object.keys(NSSignalFunc).forEach(n => {
  (LogicalPlugin.prototype as unknown as ExtendedNamespace)[n] = (NSSignalFunc as ExtendedNamespace)[n];
});