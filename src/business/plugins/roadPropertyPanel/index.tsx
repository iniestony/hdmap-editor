import ReactDOM from 'react-dom/client';
import { UIPlugin } from '../../../core/plugins/raw/ui';
import { PluginOptions } from '../../../core/types/plugins/raw';
import withRenderer from '../../../core/hoc/withRenderer';
import RoadPropertyPanel from './components';

const RenderedRoadPropertyPanel = withRenderer(RoadPropertyPanel);

export default class RoadPropertyPanelPlugin extends UIPlugin {
  constructor(options: PluginOptions) {
    super(options);
  }

  activate() {
    super.activate();
    
    this.renderUI();
  }

  renderUI() {
    ReactDOM.createRoot(document.getElementById(this.uiWrapperId) as HTMLElement).render(
      <RenderedRoadPropertyPanel pScope={this} />
    );
  }
};