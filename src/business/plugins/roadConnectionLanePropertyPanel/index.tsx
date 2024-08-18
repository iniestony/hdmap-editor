import ReactDOM from 'react-dom/client';
import { UIPlugin } from '../../../core/plugins/raw/ui';
import { PluginOptions } from '../../../core/types/plugins/raw';
import withRenderer from '../../../core/hoc/withRenderer';
import RoadConnectionLanePropertyPanel from './components';

const RenderedLanePropertyPanel = withRenderer(RoadConnectionLanePropertyPanel);

export default class RoadConnectionLanePropertyPanelPlugin extends UIPlugin {
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