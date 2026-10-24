import React from 'react';
import { connect } from 'react-redux';
import { useParams } from 'react-router';
import CollectionPage from './view';
import {
  selectTitleForUri,
  getThumbnailFromClaim,
  selectClaimIsMine,
  makeSelectClaimIsPending,
  makeSelectClaimForClaimId,
  makeSelectChannelForClaimUri,
} from 'redux/selectors/claims';

import {
  makeSelectCollectionForId,
  makeSelectUrlsForCollectionId,
  makeSelectIsResolvingCollectionForId,
  makeSelectCollectionIsMine,
  makeSelectCountForCollectionId,
  makeSelectEditedCollectionForId,
} from 'redux/selectors/collections';

import { doFetchItemsInCollection, doCollectionDelete, doCollectionEdit } from 'redux/actions/collections';
import { selectUser } from 'redux/selectors/user';

const select = (state, props) => {
  const { collectionId } = props;

  const claim = collectionId && makeSelectClaimForClaimId(collectionId)(state);
  const uri = (claim && (claim.canonical_url || claim.permanent_url)) || null;

  return {
    collectionId,
    claim,
    collection: makeSelectCollectionForId(collectionId)(state),
    collectionUrls: makeSelectUrlsForCollectionId(collectionId)(state),
    collectionCount: makeSelectCountForCollectionId(collectionId)(state),
    isResolvingCollection: makeSelectIsResolvingCollectionForId(collectionId)(state),
    title: selectTitleForUri(state, uri),
    thumbnail: getThumbnailFromClaim(claim),
    isMyClaim: selectClaimIsMine(state, claim), // or collection is mine?
    isMyCollection: makeSelectCollectionIsMine(collectionId)(state),
    claimIsPending: makeSelectClaimIsPending(uri)(state),
    collectionHasEdits: Boolean(makeSelectEditedCollectionForId(collectionId)(state)),
    uri,
    user: selectUser(state),
    channel: uri && makeSelectChannelForClaimUri(uri)(state),
  };
};

const perform = (dispatch) => ({
  fetchCollectionItems: (claimId, cb) => dispatch(doFetchItemsInCollection({ collectionId: claimId }, cb)), // if this collection is not resolved, resolve it
  deleteCollection: (id, colKey) => dispatch(doCollectionDelete(id, colKey)),
  editCollection: (id, params) => dispatch(doCollectionEdit(id, params)),
  renameCollection: (id, name) => dispatch(doCollectionEdit(id, { name })),
});

const ConnectedCollectionPage = connect(select, perform)(CollectionPage);

export default function CollectionRoute() {
  const { collectionId } = useParams();
  return <ConnectedCollectionPage collectionId={collectionId} />;
}
