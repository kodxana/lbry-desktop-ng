// @flow
import * as ACTIONS from 'constants/action_types';
import * as SETTINGS from 'constants/settings';
import * as SHARED_PREFERENCES from 'constants/shared_preferences';
import { Lbryio } from 'lbryinc';
import Lbry from 'lbry';
import { doWalletEncrypt, doWalletDecrypt } from 'redux/actions/wallet';
import {
  selectSyncHash,
  selectGetSyncIsPending,
  selectSetSyncIsPending,
  selectSyncIsLocked,
} from 'redux/selectors/sync';
import { makeSelectClientSetting } from 'redux/selectors/settings';
import { getSavedPassword } from 'util/saved-passwords';
import { doAnalyticsTagSync, doHandleSyncComplete } from 'redux/actions/app';
import { selectUserVerifiedEmail } from 'redux/selectors/user';
import Comments from 'comments';
import { getSubsetFromKeysArray } from 'util/sync-settings';

type SyncCallback = (error?: unknown, hasNewData?: ?boolean) => void;
type SyncAttempt = {
  unlockFailed?: boolean,
  syncHash?: string,
  syncData?: string,
  changed?: boolean,
  hasSyncedWallet?: boolean,
};

let syncTimer: ReturnType<typeof setInterval> | null = null;
const SYNC_INTERVAL = 1000 * 60 * 5; // 5 minutes
const NO_WALLET_ERROR = 'no wallet found for this user';
const BAD_PASSWORD_ERROR_NAME = 'InvalidPasswordError';
const { CLIENT_SYNC_KEYS } = SHARED_PREFERENCES;
export function doSetDefaultAccount(success?: () => void, failure?: (unknown) => void): ThunkAction<void> {
  return (dispatch: Dispatch) => {
    dispatch({
      type: ACTIONS.SET_DEFAULT_ACCOUNT,
    });

    Lbry.account_list()
      .then((accountList) => {
        const { lbc_mainnet: accounts } = accountList;
        let defaultId;
        for (let i = 0; i < accounts.length; ++i) {
          if (accounts[i].satoshis > 0) {
            defaultId = accounts[i].id;
            break;
          }
        }

        // In a case where there's no balance on either account
        // assume the second (which is created after sync) as default
        if (!defaultId && accounts.length > 1) {
          defaultId = accounts[1].id;
        }

        // Set the default account
        if (defaultId) {
          Lbry.account_set({ account_id: defaultId, default: true })
            .then(() => {
              if (success) {
                success();
              }
            })
            .catch((err) => {
              if (failure) {
                failure(err);
              }
            });
        } else if (failure) {
          // no default account to set
          failure('Could not set a default account'); // fail
        }
      })
      .catch((err) => {
        if (failure) {
          failure(err);
        }
      });
  };
}

export function doSetSync(oldHash: string, newHash: string, data: string): ThunkAction<Promise<unknown>> {
  return (dispatch: Dispatch) => {
    dispatch({
      type: ACTIONS.SET_SYNC_STARTED,
    });

    return Lbryio.call('sync', 'set', { old_hash: oldHash, new_hash: newHash, data }, 'post')
      .then((response) => {
        if (!response.hash) {
          throw Error('No hash returned for sync/set.');
        }

        return dispatch({
          type: ACTIONS.SET_SYNC_COMPLETED,
          data: { syncHash: response.hash },
        });
      })
      .catch((error) => {
        dispatch({
          type: ACTIONS.SET_SYNC_FAILED,
          data: { error },
        });
      });
  };
}

export const doGetSyncDesktop =
  (cb?: SyncCallback, password?: string): ThunkAction<Promise<unknown>> =>
  (dispatch: Dispatch, getState: GetState) => {
    const state = getState();
    const syncEnabled = makeSelectClientSetting(SETTINGS.ENABLE_SYNC)(state);
    const getSyncPending = selectGetSyncIsPending(state);
    const setSyncPending = selectSetSyncIsPending(state);
    const syncLocked = selectSyncIsLocked(state);

    return getSavedPassword().then((savedPassword) => {
      const passwordArgument = password || password === '' ? password : savedPassword === null ? '' : savedPassword;

      if (syncEnabled && !getSyncPending && !setSyncPending && !syncLocked) {
        return dispatch(doGetSync(passwordArgument, cb));
      }
    });
  };

export function doSyncLoop(noInterval?: boolean): ThunkAction<void> {
  return (dispatch: Dispatch, getState: GetState) => {
    if (!noInterval && syncTimer) clearInterval(syncTimer);
    const state = getState();
    const hasVerifiedEmail = selectUserVerifiedEmail(state);
    const syncEnabled = makeSelectClientSetting(SETTINGS.ENABLE_SYNC)(state);
    const syncLocked = selectSyncIsLocked(state);
    if (hasVerifiedEmail && syncEnabled && !syncLocked) {
      dispatch(doGetSyncDesktop((error, hasNewData) => dispatch(doHandleSyncComplete(error, hasNewData))));
      dispatch(doAnalyticsTagSync());
      if (!noInterval) {
        syncTimer = setInterval(() => {
          const state = getState();
          const syncEnabled = makeSelectClientSetting(SETTINGS.ENABLE_SYNC)(state);
          if (syncEnabled) {
            dispatch(doGetSyncDesktop((error, hasNewData) => dispatch(doHandleSyncComplete(error, hasNewData))));
            dispatch(doAnalyticsTagSync());
          }
        }, SYNC_INTERVAL);
      }
    }
  };
}

export function doSyncUnsubscribe(): ThunkAction<void> {
  return () => {
    if (syncTimer) {
      clearInterval(syncTimer);
    }
  };
}

export function doGetSync(passedPassword?: ?string, callback?: SyncCallback): ThunkAction<void> {
  const password = passedPassword === null || passedPassword === undefined ? '' : passedPassword;

  function handleCallback(error?: unknown, hasNewData?: ?boolean): void {
    if (callback) {
      if (typeof callback !== 'function') {
        throw new Error('Second argument passed to "doGetSync" must be a function');
      }

      callback(error, hasNewData);
    }
  }

  return (dispatch: Dispatch, getState: GetState) => {
    const state = getState();
    const localHash = selectSyncHash(state);
    dispatch({
      type: ACTIONS.GET_SYNC_STARTED,
    });

    const data: SyncAttempt = {};

    Lbry.wallet_status()
      .then((status) => {
        if (status.is_locked) {
          return Lbry.wallet_unlock({ password });
        }

        // Wallet is already unlocked
        return true;
      })
      .then((isUnlocked) => {
        if (isUnlocked) {
          return Lbry.sync_hash();
        }
        data.unlockFailed = true;
        throw new Error();
      })
      .then((hash?: string) => Lbryio.call('sync', 'get', { hash }, 'post'))
      .then((response: { hash: string, data?: string, changed?: boolean, ... }) => {
        if (typeof response.hash !== 'string') throw new Error('No hash returned for sync/get.');
        const syncHash = response.hash;
        data.syncHash = syncHash;
        data.syncData = response.data;
        data.changed = response.changed || syncHash !== localHash;
        data.hasSyncedWallet = true;

        if (response.changed) {
          return Lbry.sync_apply({ password, data: response.data, blocking: true });
        }
      })
      .then((response) => {
        if (!response) {
          dispatch({ type: ACTIONS.GET_SYNC_COMPLETED, data });
          handleCallback(null, data.changed);
          return;
        }

        const { hash: walletHash, data: walletData } = response;
        const syncHash = data.syncHash;
        if (syncHash === undefined) throw new Error('No hash returned for sync/get.');

        if (walletHash !== syncHash) {
          // different local hash, need to synchronise
          dispatch(doSetSync(syncHash, walletHash, walletData));
        }

        dispatch({ type: ACTIONS.GET_SYNC_COMPLETED, data });
        handleCallback(null, data.changed);
      })
      .catch((syncAttemptError) => {
        const badPasswordError =
          syncAttemptError && syncAttemptError.data && syncAttemptError.data.name === BAD_PASSWORD_ERROR_NAME;

        if (data.unlockFailed) {
          dispatch({ type: ACTIONS.GET_SYNC_FAILED, data: { error: syncAttemptError } });

          if (badPasswordError) {
            dispatch({ type: ACTIONS.SYNC_APPLY_BAD_PASSWORD });
          }

          handleCallback(syncAttemptError);
        } else if (data.hasSyncedWallet) {
          const error = (syncAttemptError && syncAttemptError.message) || 'Error getting synced wallet';
          dispatch({
            type: ACTIONS.GET_SYNC_FAILED,
            data: {
              error,
            },
          });

          if (badPasswordError) {
            dispatch({ type: ACTIONS.SYNC_APPLY_BAD_PASSWORD });
          }

          handleCallback(error);
        } else {
          const noWalletError = syncAttemptError && syncAttemptError.message === NO_WALLET_ERROR;

          dispatch({
            type: ACTIONS.GET_SYNC_COMPLETED,
            data: {
              hasSyncedWallet: false,
              syncHash: null,
              // If there was some unknown error, bail
              fatalError: !noWalletError,
            },
          });

          // user doesn't have a synced wallet
          //   call sync_apply to get data to sync
          //   first time sync. use any string for old hash
          if (noWalletError) {
            Lbry.sync_apply({ password })
              .then(({ hash: walletHash, data: syncApplyData }) => {
                dispatch(doSetSync('', walletHash, syncApplyData));
                handleCallback();
              })
              .catch((syncApplyError) => {
                handleCallback(syncApplyError);
              });
          }
        }
      });
  };
}

export function doSyncApply(syncHash: string, syncData: string, password: string): ThunkAction<void> {
  return (dispatch: Dispatch) => {
    dispatch({
      type: ACTIONS.SYNC_APPLY_STARTED,
    });

    Lbry.sync_apply({ password, data: syncData })
      .then(({ hash: walletHash, data: walletData }) => {
        dispatch({
          type: ACTIONS.SYNC_APPLY_COMPLETED,
        });

        if (walletHash !== syncHash) {
          // different local hash, need to synchronise
          dispatch(doSetSync(syncHash, walletHash, walletData));
        }
      })
      .catch(() => {
        dispatch({
          type: ACTIONS.SYNC_APPLY_FAILED,
          data: {
            error: 'Invalid password specified. Please enter the password for your previously synchronised wallet.',
          },
        });
      });
  };
}

export function doCheckSync(): ThunkAction<void> {
  return (dispatch: Dispatch) => {
    dispatch({
      type: ACTIONS.GET_SYNC_STARTED,
    });

    Lbry.sync_hash().then((hash) => {
      Lbryio.call('sync', 'get', { hash }, 'post')
        .then((response) => {
          const data = {
            hasSyncedWallet: true,
            syncHash: response.hash,
            syncData: response.data,
            hashChanged: response.changed,
          };
          dispatch({ type: ACTIONS.GET_SYNC_COMPLETED, data });
        })
        .catch(() => {
          // user doesn't have a synced wallet
          dispatch({
            type: ACTIONS.GET_SYNC_COMPLETED,
            data: { hasSyncedWallet: false, syncHash: null },
          });
        });
    });
  };
}

export function doResetSync(): ThunkAction<Promise<void>> {
  return (dispatch: Dispatch): Promise<void> =>
    new Promise<void>((resolve) => {
      dispatch({ type: ACTIONS.SYNC_RESET });
      resolve();
    });
}

export function doSyncEncryptAndDecrypt(
  oldPassword: string,
  newPassword: string,
  encrypt: boolean
): ThunkAction<Promise<unknown>> {
  return (dispatch: Dispatch) => {
    let oldHash: string | void;
    return Lbry.sync_hash()
      .then((hash) => Lbryio.call('sync', 'get', { hash }, 'post'))
      .then((syncGetResponse) => {
        if (typeof syncGetResponse.hash !== 'string') throw new Error('No hash returned for sync/get.');
        oldHash = syncGetResponse.hash;

        return Lbry.sync_apply({ password: oldPassword, data: syncGetResponse.data });
      })
      .then(async () => {
        const succeeded = await dispatch(encrypt ? doWalletEncrypt(newPassword) : doWalletDecrypt());
        if (!succeeded) throw new Error('Wallet encryption state could not be changed.');
      })
      .then(() => Lbry.sync_apply({ password: newPassword }))
      .then((syncApplyResponse) => {
        if (oldHash === undefined) throw new Error('No hash returned for sync/get.');
        if (syncApplyResponse.hash !== oldHash) {
          return dispatch(doSetSync(oldHash, syncApplyResponse.hash, syncApplyResponse.data));
        }
      })
      .catch((error) => console.error(error)); // eslint-disable-line
  };
}

export function doSetSyncLock(lock: boolean): { type: string, data: boolean } {
  return {
    type: ACTIONS.SET_SYNC_LOCK,
    data: lock,
  };
}

export function doSetPrefsReady(): { type: string, data: boolean } {
  return {
    type: ACTIONS.SET_PREFS_READY,
    data: true,
  };
}

type SharedData = {
  version: string,
  value: {
    subscriptions?: Array<string>,
    following?: Array<{ uri: string, notificationsDisabled: boolean }>,
    tags?: Array<string>,
    blocked?: Array<string>,
    settings?: any,
    app_welcome_version?: number,
    sharing_3P?: boolean,
    unpublishedCollections?: CollectionGroup,
    editedCollections?: CollectionGroup,
    builtinCollections?: CollectionGroup,
    savedCollections?: Array<string>,
  },
};

function extractUserState(rawObj: ?SharedData): SharedData['value'] {
  if (rawObj && rawObj.version === '0.1' && rawObj.value) {
    const {
      subscriptions,
      following,
      tags,
      blocked,
      settings,
      app_welcome_version,
      sharing_3P,
      unpublishedCollections,
      editedCollections,
      builtinCollections,
      savedCollections,
    } = rawObj.value;

    const result: SharedData['value'] = {};
    if (subscriptions) result.subscriptions = subscriptions;
    if (following) result.following = following;
    if (tags) result.tags = tags;
    if (blocked) result.blocked = blocked;
    if (settings) result.settings = settings;
    if (app_welcome_version) result.app_welcome_version = app_welcome_version;
    if (sharing_3P) result.sharing_3P = sharing_3P;
    if (unpublishedCollections) result.unpublishedCollections = unpublishedCollections;
    if (editedCollections) result.editedCollections = editedCollections;
    if (builtinCollections) result.builtinCollections = builtinCollections;
    if (savedCollections) result.savedCollections = savedCollections;
    return result;
  }

  return {};
}

/* This action function should anything SYNC_STATE_POPULATE needs to trigger */
export function doPopulateSharedUserState(sharedSettings: ?SharedData): ThunkAction<void> {
  return (dispatch: Dispatch, getState: GetState) => {
    const state = getState();
    const {
      settings: { clientSettings: currentClientSettings },
    } = state;

    const {
      subscriptions,
      following,
      tags,
      blocked,
      settings,
      app_welcome_version,
      sharing_3P,
      unpublishedCollections,
      editedCollections,
      builtinCollections,
      savedCollections,
    } = extractUserState(sharedSettings);
    const selectedSettings = settings ? getSubsetFromKeysArray(settings, CLIENT_SYNC_KEYS) : {};
    const mergedClientSettings = { ...currentClientSettings, ...selectedSettings };
    // possibly move to doGetAndPopulate... in success callback
    Comments.setServerUrl(
      mergedClientSettings[SETTINGS.CUSTOM_COMMENTS_SERVER_ENABLED]
        ? mergedClientSettings[SETTINGS.CUSTOM_COMMENTS_SERVER_URL]
        : undefined
    );

    dispatch({
      type: ACTIONS.SYNC_STATE_POPULATE,
      data: {
        subscriptions,
        following,
        tags,
        blocked,
        walletPrefSettings: settings,
        mergedClientSettings,
        welcomeVersion: app_welcome_version,
        allowAnalytics: sharing_3P,
        unpublishedCollections,
        editedCollections,
        builtinCollections,
        savedCollections,
      },
    });
  };
}

type Preference<T> = { type: string, version: string, value: T };

export function doPreferenceSet<T>(
  key: string,
  value: T,
  version: string,
  success?: (Preference<T>) => void,
  fail?: () => void
): ThunkAction<void> {
  return (dispatch: Dispatch) => {
    const preference = {
      type: typeof value,
      version,
      value,
    };

    const options = {
      key,
      value: JSON.stringify(preference),
    };

    Lbry.preference_set(options)
      .then(() => {
        if (success) {
          success(preference);
        }
      })
      .catch((err) => {
        dispatch({
          type: ACTIONS.SYNC_FATAL_ERROR,
          error: err,
        });

        if (fail) {
          fail();
        }
      });
  };
}

export function doPreferenceGet<T>(
  key: string,
  success: (?T) => unknown,
  fail?: (unknown) => void
): ThunkAction<Promise<unknown>> {
  return (dispatch: Dispatch) => {
    const options = {
      key,
    };

    return Lbry.preference_get(options)
      .then((result) => {
        if (result) {
          const preference = result[key];
          return success(preference);
        }

        return success(null);
      })
      .catch((err) => {
        dispatch({
          type: ACTIONS.SYNC_FATAL_ERROR,
          error: err,
        });

        if (fail) {
          fail(err);
        }
      });
  };
}
