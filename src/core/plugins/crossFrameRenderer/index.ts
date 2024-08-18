import { LogicalPlugin } from '../raw/logical';
import { PluginOptions } from '../../types/plugins/raw';
import { ExtendedNamespace } from '../../types/plugins/raw';
import RendererConfig from '../../renderer/config';
import {
  TriggerLoadPCSCrossFrameTaskEvent,
  TriggerColorPCSCrossFrameTaskEvent,
  PCSCrossFrameTaskStartEvent,
  PCSCrossFrameTaskEndEvent,
} from './constant';

export default class CrossFrameRendererPlugin extends LogicalPlugin {
  crossFrameTaskExecCancellable: {
    loadPCS: number | undefined;
    colorPCS: number | undefined;
  } = {
    loadPCS: undefined,
    colorPCS: undefined,
  };

  constructor(options: PluginOptions) {
    super(options);
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

    scope.registerEvent(TriggerLoadPCSCrossFrameTaskEvent);
    scope.onEvent(TriggerLoadPCSCrossFrameTaskEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { tasks: Array<Function> };
      
      scope.invokeCrossFrameTasks('loadPCS', payload.tasks);
    });

    scope.registerEvent(TriggerColorPCSCrossFrameTaskEvent);
    scope.onEvent(TriggerColorPCSCrossFrameTaskEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as { tasks: Array<Function> };
      
      scope.invokeCrossFrameTasks('colorPCS', payload.tasks);
    });

    scope.registerEvent(PCSCrossFrameTaskStartEvent);
    scope.registerEvent(PCSCrossFrameTaskEndEvent);
  }

  invokeCrossFrameTasks(
    ns: 'loadPCS' | 'colorPCS',
    crossFrameTasks: Array<Function>,
  ) {
    const scope = this as unknown as ExtendedNamespace;
    
    const requestIdleCallback = window.requestIdleCallback;
    const cancelIdleCallback = window.cancelIdleCallback;

    scope.emitEvent(PCSCrossFrameTaskStartEvent);

    if (this.crossFrameTaskExecCancellable[ns] !== undefined) {
      cancelIdleCallback(this.crossFrameTaskExecCancellable[ns] as number);
      this.crossFrameTaskExecCancellable[ns]= undefined;
    }

    const gapWaitingTimeout = RendererConfig.frame.crossFrameTaskGapWaitingTimeout;
  
    const execFunction: IdleRequestCallback = (ddl: IdleDeadline) => {
      if (ddl.timeRemaining() > 0 || ddl.didTimeout) {
        const task = crossFrameTasks.shift();
        if (task) task();
      };

      if (this.crossFrameTaskExecCancellable[ns] !== undefined) {
        cancelIdleCallback(this.crossFrameTaskExecCancellable[ns] as number);
        this.crossFrameTaskExecCancellable[ns] = undefined;
      }

      if (crossFrameTasks.length > 0) {
        this.crossFrameTaskExecCancellable[ns] = requestIdleCallback(execFunction, { timeout: gapWaitingTimeout });
      } else {
        scope.emitEvent(PCSCrossFrameTaskEndEvent);
      }
    };
  
    this.crossFrameTaskExecCancellable[ns] = requestIdleCallback(execFunction, { timeout: gapWaitingTimeout });
  }
};