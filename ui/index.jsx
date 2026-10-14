import 'core-js/stable';
import 'regenerator-runtime/runtime';
import ErrorBoundary from 'component/errorBoundary';
import App from 'component/app';
import SnackBar from 'component/snackBar';
import SdkStartup from 'component/sdkStartup';
import * as ACTIONS from 'constants/action_types';
import { changeZoomFactor } from 'util/zoomWindow';
import desktop from 'util/desktop';
import { getDesktopInfo } from 'util/desktop-info';
import { listenForDownloadNotifications } from 'util/download-notifications';
import { listenForFullscreenExit } from 'util/window-controls';
import { listenForUpdater } from 'util/updater-events';
import { requestUpdater } from 'util/updater-client';
import moment from 'moment';
import * as MODALS from 'constants/modal_types';
import React, { Fragment, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import * as SETTINGS from 'constants/settings';
import {
  doDaemonReady,
  doCheckUpgradeAvailable,
  doOpenModal,
  doHideModal,
  doToggle3PAnalytics,
} from 'redux/actions/app';
import { isURIValid } from 'util/lbryURI';
import { setSearchApi } from 'redux/actions/search';
import { doSetLanguage, doFetchLanguage, doUpdateIsNightAsync } from 'redux/actions/settings';
import { Lbryio, doBlackListedOutpointsSubscribe, doFilteredOutpointsSubscribe } from 'lbryinc';
import rewards from 'rewards';
import { store, persistor, history } from 'store';
import app from './app';
import doLogWarningConsoleMessage from './logWarningConsoleMessage';
import { ConnectedRouter, push } from 'connected-react-router';
import { formatLbryUrlForWeb, formatInAppUrl } from 'util/url';
import { PersistGate } from 'redux-persist/integration/react';
import analytics from 'analytics';
import { doToast } from 'redux/actions/notifications';
import { getAuthToken, setAuthToken, doAuthTokenRefresh } from 'util/saved-passwords';
import { makeSelectClientSetting } from 'redux/selectors/settings';
import { DEFAULT_LANGUAGE, LBRY_API_URL } from 'config';

// Import 3rd-party styles before ours for the current way we are code-splitting.
import 'scss/third-party.scss';

// Import our app styles
// If a style is not necessary for the initial page load, it should be removed from `all.scss`
// and loaded dynamically in the component that consumes it
import 'scss/all.scss';

const startTime = Date.now();
analytics.startupEvent();

if (LBRY_API_URL) {
  Lbryio.setLocalApi(LBRY_API_URL);
}

if (process.env.SEARCH_API_URL) {
  setSearchApi(process.env.SEARCH_API_URL);
}

doAuthTokenRefresh();

// We need to override Lbryio for getting/setting the authToken
// We interact with ipcRenderer to get the auth key from a users keyring
// We keep a local variable for authToken because `ipcRenderer.send` does not
// contain a response, so there is no way to know when it's been set
let authToken;
Lbryio.setOverride('setAuthToken', (authToken) => {
  setAuthToken(authToken);
  return authToken;
});

Lbryio.setOverride(
  'getAuthToken',
  () =>
    new Promise((resolve) => {
      const authTokenToReturn = authToken || getAuthToken();
      resolve(authTokenToReturn);
    })
);

rewards.setCallback('claimFirstRewardSuccess', () => {
  app.store.dispatch(doOpenModal(MODALS.FIRST_REWARD));
});

rewards.setCallback('claimRewardSuccess', (reward) => {
  if (reward && reward.type === rewards.TYPE_REWARD_CODE) {
    app.store.dispatch(doHideModal());
  }
});

desktop.onDiskSpace((result) => {
  if (result.error) {
    console.log(`disk space error: ${result.error}`);
  }
  app.store.dispatch({
    type: ACTIONS.DISK_SPACE,
    data: result.error ? null : result.diskSpace,
  });
});

desktop.onOpenUri((url) => {
  function handleError() {
    app.store.dispatch(
      doToast({
        message: __('Invalid LBRY URL requested'),
      })
    );
  }

  const path = url.slice('lbry://'.length);
  if (path.startsWith('?')) {
    const redirectUrl = formatInAppUrl(path);
    return app.store.dispatch(push(redirectUrl));
  }

  if (isURIValid(url)) {
    const formattedUrl = formatLbryUrlForWeb(url);
    analytics.openUrlEvent(formattedUrl);
    return app.store.dispatch(push(formattedUrl));
  }

  // If nothing redirected before here the url must be messed up
  handleError();
});

desktop.onLanguage((language) => {
  app.store.dispatch(doSetLanguage(language));
});

desktop.onMenu((uri) => {
  if (uri && uri.startsWith('/help')) {
    app.store.dispatch(push('/$/help'));
  }
});

desktop.onZoom((action) => {
  changeZoomFactor(action);
});

desktop.onDevtools(() => {
  doLogWarningConsoleMessage();
});

listenForFullscreenExit();

document.addEventListener('click', (event) => {
  let { target } = event;

  while (target && target !== document) {
    if (target.matches('a[href^="http"]') || target.matches('a[href^="mailto"]')) {
      event.preventDefault();
      desktop.openExternal(target.href);
      return;
    }
    target = target.parentNode;
  }
});

document.addEventListener('dragover', (event) => {
  event.preventDefault();
});
document.addEventListener('drop', (event) => {
  event.preventDefault();
});

function AppWrapper() {
  // Splash screen and sdk setup not needed on web
  const [readyToLaunch, setReadyToLaunch] = useState(false);
  const [persistDone, setPersistDone] = useState(false);

  useEffect(() => {
    if (persistDone) {
      const stopUpdates = listenForUpdater(store);
      const stopNotifications = listenForDownloadNotifications(store);
      const state = store.getState();
      const enabled = makeSelectClientSetting(SETTINGS.ENABLE_PRERELEASE_UPDATES)(state);
      let previous = enabled;
      const sendPreferences = () => {
        const allow = makeSelectClientSetting(SETTINGS.ENABLE_PRERELEASE_UPDATES)(store.getState());
        if (allow !== previous) {
          previous = allow;
          requestUpdater('prereleases', allow);
          store.dispatch(doCheckUpgradeAvailable());
        }
      };
      requestUpdater('prereleases', enabled);
      const unsubscribe = store.subscribe(sendPreferences);
      return () => {
        unsubscribe();
        stopUpdates();
        stopNotifications();
      };
    }
  }, [persistDone]);

  useEffect(() => {
    // @if TARGET='app'
    let disposed = false;
    getDesktopInfo('metadata')
      .then(({ locale }) => {
        if (!disposed) moment.locale(locale);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
    // @endif
  }, []);

  useEffect(() => {
    if (persistDone) {
      app.store.dispatch(doToggle3PAnalytics(null, true));
    }
  }, [persistDone]);

  useEffect(() => {
    if (readyToLaunch && persistDone) {
      if (DEFAULT_LANGUAGE) {
        app.store.dispatch(doFetchLanguage(DEFAULT_LANGUAGE));
      }
      app.store.dispatch(doUpdateIsNightAsync());
      app.store.dispatch(doDaemonReady());
      app.store.dispatch(doBlackListedOutpointsSubscribe());
      app.store.dispatch(doFilteredOutpointsSubscribe());

      const appReadyTime = Date.now();
      const timeToStart = appReadyTime - startTime;
      analytics.readyEvent(timeToStart);
    }
  }, [readyToLaunch, persistDone]);

  return (
    <Provider store={store}>
      <PersistGate
        persistor={persistor}
        onBeforeLift={() => setPersistDone(true)}
        loading={<div className="main--launching" />}
      >
        <Fragment>
          {readyToLaunch ? (
            <ConnectedRouter history={history}>
              <ErrorBoundary>
                <App />
                <SnackBar />
              </ErrorBoundary>
            </ConnectedRouter>
          ) : (
            <Fragment>
              <SdkStartup onReadyToLaunch={() => setReadyToLaunch(true)} />
              <SnackBar />
            </Fragment>
          )}
        </Fragment>
      </PersistGate>
    </Provider>
  );
}

ReactDOM.render(<AppWrapper />, document.getElementById('app'));
