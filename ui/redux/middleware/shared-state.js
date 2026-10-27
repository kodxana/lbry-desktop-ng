// @flow
import isEqual from 'util/deep-equal';
import { doPreferenceSet } from 'redux/actions/sync';

const RUN_PREFERENCES_DELAY_MS = 2000;
const SHARED_PREFERENCE_VERSION = '0.1';
type SharedFilter = { source: string, property: string, transform?: (unknown) => unknown };
type Store = { getState: GetState, dispatch: Dispatch };
type Action = { type: string, ... } | ThunkAction;
type Middleware = (Store) => ((Action) => unknown) => (Action) => unknown;
let oldShared: { [string]: unknown } = {};
let timeout: ReturnType<typeof setTimeout> | void;
export const buildSharedStateMiddleware =
  (
    actions: Array<string>,
    sharedStateFilters: { [string]: SharedFilter },
    sharedStateCb?: (Store) => void
  ): Middleware =>
  ({ getState, dispatch }) =>
  (next) =>
  (action) => {
    // We don't care if sync is disabled here, we always want to backup preferences to the wallet
    if (typeof action === 'function' || !actions.includes(action.type)) {
      return next(action);
    }
    clearTimeout(timeout);
    const actionResult = next(action);
    // Call `getState` after calling `next` to ensure the state has updated in response to the action
    function runPreferences(): unknown {
      const nextState = getState();
      const syncEnabled =
        nextState.settings && nextState.settings.clientSettings && nextState.settings.clientSettings.enable_sync;
      const preferenceKey = syncEnabled ? 'shared' : 'local';
      const shared: { [string]: unknown } = {};

      Object.keys(sharedStateFilters).forEach((key) => {
        const filter = sharedStateFilters[key];
        const { source, property, transform } = filter;
        let value = nextState[source][property];
        if (transform) {
          value = transform(value);
        }

        shared[key] = value;
      });

      if (!isEqual(oldShared, shared)) {
        // only update if the preference changed from last call in the same session
        oldShared = shared;
        dispatch(doPreferenceSet(preferenceKey, shared, SHARED_PREFERENCE_VERSION));
      }

      if (sharedStateCb) {
        // Pass dispatch to the callback to consumers can dispatch actions in response to preference set
        sharedStateCb({ dispatch, getState });
      }
      clearTimeout(timeout);
      return actionResult;
    }
    timeout = setTimeout(runPreferences, RUN_PREFERENCES_DELAY_MS);
  };
