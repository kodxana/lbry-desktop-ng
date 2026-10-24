import * as ACTIONS from 'constants/action_types';

const reducers = {};

const defaultState = {
  authenticationIsPending: false,
  userIsPending: false,
  emailNewIsPending: false,
  emailNewErrorMessage: '',
  emailToVerify: '',
  emailAlreadyExists: false,
  emailDoesNotExist: false,
  resendingVerificationEmail: false,
  passwordResetPending: false,
  passwordResetSuccess: false,
  passwordResetError: undefined,
  passwordSetPending: false,
  passwordSetSuccess: false,
  passwordSetError: undefined,
  inviteNewErrorMessage: '',
  inviteNewIsPending: false,
  inviteStatusIsPending: false,
  invitesRemaining: undefined,
  invitees: undefined,
  referralLink: undefined,
  referralCode: undefined,
  user: undefined,
  accessToken: undefined,
  youtubeChannelImportPending: false,
  youtubeChannelImportErrorMessage: '',
  referrerSetIsPending: false,
  referrerSetError: '',
};

reducers[ACTIONS.AUTHENTICATION_STARTED] = (state) => ({
  ...state,
  authenticationIsPending: true,
  userIsPending: true,
  accessToken: defaultState.accessToken,
});

reducers[ACTIONS.AUTHENTICATION_SUCCESS] = (state, action) => ({
  ...state,
  authenticationIsPending: false,
  userIsPending: false,
  accessToken: action.data.accessToken,
  user: action.data.user,
});

reducers[ACTIONS.AUTHENTICATION_FAILURE] = (state) => ({
  ...state,
  authenticationIsPending: false,
  userIsPending: false,
  user: null,
});

reducers[ACTIONS.USER_FETCH_STARTED] = (state) => ({ ...state, userIsPending: true });

reducers[ACTIONS.USER_FETCH_SUCCESS] = (state, action) => ({
  ...state,
  userIsPending: false,
  user: action.data.user,
  emailToVerify: action.data.user.has_verified_email ? null : state.emailToVerify,
});

reducers[ACTIONS.USER_FETCH_FAILURE] = (state) => ({ ...state, userIsPending: true, user: null });

reducers[ACTIONS.USER_PHONE_NEW_STARTED] = (state, action) => {
  const user = { ...state.user };
  user.country_code = action.data.country_code;
  return { ...state, phoneNewIsPending: true, phoneNewErrorMessage: '', user };
};

reducers[ACTIONS.USER_PHONE_NEW_SUCCESS] = (state, action) => ({
  ...state,
  phoneToVerify: action.data.phone,
  phoneNewIsPending: false,
});

reducers[ACTIONS.USER_PHONE_RESET] = (state) => ({ ...state, phoneToVerify: null });

reducers[ACTIONS.USER_PHONE_NEW_FAILURE] = (state, action) => ({
  ...state,
  phoneNewIsPending: false,
  phoneNewErrorMessage: action.data.error,
});

reducers[ACTIONS.USER_PHONE_VERIFY_STARTED] = (state) => ({
  ...state,
  phoneVerifyIsPending: true,
  phoneVerifyErrorMessage: '',
});

reducers[ACTIONS.USER_PHONE_VERIFY_SUCCESS] = (state, action) => ({
  ...state,
  phoneToVerify: '',
  phoneVerifyIsPending: false,
  user: action.data.user,
});

reducers[ACTIONS.USER_PHONE_VERIFY_FAILURE] = (state, action) => ({
  ...state,
  phoneVerifyIsPending: false,
  phoneVerifyErrorMessage: action.data.error,
});

reducers[ACTIONS.USER_EMAIL_NEW_STARTED] = (state) => ({
  ...state,
  emailNewIsPending: true,
  emailNewErrorMessage: '',
  emailAlreadyExists: false,
  emailDoesNotExist: false,
});

reducers[ACTIONS.USER_EMAIL_NEW_SUCCESS] = (state, action) => {
  const user = { ...state.user };
  user.primary_email = action.data.email;
  return { ...state, emailToVerify: action.data.email, emailNewIsPending: false, user };
};

reducers[ACTIONS.USER_EMAIL_NEW_EXISTS] = (state) => ({ ...state, emailAlreadyExists: true });

reducers[ACTIONS.USER_EMAIL_NEW_DOES_NOT_EXIST] = (state) => ({ ...state, emailDoesNotExist: true });

reducers[ACTIONS.USER_EMAIL_NEW_FAILURE] = (state, action) => ({
  ...state,
  emailNewIsPending: false,
  emailNewErrorMessage: action.data.error,
});

reducers[ACTIONS.USER_EMAIL_NEW_CLEAR_ENTRY] = (state) => {
  const newUser = { ...state.user };
  delete newUser.primary_email;

  return {
    ...state,
    emailNewErrorMessage: null,
    emailAlreadyExists: false,
    emailDoesNotExist: false,
    passwordExistsForUser: false,
    emailToVerify: null,
    user: newUser,
  };
};

reducers[ACTIONS.USER_PASSWORD_SET_CLEAR] = (state) => ({
  ...state,
  passwordResetSuccess: false,
  passwordResetPending: false,
  passwordResetError: null,
  passwordSetPending: false,
  passwordSetSuccess: false,
});

reducers[ACTIONS.USER_EMAIL_VERIFY_STARTED] = (state) => ({
  ...state,
  emailVerifyIsPending: true,
  emailVerifyErrorMessage: '',
});

reducers[ACTIONS.USER_EMAIL_VERIFY_SUCCESS] = (state, action) => {
  const user = { ...state.user };
  user.primary_email = action.data.email;
  return { ...state, emailToVerify: '', emailVerifyIsPending: false, user };
};

reducers[ACTIONS.USER_EMAIL_VERIFY_FAILURE] = (state, action) => ({
  ...state,
  emailVerifyIsPending: false,
  emailVerifyErrorMessage: action.data.error,
});

reducers[ACTIONS.USER_EMAIL_VERIFY_SET] = (state, action) => ({ ...state, emailToVerify: action.data.email });

reducers[ACTIONS.USER_IDENTITY_VERIFY_STARTED] = (state) => ({
  ...state,
  identityVerifyIsPending: true,
  identityVerifyErrorMessage: '',
});

reducers[ACTIONS.USER_IDENTITY_VERIFY_SUCCESS] = (state, action) => ({
  ...state,
  identityVerifyIsPending: false,
  identityVerifyErrorMessage: '',
  user: action.data.user,
});

reducers[ACTIONS.USER_IDENTITY_VERIFY_FAILURE] = (state, action) => ({
  ...state,
  identityVerifyIsPending: false,
  identityVerifyErrorMessage: action.data.error,
});

reducers[ACTIONS.FETCH_ACCESS_TOKEN_SUCCESS] = (state, action) => {
  const { token } = action.data;

  return { ...state, accessToken: token };
};

reducers[ACTIONS.USER_INVITE_STATUS_FETCH_STARTED] = (state) => ({ ...state, inviteStatusIsPending: true });

reducers[ACTIONS.USER_INVITE_STATUS_FETCH_SUCCESS] = (state, action) => ({
  ...state,
  inviteStatusIsPending: false,
  invitesRemaining: action.data.invitesRemaining,
  invitees: action.data.invitees,
  referralLink: action.data.referralLink,
  referralCode: action.data.referralCode,
});

reducers[ACTIONS.USER_INVITE_NEW_STARTED] = (state) => ({
  ...state,
  inviteNewIsPending: true,
  inviteNewErrorMessage: '',
});

reducers[ACTIONS.USER_INVITE_NEW_SUCCESS] = (state) => ({
  ...state,
  inviteNewIsPending: false,
  inviteNewErrorMessage: '',
});

reducers[ACTIONS.USER_INVITE_NEW_FAILURE] = (state, action) => ({
  ...state,
  inviteNewIsPending: false,
  inviteNewErrorMessage: action.data.error.message,
});

reducers[ACTIONS.USER_INVITE_STATUS_FETCH_FAILURE] = (state) => ({
  ...state,
  inviteStatusIsPending: false,
  invitesRemaining: null,
  invitees: null,
});

reducers[ACTIONS.USER_YOUTUBE_IMPORT_STARTED] = (state) => ({
  ...state,
  youtubeChannelImportPending: true,
  youtubeChannelImportErrorMessage: '',
});

reducers[ACTIONS.USER_YOUTUBE_IMPORT_SUCCESS] = (state, action) => {
  const total = action.data.reduce((acc, value) => acc + value.total_published_videos, 0);

  const complete = action.data.reduce((acc, value) => acc + value.total_transferred, 0);

  return {
    ...state,
    youtubeChannelImportPending: false,
    youtubeChannelImportErrorMessage: '',
    youtubeChannelImportTotal: total,
    youtubeChannelImportComplete: complete,
  };
};

reducers[ACTIONS.USER_YOUTUBE_IMPORT_FAILURE] = (state, action) => ({
  ...state,
  youtubeChannelImportPending: false,
  youtubeChannelImportErrorMessage: action.data,
});

reducers[ACTIONS.USER_EMAIL_VERIFY_RETRY_STARTED] = (state) => ({ ...state, resendingVerificationEmail: true });

reducers[ACTIONS.USER_EMAIL_VERIFY_RETRY_SUCCESS] = (state) => ({ ...state, resendingVerificationEmail: false });

reducers[ACTIONS.USER_EMAIL_VERIFY_RETRY_FAILURE] = (state) => ({ ...state, resendingVerificationEmail: false });

reducers[ACTIONS.USER_SET_REFERRER_STARTED] = (state) => ({
  ...state,
  referrerSetIsPending: true,
  referrerSetError: defaultState.referrerSetError,
});

reducers[ACTIONS.USER_SET_REFERRER_SUCCESS] = (state) => ({
  ...state,
  referrerSetIsPending: false,
  referrerSetError: defaultState.referrerSetError,
});

reducers[ACTIONS.USER_SET_REFERRER_FAILURE] = (state, action) => ({
  ...state,
  referrerSetIsPending: false,
  referrerSetError: action.data.error.message,
});

reducers[ACTIONS.USER_SET_REFERRER_RESET] = (state) => ({
  ...state,
  referrerSetIsPending: false,
  referrerSetError: defaultState.referrerSetError,
});

reducers[ACTIONS.USER_PASSWORD_EXISTS] = (state) => ({ ...state, passwordExistsForUser: true });

reducers[ACTIONS.USER_PASSWORD_RESET_STARTED] = (state) => ({
  ...state,
  passwordResetPending: true,
  passwordResetSuccess: defaultState.passwordResetSuccess,
  passwordResetError: null,
});

reducers[ACTIONS.USER_PASSWORD_RESET_SUCCESS] = (state) => ({
  ...state,
  passwordResetPending: false,
  passwordResetSuccess: true,
});

reducers[ACTIONS.USER_PASSWORD_RESET_FAILURE] = (state, action) => ({
  ...state,
  passwordResetPending: false,
  passwordResetError: action.data.error,
});

reducers[ACTIONS.USER_PASSWORD_SET_STARTED] = (state) => ({
  ...state,
  passwordSetPending: true,
  passwordSetSuccess: defaultState.passwordSetSuccess,
});

reducers[ACTIONS.USER_PASSWORD_SET_SUCCESS] = (state) => ({
  ...state,
  passwordSetPending: false,
  passwordSetSuccess: true,
});

reducers[ACTIONS.USER_PASSWORD_SET_FAILURE] = (state, action) => ({
  ...state,
  passwordSetPending: false,
  passwordSetError: action.data.error,
});

export default function userReducer(state = defaultState, action) {
  const handler = reducers[action.type];
  if (handler) return handler(state, action);
  return state;
}
