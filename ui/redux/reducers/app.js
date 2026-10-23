// @flow

import * as ACTIONS from 'constants/action_types';

const reducers = {};

export type SnackBar = {
  message: string,
  linkText: string,
  linkTarget: string,
  isError: boolean,
};
export type AppState = {
  isLoaded: boolean,
  modal: ?string,
  modalProps: mixed,
  platform: string,
  upgradeSkipped: boolean,
  daemonVersionMatched: ?boolean,
  daemonReady: boolean,
  hasSignature: boolean,
  badgeNumber: number,
  volume: number,
  autoUpdateDownloading: boolean,
  autoUpdateDeclined: boolean,
  autoUpdateFailed: boolean,
  modalsAllowed: boolean,
  downloadProgress: ?number,
  upgradeDownloading: ?boolean,
  upgradeDownloadComplete: ?boolean,
  checkUpgradeTimer: ?number,
  isUpgradeAvailable: ?boolean,
  isUpgradeSkipped: ?boolean,
  hasClickedComment: boolean,
  enhancedLayout: boolean,
  splashAnimationEnabled: boolean,
  searchOptionsExpanded: boolean,
  isPasswordSaved: boolean,
  welcomeVersion: number,
  allowAnalytics: boolean,
  hasNavigated: boolean,
  interestedInYoutubeSync: boolean,
  activeChannel: ?string,
  incognito: boolean,
  diskSpace: ?DiskSpace,
};

const defaultState: AppState = {
  isLoaded: false,
  modal: null,
  modalProps: {},
  platform: process.platform,
  daemonVersionMatched: null,
  daemonReady: false,
  hasSignature: false,
  badgeNumber: 0,
  volume: 1,
  // @if TARGET='app'
  upgradeSkipped: sessionStorage.getItem('upgradeSkipped') === 'true',
  // @endif
  muted: false,
  autoUpdateDownloading: false,
  autoUpdateDownloaded: false,
  autoUpdateDeclined: false,
  autoUpdateFailed: false,
  modalsAllowed: true,
  hasClickedComment: false,
  downloadProgress: undefined,
  upgradeInitialized: false,
  upgradeFailedInstallation: false,
  upgradeDownloading: undefined,
  upgradeDownloadComplete: undefined,
  checkUpgradeTimer: undefined,
  isUpgradeAvailable: undefined,
  isUpgradeSkipped: undefined,
  enhancedLayout: false,
  splashAnimationEnabled: true,
  searchOptionsExpanded: false,
  currentScroll: 0,
  scrollHistory: [0],
  isPasswordSaved: false,
  welcomeVersion: 0.0,
  allowAnalytics: false,
  hasNavigated: false,
  interestedInYoutubeSync: false,
  activeChannel: undefined,
  incognito: false,
  diskSpace: null,
};

// @@router comes from react-router
// This action is dispatched any time a user navigates forward or back
try {
  defaultState.volume = Number(sessionStorage.getItem('volume') || 1);
} catch (e) {}

reducers['@@router/LOCATION_CHANGE'] = (state, action) => {
  const { currentScroll } = state;
  const scrollHistory = (state.scrollHistory && state.scrollHistory.slice()) || [];
  const { action: name } = action.payload;
  let newCurrentScroll = currentScroll;
  if (name === 'PUSH') {
    scrollHistory.push(window.scrollY);
    newCurrentScroll = 0;
  } else if (name === 'POP') {
    newCurrentScroll = scrollHistory[scrollHistory.length - 1];
    scrollHistory.pop();
  }

  return {
    ...state,
    scrollHistory,
    currentScroll: newCurrentScroll,
  };
};

reducers[ACTIONS.DAEMON_READY] = (state) => ({ ...state, daemonReady: true });

reducers[ACTIONS.PASSWORD_SAVED] = (state, action) => ({ ...state, isPasswordSaved: action.data });

reducers[ACTIONS.DAEMON_VERSION_MATCH] = (state) => ({ ...state, daemonVersionMatched: true });

reducers[ACTIONS.DAEMON_VERSION_MISMATCH] = (state) => ({ ...state, daemonVersionMatched: false });

reducers[ACTIONS.UPGRADE_CANCELLED] = (state) => ({
  ...state,
  downloadProgress: null,
  upgradeDownloadComplete: false,
  modal: null,
});

reducers[ACTIONS.DESKTOP_UPDATE_STATE] = (state, { data }) => ({
  ...state,
  isUpgradeAvailable: data.available,
  remoteVersion: data.version,
  autoUpdateDownloading: data.state === 'downloading',
  autoUpdateDownloaded: data.state === 'downloaded',
  autoUpdateDeclined: data.declined,
  autoUpdateFailed: data.failed,
  upgradeInitialized: data.installing,
  upgradeFailedInstallation: data.installationFailed,
  downloadProgress: data.percent,
});

reducers[ACTIONS.AUTO_UPDATE_DOWNLOADING] = (state) => ({
  ...state,
  autoUpdateDownloading: true,
  autoUpdateDownloaded: false,
  autoUpdateFailed: false,
});

reducers[ACTIONS.AUTO_UPDATE_DOWNLOADED] = (state) => ({
  ...state,
  autoUpdateDownloading: false,
  autoUpdateDownloaded: true,
  autoUpdateFailed: false,
});

reducers[ACTIONS.AUTO_UPDATE_DECLINED] = (state) => ({ ...state, autoUpdateDeclined: true });

reducers[ACTIONS.AUTO_UPDATE_RESET] = (state) => ({
  ...state,
  autoUpdateFailed: false,
  autoUpdateDownloading: false,
  autoUpdateDownloaded: false,
});

reducers[ACTIONS.AUTO_UPDATE_FAILED] = (state) => ({
  ...state,
  autoUpdateDownloading: false,
  autoUpdateDownloaded: false,
  autoUpdateFailed: true,
});

reducers[ACTIONS.UPGRADE_DOWNLOAD_COMPLETED] = (state, action) => ({
  ...state,
  downloadPath: action.data.path,
  upgradeDownloading: false,
  upgradeDownloadCompleted: true,
});

reducers[ACTIONS.UPGRADE_DOWNLOAD_STARTED] = (state) => ({ ...state, upgradeDownloading: true });

reducers[ACTIONS.UPGRADE_INIT_INSTALL] = (state) => ({
  ...state,
  upgradeInitialized: true,
  upgradeFailedInstallation: false,
});

reducers[ACTIONS.UPGRADE_INSTALL_ERROR] = (state) => ({
  ...state,
  upgradeInitialized: false,
  upgradeFailedInstallation: true,
});

reducers[ACTIONS.CHANGE_MODALS_ALLOWED] = (state, action) => ({ ...state, modalsAllowed: action.data.modalsAllowed });

reducers[ACTIONS.SKIP_UPGRADE] = (state) => {
  sessionStorage.setItem('upgradeSkipped', 'true');

  return { ...state, isUpgradeSkipped: true };
};

reducers[ACTIONS.MEDIA_PLAY] = (state) => ({ ...state, modalsAllowed: false });

reducers[ACTIONS.MEDIA_PAUSE] = (state) => ({ ...state, modalsAllowed: true });

reducers[ACTIONS.SET_PLAYING_URI] = (state, action) => {
  if (action.data.uri === null) {
    return { ...state, modalsAllowed: true };
  }
  return state;
};

reducers[ACTIONS.UPDATE_VERSION] = (state, action) => ({ ...state, version: action.data.version });

reducers[ACTIONS.CHECK_UPGRADE_SUCCESS] = (state, action) => ({
  ...state,
  isUpgradeAvailable: action.data.upgradeAvailable,
  remoteVersion: action.data.remoteVersion,
});

reducers[ACTIONS.CHECK_UPGRADE_SUBSCRIBE] = (state, action) => ({
  ...state,
  checkUpgradeTimer: action.data.checkUpgradeTimer,
});

reducers[ACTIONS.UPGRADE_DOWNLOAD_PROGRESSED] = (state, action) => ({
  ...state,
  downloadProgress: action.data.percent,
});

reducers[ACTIONS.DOWNLOAD_NOTIFICATION_STATE] = (state, { data }) => ({ ...state, badgeNumber: data.badgeNumber });

reducers[ACTIONS.VOLUME_CHANGED] = (state, action) => ({ ...state, volume: action.data.volume });

reducers[ACTIONS.VOLUME_MUTED] = (state, action) => ({ ...state, muted: action.data.muted });

reducers[ACTIONS.HISTORY_NAVIGATE] = (state) => ({ ...state, modal: undefined, modalProps: {} });

reducers[ACTIONS.CLEAR_UPGRADE_TIMER] = (state) => ({ ...state, checkUpgradeTimer: undefined });

reducers[ACTIONS.ADD_COMMENT] = (state) => ({ ...state, hasClickedComment: true });

reducers[ACTIONS.SHOW_MODAL] = (state, action) => ({
  ...state,
  modal: action.data.id,
  modalProps: action.data.modalProps,
});

reducers[ACTIONS.SET_WELCOME_VERSION] = (state, action) => ({ ...state, welcomeVersion: action.data });

reducers[ACTIONS.SET_ALLOW_ANALYTICS] = (state, action) => ({ ...state, allowAnalytics: action.data });

reducers[ACTIONS.SET_HAS_NAVIGATED] = (state, action) => ({ ...state, hasNavigated: action.data });

reducers[ACTIONS.HIDE_MODAL] = (state) => ({ ...state, modal: null, modalProps: null });

reducers[ACTIONS.TOGGLE_SEARCH_EXPANDED] = (state) => ({
  ...state,
  searchOptionsExpanded: !state.searchOptionsExpanded,
});

reducers[ACTIONS.TOGGLE_YOUTUBE_SYNC_INTEREST] = (state, action) => {
  return {
    ...state,
    interestedInYoutubeSync: !state.interestedInYoutubeSync,
  };
};

reducers[ACTIONS.TOGGLE_SPLASH_ANIMATION] = (state, action) => {
  return {
    ...state,
    splashAnimationEnabled: !state.splashAnimationEnabled,
  };
};

reducers[ACTIONS.SET_ACTIVE_CHANNEL] = (state, action) => {
  return {
    ...state,
    activeChannel: action.data.claimId,
  };
};

reducers[ACTIONS.SET_INCOGNITO] = (state, action) => {
  return {
    ...state,
    incognito: action.data.enabled,
  };
};

reducers[ACTIONS.DISK_SPACE] = (state, action) => {
  return {
    ...state,
    diskSpace: action.data,
  };
};

reducers[ACTIONS.SYNC_STATE_POPULATE] = (state, action) => {
  const { allowAnalytics } = action.data;
  return {
    ...state,
    ...(allowAnalytics !== undefined ? { allowAnalytics } : {}),
  };
};

reducers[ACTIONS.PURCHASE_URI_FAILED] = (state, action) => {
  return {
    ...state,
    modal: null,
    modalProps: null,
  };
};

export default function reducer(state: AppState = defaultState, action: any) {
  const handler = reducers[action.type];
  if (handler) return handler(state, action);
  return state;
}
