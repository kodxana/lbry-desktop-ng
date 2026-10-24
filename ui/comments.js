// @flow
import { COMMENT_SERVER_API } from 'config';

const defaultServer: ?string = COMMENT_SERVER_API;
const defaultEnabled: boolean = Boolean(defaultServer);
const Comments = {
  url: defaultServer,
  enabled: defaultEnabled,
  isCustomServer: false,

  setServerUrl: (customUrl: ?string): void => {
    Comments.url = customUrl === undefined ? COMMENT_SERVER_API : customUrl;
    Comments.enabled = Boolean(Comments.url);
    Comments.isCustomServer = Comments.url !== COMMENT_SERVER_API;
  },

  moderation_block: (params: ModerationBlockParams): Promise<ModerationBlockResponse> =>
    fetchCommentsApi('moderation.Block', params),
  moderation_unblock: (params: ModerationUnblockParams): Promise<unknown> =>
    fetchCommentsApi('moderation.UnBlock', params),
  moderation_block_list: (params: BlockedListArgs): Promise<ModerationBlockListResponse> =>
    fetchCommentsApi('moderation.BlockedList', params),
  moderation_add_delegate: (params: ModerationAddDelegateParams): Promise<unknown> =>
    fetchCommentsApi('moderation.AddDelegate', params),
  moderation_remove_delegate: (params: ModerationRemoveDelegateParams): Promise<unknown> =>
    fetchCommentsApi('moderation.RemoveDelegate', params),
  moderation_list_delegates: (params: ModerationListDelegatesParams): Promise<ModerationDelegatesResponse> =>
    fetchCommentsApi('moderation.ListDelegates', params),
  moderation_am_i: (params: ModerationAmIParams): Promise<ModerationAmIResponse> =>
    fetchCommentsApi('moderation.AmI', params),
  comment_list: (params: CommentListParams): Promise<CommentListResponse> => fetchCommentsApi('comment.List', params),
  comment_abandon: (params: CommentAbandonParams): Promise<CommentAbandonResponse> =>
    fetchCommentsApi('comment.Abandon', params),
  comment_create: (params: CommentCreateParams): Promise<CommentCreateResponse> =>
    fetchCommentsApi('comment.Create', params),
  comment_by_id: (params: CommentByIdParams): Promise<CommentByIdResponse> => fetchCommentsApi('comment.ByID', params),
  comment_pin: (params: CommentPinParams): Promise<CommentPinResponse> => fetchCommentsApi('comment.Pin', params),
  comment_edit: (params: CommentEditParams): Promise<CommentEditResponse> => fetchCommentsApi('comment.Edit', params),
  reaction_list: (params: ReactionListParams): Promise<ReactionListResponse> =>
    fetchCommentsApi('reaction.List', params),
  reaction_react: (params: ReactionReactParams): Promise<ReactionReactResponse> =>
    fetchCommentsApi('reaction.React', params),
  setting_list: (params: SettingsParams): Promise<SettingsResponse> => fetchCommentsApi('setting.List', params),
  setting_block_word: (params: BlockWordParams): Promise<unknown> => fetchCommentsApi('setting.BlockWord', params),
  setting_unblock_word: (params: BlockWordParams): Promise<unknown> => fetchCommentsApi('setting.UnBlockWord', params),
  setting_list_blocked_words: (params: SettingsParams): Promise<{ word_list: Array<string>, ... }> =>
    fetchCommentsApi('setting.ListBlockedWords', params),
  setting_update: (params: UpdateSettingsParams): Promise<unknown> => fetchCommentsApi('setting.Update', params),
  setting_get: (params: SettingsParams): Promise<SettingsResponse> => fetchCommentsApi('setting.Get', params),
  super_list: (params: SuperListParams): Promise<SuperListResponse> =>
    fetchCommentsApi('comment.SuperChatList', params),
};

function fetchCommentsApi<Result>(method: string, params: { ... }): Promise<Result> {
  if (!Comments.url) {
    return Promise.reject(new Error('Commenting server is not set.'));
  } else if (!Comments.enabled) {
    return Promise.reject('Comments are not currently enabled.'); // eslint-disable-line
  }

  const url = `${Comments.url}?m=${method}`;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  };

  return fetch(url, options)
    .then((res) => res.json())
    .then((res: { error?: { message: string, ... }, result: Result, ... }) => {
      if (res.error) {
        throw new Error(res.error.message);
      }
      return res.result;
    });
}

export default Comments;
