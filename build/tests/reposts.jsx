// @flow
import { strict as assert } from 'assert';
import React from 'react';
import RepostCreate from 'component/repostCreate/view';
import analytics from 'analytics';
import { render, unmount, tick, waitFor } from './helpers';

const noop = () => {};

export default async function reposts(
  store: Readonly<{ getState: () => { claims: ClaimsState, ... }, ... }>,
  history: Readonly<{ push: (string) => unknown, location: { pathname: string, ... }, ... }>,
  uri: string
): Promise<void> {
  const claim = store.getState().claims.byId[uri.split('#')[1]];
  if (!claim || claim.value_type !== 'stream') throw Error('Missing stream fixture');
  const logPublish = analytics.apiLogPublish;
  const logged: Array<Claim> = [];
  analytics.apiLogPublish = (value) => {
    logged.push(value);
  };
  const calls: Array<StreamRepostOptions> = [];
  const toasts: Array<{ message: string }> = [];
  let pending = 0;
  let closed = 0;
  let cleared = 0;
  let result: Claim | void;
  const props = {
    claim,
    uri,
    name: 'fixture-repost',
    title: 'Fixture repost',
    repostUri: '',
    error: null,
    balance: 10,
    reposting: false,
    doRepost: async (options: StreamRepostOptions): Promise<Claim | void> => {
      calls.push(options);
      return result;
    },
    doToast: (toast: { message: string }): void => {
      toasts.push(toast);
    },
    doCheckPublishNameAvailability: async () => true,
    doCheckPendingClaims: () => {
      pending++;
    },
    doHideModal: () => {
      closed++;
    },
    doClearRepostError: () => {
      cleared++;
    },
    passedRepostAmount: 0,
    enteredRepostAmount: 0,
    isResolvingPassedRepost: false,
    isResolvingEnteredRepost: false,
    activeChannelClaim: null,
    fetchingMyChannels: false,
    incognito: true,
    contentUri: '',
    setContentUri: noop,
    setRepostUri: noop,
    redirectUri: '/$/uploads',
  };
  const button = (label: string): HTMLButtonElement => {
    const element = document.querySelector(`.repost-wrapper button[aria-label="${label}"]`);
    if (!(element instanceof HTMLButtonElement)) throw Error('Missing button: ' + label);
    return element;
  };
  try {
    for (const isModal of [false, true]) {
      history.push('/$/repost');
      render(<RepostCreate {...props} isModal={isModal} />, store, history);
      await waitFor(() => button('Repost') && !button('Repost').disabled, 'Repost form must be usable');
      result = undefined;
      const before = { logged: logged.length, toasts: toasts.length, pending, closed };
      button('Repost').click();
      await tick();
      assert.equal(logged.length, before.logged);
      assert.equal(toasts.length, before.toasts);
      assert.equal(pending, before.pending);
      assert.equal(closed, before.closed);
      assert.equal(history.location.pathname, '/$/repost', 'A failed repost must remain on the form');
      const request = calls.at(-1);
      if (!request) throw Error('Repost was not submitted');
      assert.equal(request.claim_id, claim.claim_id);
      assert.equal(request.bid, '0.01000000');
      result = {
        ...claim,
        claim_id: 'repost',
        value_type: 'repost',
        value: { ...claim.value, claim_id: claim.claim_id },
        reposted_claim: claim,
      };
      button('Repost').click();
      await tick();
      assert.equal(logged.at(-1), result);
      assert.equal(toasts.length, before.toasts + 1);
      assert.equal(pending, before.pending + 1);
      assert.equal(closed, before.closed + (isModal ? 1 : 0));
      assert.equal(history.location.pathname, isModal ? '/$/repost' : '/$/uploads');
      unmount();
    }
    render(<RepostCreate {...props} isModal />, store, history);
    await waitFor(() => button('Cancel'), 'Repost cancellation must remain available');
    const submitted = calls.length;
    button('Cancel').click();
    await tick();
    assert.equal(cleared, 1);
    assert.equal(closed, 2);
    assert.equal(calls.length, submitted, 'Cancel must not publish');
  } finally {
    unmount();
    analytics.apiLogPublish = logPublish;
  }
}
