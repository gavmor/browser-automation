import { CreateCompletionResponseUsage } from 'openai';
import { attachDebugger, detachDebugger } from '../helpers/chromeDebugger';
import {
  disableIncompatibleExtensions,
  reenableExtensions,
} from '../helpers/disableExtensions';
import { callDOMAction } from '../helpers/domActions';

import { determineNextAction } from '../helpers/determineNextAction';
import templatize from '../helpers/shrinkHTML/templatize';
import { getSimplifiedDom } from '../helpers/simplifyDom';
import { sleep, truthyFilter } from '../helpers/utils';
import { MyStateCreator } from './store';

export type Action =
  | {
    thought: string;
    name: "fail" | "finish"
  }
  | {
      thought: string;
      name: 'click';
      args: { elementId: number };
    }
  | {
      thought: string;
      name: 'setValue';
      args: { elementId: number; value: string }; // Ensure `value` is required here
    };

// ... rest of the file remains unchanged ...
export type TaskHistoryEntry = {
  prompt: string;
  response: string;
  action: Action;
  usage: CreateCompletionResponseUsage;
};

export type CurrentTaskSlice = {
  tabId: number;
  instructions: string | null;
  history: TaskHistoryEntry[];
  status: 'idle' | 'running' | 'success' | 'error' | 'interrupted';
  actionStatus:
    | 'idle'
    | 'attaching-debugger'
    | 'pulling-dom'
    | 'transforming-dom'
    | 'performing-query'
    | 'performing-action'
    | 'waiting';
  actions: {
    runTask: (onError: (error: string) => void) => Promise<void>;
    interrupt: () => void;
  };
};
export const createCurrentTaskSlice: MyStateCreator<CurrentTaskSlice> = (
  set,
  get
) => ({
  tabId: -1,
  instructions: null,
  history: [],
  status: 'idle',
  actionStatus: 'idle',
  actions: {
    runTask: async (onError) => {
      const wasStopped = () => get().currentTask.status !== 'running';
      const setActionStatus = (status: CurrentTaskSlice['actionStatus']) => {
        set((state) => {
          state.currentTask.actionStatus = status;
        });
      };

      const instructions = get().ui.instructions;

      if (!instructions || get().currentTask.status === 'running') return;

      set((state) => {
        state.currentTask.instructions = instructions;
        state.currentTask.history = [];
        state.currentTask.status = 'running';
        state.currentTask.actionStatus = 'attaching-debugger';
      });

      try {
        const activeTab = (
          await chrome.tabs.query({ active: true, currentWindow: true })
        )[0];

        if (!activeTab.id) throw new Error('No active tab found');
        const tabId = activeTab.id;
        set((state) => {
          state.currentTask.tabId = tabId;
        });

        await attachDebugger(tabId);
        await disableIncompatibleExtensions();

        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (wasStopped()) break;

          setActionStatus('pulling-dom');
          const pageDOM = await getSimplifiedDom();
          if (!pageDOM) {
            set((state) => {
              state.currentTask.status = 'error';
            });
            break;
          }
          const html = pageDOM.outerHTML;

          if (wasStopped()) break;
          setActionStatus('transforming-dom');
          const currentDom = templatize(html);

          const previousTasks = get().currentTask.history

          setActionStatus('performing-query');

          const {action, ...query} = await determineNextAction(
            instructions,
            previousTasks.filter(
              ({action}) => !(('error' in action) || ('fail' in action))
            ),
            currentDom,
            3,
            onError
          );

          if (!query) {
            set((state) => {
              state.currentTask.status = 'error';
            });
            break;
          }

          if (wasStopped()) break;

          setActionStatus('performing-action');

          set((state) => {
            state.currentTask.history.push({
              prompt: query.prompt,
              response: query.response,
              action,
              usage: {...query.usage, total_tokens: query.usage.completion_tokens + query.usage.prompt_tokens},
            });
          });
          if ('error' in action) {
            // onError(action.error);
            // break;
            console.log(action.error)
            continue
          }
          if (
            action === null ||
            action.name === 'finish' ||
            action.name === 'fail'
          ) {
            continue;
          }

          try {
            if (action.name === 'click') {
              await callDOMAction('click', action.args);
            } else if (action.name === 'setValue') {
              await callDOMAction(
                action?.name,
                action?.args
              );
            }
          } catch {
            continue
          }

          if (wasStopped()) break;

          // While testing let's automatically stop after 50 actions to avoid
          // infinite loops
          if (get().currentTask.history.length >= 50) {
            break;
          }

          setActionStatus('waiting');
          // sleep 2 seconds. This is pretty arbitrary; we should figure out a better way to determine when the page has settled.
          await sleep(2000);
        }
        set((state) => {
          state.currentTask.status = 'success';
        });
      } catch (e: any) {
        onError(e.message);
        set((state) => {
          state.currentTask.status = 'error';
        });
      } finally {
        await detachDebugger(get().currentTask.tabId);
        await reenableExtensions();
      }
    },
    interrupt: () => {
      set((state) => {
        state.currentTask.status = 'interrupted';
      });
    },
  },
});
