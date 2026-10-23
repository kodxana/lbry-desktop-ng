import * as ACTIONS from 'constants/action_types';
import * as SORT_OPTIONS from 'constants/sort_options';
import * as PAGES from 'constants/pages';

const reducers = {};
const defaultState = {
  fileListPublishedSort: SORT_OPTIONS.DATE_NEW,
  fileListDownloadedSort: SORT_OPTIONS.DATE_NEW,
};

reducers[ACTIONS.FILE_LIST_STARTED] = (state) => ({ ...state, isFetchingFileList: true });

reducers[ACTIONS.FILE_LIST_SUCCEEDED] = (state, action) => {
  const { fileInfos } = action.data;
  const newByOutpoint = { ...state.byOutpoint };
  const pendingByOutpoint = { ...state.pendingByOutpoint };

  fileInfos.forEach((fileInfo) => {
    const { outpoint } = fileInfo;

    if (outpoint) newByOutpoint[fileInfo.outpoint] = fileInfo;
  });

  return { ...state, isFetchingFileList: false, byOutpoint: newByOutpoint, pendingByOutpoint };
};

reducers[ACTIONS.FETCH_FILE_INFO_STARTED] = (state, action) => {
  const { outpoint } = action.data;
  const newFetching = { ...state.fetching };

  newFetching[outpoint] = true;

  return { ...state, fetching: newFetching };
};

reducers[ACTIONS.FETCH_FILE_INFO_COMPLETED] = (state, action) => {
  const { fileInfo, outpoint } = action.data;

  const newByOutpoint = { ...state.byOutpoint };
  const newFetching = { ...state.fetching };

  newByOutpoint[outpoint] = fileInfo;
  delete newFetching[outpoint];

  return { ...state, byOutpoint: newByOutpoint, fetching: newFetching };
};

reducers[ACTIONS.FETCH_FILE_INFO_FAILED] = (state, action) => {
  const { outpoint } = action.data;
  const newFetching = { ...state.fetching };
  delete newFetching[outpoint];

  return { ...state, fetching: newFetching };
};

reducers[ACTIONS.DOWNLOADING_STARTED] = (state, action) => {
  const { outpoint, fileInfo } = action.data;

  const newByOutpoint = { ...state.byOutpoint };
  const newDownloading = { ...state.downloadingByOutpoint };

  newDownloading[outpoint] = true;
  newByOutpoint[outpoint] = fileInfo;

  return { ...state, downloadingByOutpoint: newDownloading, byOutpoint: newByOutpoint };
};

reducers[ACTIONS.DOWNLOADING_PROGRESSED] = (state, action) => {
  const { outpoint, fileInfo } = action.data;

  const newByOutpoint = { ...state.byOutpoint };
  const newDownloading = { ...state.downloadingByOutpoint };

  newByOutpoint[outpoint] = fileInfo;
  newDownloading[outpoint] = true;

  return { ...state, byOutpoint: newByOutpoint, downloadingByOutpoint: newDownloading };
};

reducers[ACTIONS.DOWNLOADING_CANCELED] = (state, action) => {
  const { outpoint } = action.data;

  const newDownloading = { ...state.downloadingByOutpoint };
  delete newDownloading[outpoint];

  return { ...state, downloadingByOutpoint: newDownloading };
};

reducers[ACTIONS.DOWNLOADING_COMPLETED] = (state, action) => {
  const { outpoint, fileInfo } = action.data;

  const newByOutpoint = { ...state.byOutpoint };
  const newDownloading = { ...state.downloadingByOutpoint };

  newByOutpoint[outpoint] = fileInfo;
  delete newDownloading[outpoint];

  return { ...state, byOutpoint: newByOutpoint, downloadingByOutpoint: newDownloading };
};

reducers[ACTIONS.FILE_DELETE] = (state, action) => {
  const { outpoint } = action.data;

  const newByOutpoint = { ...state.byOutpoint };
  const downloadingByOutpoint = { ...state.downloadingByOutpoint };

  delete newByOutpoint[outpoint];
  delete downloadingByOutpoint[outpoint];

  return { ...state, byOutpoint: newByOutpoint, downloadingByOutpoint };
};

reducers[ACTIONS.SET_FILE_LIST_SORT] = (state, action) => {
  const pageSortStates = {
    [PAGES.PUBLISHED]: 'fileListPublishedSort',
    [PAGES.DOWNLOADED]: 'fileListDownloadedSort',
  };
  const pageSortState = pageSortStates[action.data.page];
  const { value } = action.data;

  return { ...state, [pageSortState]: value };
};

export function fileInfoReducer(state = defaultState, action) {
  const handler = reducers[action.type];
  if (handler) return handler(state, action);
  return state;
}
