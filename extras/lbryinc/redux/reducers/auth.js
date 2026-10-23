import * as ACTIONS from 'constants/action_types';

const reducers = {};
const defaultState = {
  authenticating: false,
};

reducers[ACTIONS.GENERATE_AUTH_TOKEN_FAILURE] = (state) => ({ ...state, authToken: null, authenticating: false });

reducers[ACTIONS.GENERATE_AUTH_TOKEN_STARTED] = (state) => ({ ...state, authenticating: true });

reducers[ACTIONS.GENERATE_AUTH_TOKEN_SUCCESS] = (state, action) => ({
  ...state,
  authToken: action.data.authToken,
  authenticating: false,
});

export function authReducer(state = defaultState, action) {
  const handler = reducers[action.type];
  if (handler) return handler(state, action);
  return state;
}
