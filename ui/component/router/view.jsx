// @flow
import React, { useEffect } from 'react';
import { Route, Navigate, Routes } from 'react-router';
import { withDesktopRouter } from 'component/common/desktop-router';

import * as PAGES from 'constants/pages';
import { PAGE_TITLE } from 'constants/pageTitles';
import { LINKED_COMMENT_QUERY_PARAM } from 'constants/comment';
import { parseURI, isURIValid } from 'util/lbryURI';
import { WELCOME_VERSION } from 'config';
import { GetLinksData } from 'util/buildHomepage';
import { useIsLargeScreen } from 'effects/use-screensize';

import HomePage from 'page/home';
import BackupPage from 'page/backup';

// Chunk: "secondary"
import SignInPage from 'page/signIn';
import SignInWalletPasswordPage from 'page/signInWalletPassword';

import SignUpPage from 'page/signUp';
import SignInVerifyPage from 'page/signInVerify';

// Chunk: "wallet/secondary"
import BuyPage from 'page/buy';
import ReceivePage from 'page/receive';
import SendPage from 'page/send';
import WalletPage from 'page/wallet';

// Chunk: none
import NotificationsPage from 'page/notifications';
import CollectionPage from 'page/collection';
import ChannelNew from 'page/channelNew';
import ChannelsFollowingDiscoverPage from 'page/channelsFollowingDiscover';

import ChannelsFollowingPage from 'page/channelsFollowing';
import ChannelsPage from 'page/channels';
import CreatorDashboard from 'page/creatorDashboard';
import DiscoverPage from 'page/discover';
import FileListPublished from 'page/fileListPublished';
import HelpPage from 'page/help';
import LibraryPage from 'page/library';
import ListBlockedPage from 'page/listBlocked';
import ListsPage from 'page/lists';
import PlaylistsPage from 'page/playlists';
import OwnComments from 'page/ownComments';
import PasswordResetPage from 'page/passwordReset';
import PasswordSetPage from 'page/passwordSet';
import PublishPage from 'page/publish';
import ReportContentPage from 'page/reportContent';
import ReportPage from 'page/report';
import RepostNew from 'page/repost';
import SearchPage from 'page/search';

import SettingsCreatorPage from 'page/settingsCreator';
import SettingsNotificationsPage from 'page/settingsNotifications';

import SettingsPage from 'page/settings';
import ShowPage from 'page/show';
import TagsFollowingManagePage from 'page/tagsFollowingManage';

import TagsFollowingPage from 'page/tagsFollowing';
import TopPage from 'page/top';
import UpdatePasswordPage from 'page/passwordUpdate';
import Welcome from 'page/welcome';

// Tell the browser we are handling scroll restoration
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

type Props = {
  currentScroll: number,
  isAuthenticated: boolean,
  location: { pathname: string, search: string, hash: string },
  history: {
    action: string,
    entries: { title: string }[],
    goBack: () => void,
    goForward: () => void,
    index: number,
    length: number,
    location: { pathname: string },
    push: (string) => void,
    state: {},
    replaceState: ({}, string, string) => void,
    listen: (any) => () => void,
  },
  uri: string,
  title: string,
  welcomeVersion: number,
  hasNavigated: boolean,
  setHasNavigated: () => void,
  setReferrer: (?string) => void,
  hasUnclaimedRefereeReward: boolean,
  homepageData: any,
};

function AppRouter(props: Props) {
  const {
    currentScroll,
    location: { pathname, search, hash },
    isAuthenticated,
    history,
    uri,
    title,
    welcomeVersion,
    hasNavigated,
    setHasNavigated,
    hasUnclaimedRefereeReward,
    setReferrer,
    homepageData,
  } = props;
  const { entries, listen, action: historyAction } = history;
  const entryIndex = history.index;
  const urlParams = new URLSearchParams(search);
  const resetScroll = urlParams.get('reset_scroll');
  const hasLinkedCommentInUrl = urlParams.get(LINKED_COMMENT_QUERY_PARAM);
  const isLargeScreen = useIsLargeScreen();
  const dynamicRoutes = GetLinksData(homepageData, isLargeScreen).filter(
    (potentialRoute: any) => potentialRoute && potentialRoute.route
  );

  // For people arriving at settings page from deeplinks, know whether they can "go back"
  useEffect(() => {
    const unlisten = listen((location, action) => {
      if (action === 'PUSH') {
        if (!hasNavigated && setHasNavigated) setHasNavigated();
      }
    });
    return unlisten;
  }, [listen, hasNavigated, setHasNavigated]);

  useEffect(() => {
    if (!hasNavigated && hasUnclaimedRefereeReward && !isAuthenticated) {
      const valid = isURIValid(uri);
      if (valid) {
        const { path } = parseURI(uri);
        if (path !== 'undefined') setReferrer(path);
      }
    }
  }, [hasNavigated, uri, hasUnclaimedRefereeReward, setReferrer, isAuthenticated]);

  useEffect(() => {
    const getDefaultTitle = (pathname: string) => {
      const title = pathname.startsWith('/$/') ? PAGE_TITLE[pathname.substring(3)] : '';
      if (process.env.NODE_ENV !== 'production') {
        return uri || pathname || title;
      }
      return __(title) || 'LBRY';
    };

    if (uri) {
      const { channelName, streamName } = parseURI(uri);

      if (title) {
        document.title = title;
      } else if (streamName) {
        document.title = streamName;
      } else if (channelName) {
        document.title = channelName;
      } else {
        document.title = getDefaultTitle(pathname);
      }
    } else {
      document.title = getDefaultTitle(pathname);
    }

    // @if TARGET='app'
    entries[entryIndex].title = document.title;
    // @endif
  }, [pathname, entries, entryIndex, title, uri]);

  useEffect(() => {
    if (!hasLinkedCommentInUrl) {
      if (hash && historyAction === 'PUSH') {
        const id = hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          window.scrollTo(0, element.offsetTop);
        }
      } else {
        window.scrollTo(0, currentScroll);
      }
    }
  }, [currentScroll, pathname, search, hash, resetScroll, hasLinkedCommentInUrl, historyAction]);

  return <AppRoutes location={props.location} welcomeVersion={welcomeVersion} dynamicRoutes={dynamicRoutes} />;
}

export function AppRoutes({ location, welcomeVersion, dynamicRoutes = [] }: any) {
  const { pathname } = location;
  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (error) {
    // A malformed percent escape must not crash path normalization.
  }
  if (decodedPath !== pathname) {
    return <Navigate replace to={{ ...location, pathname: decodedPath }} state={location.state} />;
  }
  if (welcomeVersion < WELCOME_VERSION) return <Welcome />;

  return (
    <Routes>
      <Route
        path={`/$/${PAGES.DEPRECATED__CHANNELS_FOLLOWING_MANAGE}/*`}
        element={<Navigate replace to={`/$/${PAGES.CHANNELS_FOLLOWING_DISCOVER}`} />}
      />
      <Route
        path={`/$/${PAGES.DEPRECATED__CHANNELS_FOLLOWING}/*`}
        element={<Navigate replace to={`/$/${PAGES.CHANNELS_FOLLOWING}`} />}
      />
      <Route
        path={`/$/${PAGES.DEPRECATED__TAGS_FOLLOWING}/*`}
        element={<Navigate replace to={`/$/${PAGES.TAGS_FOLLOWING}`} />}
      />
      <Route
        path={`/$/${PAGES.DEPRECATED__TAGS_FOLLOWING_MANAGE}/*`}
        element={<Navigate replace to={`/$/${PAGES.TAGS_FOLLOWING_MANAGE}`} />}
      />
      <Route path={`/$/${PAGES.DEPRECATED__PUBLISH}/*`} element={<Navigate replace to={`/$/${PAGES.UPLOAD}`} />} />
      <Route path={`/$/${PAGES.DEPRECATED__PUBLISHED}/*`} element={<Navigate replace to={`/$/${PAGES.UPLOADS}`} />} />

      <Route path={`/`} element={<HomePage />} />
      <Route path={`/$/${PAGES.DISCOVER}`} element={<DiscoverPage location={location} />} />
      {/* $FlowFixMe */}
      {dynamicRoutes.map((dynamicRouteProps: RowDataItem) => (
        <Route
          key={dynamicRouteProps.route}
          path={`${dynamicRouteProps.route}/*`}
          element={
            <DiscoverPage key={dynamicRouteProps.route} location={location} dynamicRouteProps={dynamicRouteProps} />
          }
        />
      ))}

      {/* Odysee signin */}
      <Route path={`/$/${PAGES.AUTH_SIGNIN}`} element={<SignInPage />} />
      <Route path={`/$/${PAGES.AUTH_PASSWORD_RESET}`} element={<PasswordResetPage />} />
      <Route path={`/$/${PAGES.AUTH_PASSWORD_SET}`} element={<PasswordSetPage />} />
      <Route path={`/$/${PAGES.AUTH}`} element={<SignUpPage />} />
      <Route path={`/$/${PAGES.AUTH}/*`} element={<SignUpPage />} />
      <Route path={`/$/${PAGES.AUTH_VERIFY}`} element={<SignInVerifyPage />} />

      <Route path={`/$/${PAGES.WELCOME}`} element={<Welcome />} />

      <Route path={`/$/${PAGES.HELP}`} element={<HelpPage />} />
      {/* @if TARGET='app' */}
      <Route path={`/$/${PAGES.BACKUP}`} element={<BackupPage />} />
      {/* @endif */}
      <Route path={`/$/${PAGES.SEARCH}`} element={<SearchPage />} />
      <Route path={`/$/${PAGES.TOP}`} element={<TopPage />} />
      <Route path={`/$/${PAGES.SETTINGS}`} element={<SettingsPage />} />
      <Route path={`/$/${PAGES.REPORT_CONTENT}`} element={<ReportContentPage />} />
      <Route path={`/$/${PAGES.LIST}/:collectionId/*`} element={<CollectionPage />} />

      <Route path={`/$/${PAGES.TAGS_FOLLOWING}`} element={<TagsFollowingPage />} />
      <Route path={`/$/${PAGES.CHANNELS_FOLLOWING}`} element={<ChannelsFollowingPage />} />
      <Route path={`/$/${PAGES.SETTINGS_NOTIFICATIONS}/*`} element={<SettingsNotificationsPage />} />
      <Route path={`/$/${PAGES.SETTINGS_UPDATE_PWD}/*`} element={<UpdatePasswordPage />} />
      <Route path={`/$/${PAGES.CHANNELS_FOLLOWING_DISCOVER}`} element={<ChannelsFollowingDiscoverPage />} />
      <Route path={`/$/${PAGES.CHANNEL_NEW}/*`} element={<ChannelNew />} />
      <Route path={`/$/${PAGES.REPOST_NEW}/*`} element={<RepostNew />} />
      <Route path={`/$/${PAGES.UPLOADS}/*`} element={<FileListPublished />} />
      <Route path={`/$/${PAGES.CREATOR_DASHBOARD}/*`} element={<CreatorDashboard />} />
      <Route path={`/$/${PAGES.UPLOAD}/*`} element={<PublishPage />} />
      <Route path={`/$/${PAGES.REPORT}/*`} element={<ReportPage />} />
      <Route path={`/$/${PAGES.LIBRARY}/*`} element={<LibraryPage />} />
      <Route path={`/$/${PAGES.LISTS}/*`} element={<ListsPage />} />
      <Route path={`/$/${PAGES.PLAYLISTS}/*`} element={<PlaylistsPage />} />
      <Route path={`/$/${PAGES.TAGS_FOLLOWING_MANAGE}/*`} element={<TagsFollowingManagePage />} />
      <Route path={`/$/${PAGES.SETTINGS_BLOCKED_MUTED}/*`} element={<ListBlockedPage />} />
      <Route path={`/$/${PAGES.SETTINGS_CREATOR}/*`} element={<SettingsCreatorPage />} />
      <Route path={`/$/${PAGES.WALLET}`} element={<WalletPage />} />
      <Route path={`/$/${PAGES.CHANNELS}/*`} element={<ChannelsPage />} />
      <Route path={`/$/${PAGES.BUY}/*`} element={<BuyPage />} />
      <Route path={`/$/${PAGES.RECEIVE}/*`} element={<ReceivePage />} />
      <Route path={`/$/${PAGES.SEND}/*`} element={<SendPage />} />
      <Route path={`/$/${PAGES.NOTIFICATIONS}/*`} element={<NotificationsPage />} />
      <Route path={`/$/${PAGES.AUTH_WALLET_PASSWORD}/*`} element={<SignInWalletPasswordPage />} />
      <Route path={`/$/${PAGES.SETTINGS_OWN_COMMENTS}/*`} element={<OwnComments />} />

      {/* Named app routes rank ahead of LBRY content routes. */}
      <Route path="/:claimName" element={<ShowPage />} />
      <Route path="/:claimName/:streamName" element={<ShowPage />} />
    </Routes>
  );
}

export default withDesktopRouter(AppRouter);
