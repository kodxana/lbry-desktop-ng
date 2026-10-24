// @flow
import { handleActions } from 'util/redux-utils';
import { buildURI } from 'util/lbryURI';
import * as ACTIONS from 'constants/action_types';
import * as THUMBNAIL_STATUSES from 'constants/thumbnail_upload_statuses';
import { CHANNEL_ANONYMOUS } from 'constants/claim';

const defaultState: PublishState = {
  editingURI: undefined,
  fileText: '',
  filePath: undefined,
  fileDur: 0,
  fileSize: 0,
  fileVid: false,
  remoteFileUrl: undefined,
  contentIsFree: true,
  fee: {
    amount: 1,
    currency: 'LBC',
  },
  title: '',
  thumbnail_url: '',
  thumbnailPath: '',
  uploadThumbnailStatus: THUMBNAIL_STATUSES.API_DOWN,
  thumbnailError: undefined,
  description: '',
  language: '',
  releaseTime: undefined,
  releaseTimeEdited: undefined,
  nsfw: false,
  channel: CHANNEL_ANONYMOUS,
  channelId: '',
  name: '',
  nameError: undefined,
  bid: 0.01,
  bidError: undefined,
  licenseType: 'None',
  otherLicenseDescription: 'All rights reserved',
  licenseUrl: '',
  tags: [],
  publishing: false,
  publishSuccess: false,
  publishError: undefined,
  optimize: false,
  useLBRYUploader: false,
};

export const publishReducer: (state: PublishState | void, action: { type: string, ... }) => PublishState =
  handleActions(
    {
      [ACTIONS.UPDATE_PUBLISH_FORM]: (state: PublishState, action: UpdatePublishFormAction): PublishState => {
        const { data } = action;
        return {
          ...state,
          ...data,
        };
      },
      [ACTIONS.CLEAR_PUBLISH]: (state: PublishState): PublishState => ({
        ...defaultState,
        uri: undefined,
        channel: state.channel,
        bid: state.bid || 0.01,
        optimize: state.optimize,
        language: state.language,
      }),
      [ACTIONS.PUBLISH_START]: (state: PublishState): PublishState => ({
        ...state,
        publishing: true,
        publishSuccess: false,
      }),
      [ACTIONS.PUBLISH_FAIL]: (state: PublishState): PublishState => ({
        ...state,
        publishing: false,
      }),
      [ACTIONS.PUBLISH_SUCCESS]: (state: PublishState): PublishState => ({
        ...state,
        publishing: false,
        publishSuccess: true,
      }),
      [ACTIONS.DO_PREPARE_EDIT]: (state: PublishState, action: UpdatePublishFormAction): PublishState => {
        const { ...publishData } = action.data;
        const { channel, name, uri } = publishData;

        // The short uri is what is presented to the user
        // The editingUri is the full uri with claim id
        const shortUri = buildURI({
          channelName: channel || undefined,
          streamName: name,
        });

        return {
          ...defaultState,
          ...publishData,
          editingURI: uri,
          uri: shortUri,
        };
      },
    },
    defaultState
  );
