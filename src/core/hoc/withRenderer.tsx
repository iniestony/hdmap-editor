import getRenderer, { Renderer } from '../../core/renderer';
import { LogicalPlugin } from '../plugins/raw/logical';

export type RenderedFuncCompProps = {
  contextRenderer: Renderer,
  pScope: LogicalPlugin,
};

export default function withRenderer(Raw: (props: RenderedFuncCompProps) => JSX.Element) {
  return function(props: { pScope: LogicalPlugin }): JSX.Element {
    return (
      <Raw {...props} {...({contextRenderer: getRenderer()})} />
    );
  };
};