import { useEffect } from "react";
import { RendererOptions } from '../types/renderer';
import getRenderer from '../renderer';

function useCreateRenderer(options: RendererOptions, onCreated?: Function) {
  useEffect(() => {
    const renderer = getRenderer(options);
    onCreated && onCreated(renderer);
  }, []);
}

export default useCreateRenderer;