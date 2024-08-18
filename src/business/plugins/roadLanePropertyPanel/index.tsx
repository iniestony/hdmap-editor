import ReactDOM from 'react-dom/client';
import { UIPlugin } from '../../../core/plugins/raw/ui';
import { PluginOptions } from '../../../core/types/plugins/raw';
import withRenderer from '../../../core/hoc/withRenderer';
import RoadLanePropertyPanel from './components';

const RenderedLanePropertyPanel = withRenderer(RoadLanePropertyPanel);

export default class RoadLanePropertyPanelPlugin extends UIPlugin {
  constructor(options: PluginOptions) {
    super(options);
  }

  activate() {
    super.activate();

    this.renderUI();
  }

  renderUI() {
    ReactDOM.createRoot(document.getElementById(this.uiWrapperId) as HTMLElement).render(
      <RenderedLanePropertyPanel pScope={this} />
    );
  }
};