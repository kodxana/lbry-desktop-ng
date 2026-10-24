// @flow
import * as ACTIONS from 'constants/action_types';
import * as ABANDON_STATES from 'constants/abandon_states';
// @if TARGET='app'
import desktop from 'util/desktop';
// @endif
import Lbry from 'lbry';
import { selectClaimForUri } from 'redux/selectors/claims';
import { doAbandonClaim } from 'redux/actions/claims';
import { batchActions } from 'util/batch-actions';

import { doHideModal } from 'redux/actions/app';
import { goBack } from 'redux-first-history';
import { doSetPlayingUri } from 'redux/actions/content';
import { selectPlayingUri } from 'redux/selectors/content';
import { doToast } from 'redux/actions/notifications';
import { selectBalance } from 'redux/selectors/wallet';
import {
  makeSelectFileInfoForUri,
  selectDownloadingByOutpoint,
  makeSelectStreamingUrlForUri,
} from 'redux/selectors/file_info';

type Dispatch = (action: any) => any;
type GetState = () => { claims: any, file: FileState, content: any };
export function doOpenFileInFolder(path: string): ThunkAction<void> {
  return () => {
    desktop.revealFile(path);
  };
}

export function doOpenFileInShell(path: string): ThunkAction<Promise<void>> {
  return async (dispatch: Dispatch) => {
    const error = await desktop.openFile(path);
    if (error) {
      dispatch(doOpenFileInFolder(path));
    }
  };
}

export function doDeleteFile(
  outpoint: string,
  deleteFromComputer?: boolean,
  abandonClaim?: boolean,
  cb: any,
  claim: Claim
): ThunkAction<void> {
  return (dispatch: Dispatch) => {
    if (abandonClaim) {
      dispatch(doAbandonClaim(claim, cb));
    }

    // @if TARGET='app'
    Lbry.file_delete({
      outpoint,
      delete_from_download_dir: deleteFromComputer,
    });

    dispatch({
      type: ACTIONS.FILE_DELETE,
      data: {
        outpoint,
      },
    });
    // @endif
  };
}

export function doDeleteFileAndMaybeGoBack(
  uri: string,
  deleteFromComputer?: boolean,
  abandonClaim?: boolean,
  doGoBack: ?() => void,
  claim: Claim
): ThunkAction<void> {
  return (dispatch: Dispatch, getState: GetState) => {
    const state = getState();
    const playingUri = selectPlayingUri(state);
    const { outpoint } = makeSelectFileInfoForUri(uri)(state) || '';
    const { nout, txid } = selectClaimForUri(state, uri) || claim;
    const claimOutpoint = `${txid}:${nout}`;
    const actions = [];

    if (!abandonClaim) {
      actions.push(doHideModal());
    }

    actions.push(
      doDeleteFile(
        outpoint || claimOutpoint,
        deleteFromComputer,
        abandonClaim,
        (abandonState) => {
          if (abandonState === ABANDON_STATES.DONE) {
            if (abandonClaim) {
              if (doGoBack) {
                dispatch(goBack());
              }
              dispatch(doHideModal());
            }
          }
        },
        claim
      )
    );

    if (playingUri && playingUri.uri === uri) {
      actions.push(doSetPlayingUri({ uri: null }));
    }
    // it would be nice to stay on the claim if you just want to delete it
    // we need to alter autoplay to not start downloading again after you delete it

    dispatch(batchActions(...actions));
  };
}

export function doFileGet(uri: string, saveFile: boolean = true, onSuccess?: (GetResponse) => any): ThunkAction<void> {
  return (dispatch: Dispatch, getState: () => any) => {
    const state = getState();
    const claim = selectClaimForUri(state, uri);
    if (!claim) {
      dispatch(doToast({ message: __('This claim is not available yet. Please try again.'), isError: true }));
      return;
    }
    const { nout, txid } = claim;
    const outpoint = `${txid}:${nout}`;

    dispatch({
      type: ACTIONS.FETCH_FILE_INFO_STARTED,
      data: {
        outpoint,
      },
    });

    // set save_file argument to True to save the file (old behaviour)
    Lbry.get({ uri, save_file: saveFile })
      .then((streamInfo: GetResponse | string | number | boolean | null | void) => {
        if (streamInfo == null || typeof streamInfo !== 'object' || streamInfo.error === 'Timeout') {
          dispatch({
            type: ACTIONS.FETCH_FILE_INFO_FAILED,
            data: { outpoint },
          });

          dispatch(doToast({ message: `File timeout for uri ${uri}`, isError: true }));
        } else {
          if (streamInfo.purchase_receipt || streamInfo.content_fee) {
            dispatch({
              type: ACTIONS.PURCHASE_URI_COMPLETED,
              data: { uri, purchaseReceipt: streamInfo.purchase_receipt || streamInfo.content_fee },
            });
          }
          dispatch({
            type: ACTIONS.FETCH_FILE_INFO_COMPLETED,
            data: {
              fileInfo: streamInfo,
              outpoint: outpoint,
            },
          });

          if (onSuccess) {
            onSuccess(streamInfo);
          }
        }
      })
      .catch((error) => {
        dispatch({
          type: ACTIONS.PURCHASE_URI_FAILED,
          data: { uri, error },
        });

        dispatch({
          type: ACTIONS.FETCH_FILE_INFO_FAILED,
          data: { outpoint },
        });

        dispatch(
          doToast({
            message: `Failed to view ${uri}, please try again. If this problem persists, visit https://lbry.com/faq/support for support.`,
            isError: true,
          })
        );
      });
  };
}

export function doPurchaseUri(
  uri: string,
  costInfo: { cost: number },
  saveFile: boolean = true,
  onSuccess?: (GetResponse) => any
): ThunkAction<void> {
  return (dispatch: Dispatch, getState: GetState) => {
    dispatch({
      type: ACTIONS.PURCHASE_URI_STARTED,
      data: { uri },
    });

    const state = getState();
    const balance = selectBalance(state);
    const fileInfo = makeSelectFileInfoForUri(uri)(state);
    const downloadingByOutpoint = selectDownloadingByOutpoint(state);
    const alreadyDownloading = fileInfo && !!downloadingByOutpoint[fileInfo.outpoint];
    const alreadyStreaming = makeSelectStreamingUrlForUri(uri)(state);

    if (!saveFile && (alreadyDownloading || alreadyStreaming)) {
      dispatch({
        type: ACTIONS.PURCHASE_URI_FAILED,
        data: { uri, error: `Already fetching uri: ${uri}` },
      });

      if (onSuccess) {
        onSuccess(fileInfo);
      }

      return;
    }

    const { cost } = costInfo;
    if (parseFloat(cost) > balance) {
      dispatch({
        type: ACTIONS.PURCHASE_URI_FAILED,
        data: { uri, error: 'Insufficient credits' },
      });

      Promise.resolve();
      return;
    }

    dispatch(doFileGet(uri, saveFile, onSuccess));
  };
}

export function doClearPurchasedUriSuccess(): { type: string } {
  return {
    type: ACTIONS.CLEAR_PURCHASED_URI_SUCCESS,
  };
}
