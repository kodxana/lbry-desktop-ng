// @flow
import { strict as assert } from 'assert';
import React from 'react';
import { flushSync } from 'react-dom';
import Add from 'component/claimCollectionAdd/view';
import Item from 'component/collectionSelectItem/view';
import Lists from 'component/collectionsListMine/view';
import CollectionForm from 'component/collectionEdit/view';
import ClaimMenu from 'component/claimMenuList/view';
import Remove from 'modal/modalRemoveCollection/view';
import * as MODALS from 'constants/modal_types';
import analytics from 'analytics';
import type { Props as FormProps } from 'component/collectionEdit/view';
import type { Props as MenuProps } from 'component/claimMenuList/view';
import type { TestStore, TestHistory } from './collections';
import { render, unmount, waitFor, tick, input } from './helpers';

const noop = () => {};
function element(selector: string): HTMLElement {
  const found = document.querySelector(selector);
  if (!(found instanceof HTMLElement)) throw Error('Missing control: ' + selector);
  return found;
}
function button(label: string): HTMLButtonElement {
  const found = document.querySelector(`button[aria-label="${label}"]`);
  if (!(found instanceof HTMLButtonElement)) throw Error('Missing button: ' + label);
  return found;
}
function field(selector: string): HTMLInputElement {
  const found = element(selector);
  if (!(found instanceof HTMLInputElement)) throw Error('Missing input: ' + selector);
  return found;
}
function enter(selector: string, value: string): void {
  const target = field(selector);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw Error('Missing input setter');
  setter.call(target, value);
  flushSync(() => target.dispatchEvent(new Event('input', { bubbles: true })));
}
function key(selector: string, value: string): void {
  flushSync(() =>
    element(selector).dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))
  );
}
async function tab(label: string): Promise<void> {
  const target = Array.from(document.querySelectorAll('[role="tab"]')).find((item) => item.textContent === label);
  if (!(target instanceof HTMLElement)) throw Error('Missing tab: ' + label);
  target.click();
  await waitFor(() => target.getAttribute('aria-selected') === 'true', 'Tab must open: ' + label);
}
async function openMenu(): Promise<void> {
  element('.menu__button').click();
  await waitFor(
    () => document.querySelector('.menu__button')?.getAttribute('aria-expanded') === 'true',
    'Claim menu must open'
  );
}
function menuItem(label: string): ?HTMLElement {
  const found = Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent === label);
  return found instanceof HTMLElement ? found : null;
}
async function choose(label: string): Promise<void> {
  await openMenu();
  const item = menuItem(label);
  if (!item) throw Error('Missing menu item: ' + label);
  item.click();
  await tick();
}

export default async function collectionControls(store: TestStore, history: TestHistory, uri: string): Promise<void> {
  const claim = store.getState().claims.byId[uri.split('#')[1]];
  if (!claim || claim.value_type !== 'stream') throw Error('Missing stream fixture');
  const collection: Collection = { id: 'controls', name: 'My List', type: 'playlist', items: [uri], updatedAt: 1 };
  const added: Array<{ name: string, urls: Array<string>, type: string }> = [];
  const addProps = {
    uri,
    builtin: {},
    published: {},
    unpublished: {},
    closeModal: noop,
    addCollection: (name: string, urls: Array<string>, type: string): void => {
      added.push({ name, urls, type });
    },
  };
  for (const resolved of [false, true]) {
    render(<Add {...addProps} claim={resolved ? claim : undefined} />, store, history);
    button('New List').click();
    await waitFor(() => document.getElementById('new_collection'), 'New list input must open');
    input('new_collection', '   ');
    key('#new_collection', 'Enter');
    assert.equal(added.length, 0, 'Whitespace must not create a list');
    input('new_collection', 'Saved list');
    key('#new_collection', 'Enter');
    assert.equal(added.length, resolved ? 1 : 0, 'Creation requires a resolved permanent URL');
    unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    assert.equal(added.length, resolved ? 1 : 0, 'Unmount must not leave an Enter listener');
  }
  assert.deepEqual(added, [{ name: 'Saved list', urls: [uri], type: 'playlist' }]);
  const edits: Array<{ id: string, params: CollectionEditParams }> = [];
  const itemProps = {
    hasClaim: true,
    category: 'unpublished',
    edited: false,
    uri,
    editCollection: (id: string, params: CollectionEditParams): void => {
      edits.push({ id, params });
    },
  };
  render(<Item {...itemProps} collection={undefined} collectionPending={false} />, store, history);
  assert.equal(document.querySelector('input[type="checkbox"]'), null);
  for (const pending of [true, false]) {
    render(<Item {...itemProps} collection={collection} collectionPending={pending} />, store, history);
    const checkbox = field('input[type="checkbox"]');
    assert.equal(checkbox.disabled, pending);
    checkbox.click();
    await tick();
    assert.equal(edits.length, pending ? 0 : 1);
  }
  assert.deepEqual(edits[0], { id: collection.id, params: { uris: [uri], remove: true } });
  unmount();
  render(
    <Lists builtinCollections={{}} publishedCollections={{}} unpublishedCollections={{}} fetchingCollections={false} />,
    store,
    history
  );
  enter('input[placeholder="Search"]', 'test');
  key('input[placeholder="Search"]', 'Escape');
  assert.equal(field('input[placeholder="Search"]').value, '');
  button('Private').click();
  await tick();
  assert(button('Private').classList.contains('button-toggle--active'));
  unmount();

  const calls: Array<CollectionCreateOptions | CollectionUpdateOptions> = [];
  const completed: Array<string> = [];
  const logPublish = analytics.apiLogPublish;
  const logged: Array<Claim> = [];
  analytics.apiLogPublish = (value) => {
    logged.push(value);
  };
  let result: Claim | void;
  const formProps: FormProps = {
    uri: undefined,
    claim: undefined,
    collectionId: collection.id,
    collection,
    collectionClaimIds: [claim.claim_id],
    collectionUrls: [uri],
    balance: 10,
    disabled: false,
    activeChannelClaim: undefined,
    incognito: true,
    title: 'Initial title',
    amount: 1.00000001,
    thumbnailUrl: undefined,
    description: 'Original description',
    tags: ['original'],
    locations: [{ country: 'PL', city: 'Warsaw' }],
    languages: ['en', 'en'],
    updatingCollection: false,
    creatingCollection: false,
    updateError: undefined,
    createError: undefined,
    publishCollection: async (options) => {
      calls.push(options);
      return result;
    },
    publishCollectionUpdate: async (options) => {
      calls.push(options);
      return result;
    },
    clearCollectionErrors: noop,
    resetThumbnailStatus: noop,
    setActiveChannel: noop,
    setIncognito: noop,
    doCollectionEdit: noop,
    onDone: (id) => {
      completed.push(id);
    },
  };
  try {
    render(<CollectionForm {...formProps} />, store, history);
    await waitFor(
      () => field('#channel_title2').value === collection.name,
      'A new list uses its local name as the initial title'
    );
    input('channel_title2', 'Updated title');
    await tab('Tags');
    enter('.tag__input', 'one, two');
    flushSync(() =>
      element('form.tags__input-wrapper').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    );
    button('Submit').click();
    await tick();
    assert.equal(calls.length, 1);
    assert.deepEqual(
      calls[0].tags,
      [{ name: 'original' }, { name: 'one' }, { name: 'two' }],
      'One submission must retain every comma-separated tag'
    );
    assert.equal(calls[0].title, 'Updated title');
    assert.equal(calls[0].description, 'Original description');
    assert.deepEqual(calls[0].locations, formProps.locations);
    assert.deepEqual(calls[0].languages, ['en']);
    assert.equal(Number(calls[0].bid), 1.00000001);
    assert.deepEqual(calls[0].claims, [claim.claim_id]);
    assert.equal(completed.length, 0, 'A failed SDK result must keep the form open');
    assert.equal(logged.length, 0);
    button('Cancel').click();
    assert.equal(completed.length, 1);
    assert.equal(calls.length, 1, 'Cancel must not publish');
    unmount();
    render(<CollectionForm {...formProps} uri="lbry://unresolved-list" claim={undefined} />, store, history);
    await tick();
    button('Submit').click();
    assert.equal(calls.length, 1, 'An unresolved list must not submit an update without its claim ID');
    unmount();
    const published: CollectionClaim = {
      ...claim,
      claim_id: 'published-list',
      value_type: 'collection',
      value: { claims: [claim.claim_id] },
    };
    result = published;
    render(<CollectionForm {...formProps} uri={published.permanent_url} claim={published} />, store, history);
    await waitFor(() => !button('Submit').disabled, 'Resolved collection update must be available');
    button('Submit').click();
    await waitFor(() => completed.length === 2, 'Successful update must complete');
    assert.equal(calls[1].claim_id, published.claim_id);
    assert.deepEqual(calls[1].locations, formProps.locations);
    assert.equal(logged[0], published);
  } finally {
    unmount();
    analytics.apiLogPublish = logPublish;
  }

  const modals: Array<{ id: string, payload: unknown }> = [];
  const prepared: Array<StreamClaim> = [];
  const menuProps: MenuProps = {
    uri,
    claim,
    contentClaim: claim,
    repostedClaim: undefined,
    contentSigningChannel: undefined,
    contentChannelUri: undefined,
    openModal: (id, payload) => {
      modals.push({ id, payload });
    },
    channelIsMuted: false,
    channelIsBlocked: false,
    channelIsAdminBlocked: false,
    isAdmin: false,
    doChannelMute: noop,
    doChannelUnmute: noop,
    doCommentModBlock: noop,
    doCommentModUnBlock: noop,
    doCommentModBlockAsAdmin: noop,
    doCommentModUnBlockAsAdmin: noop,
    doCollectionEdit: noop,
    hasClaimInWatchLater: false,
    hasClaimInFavorites: false,
    claimInCollection: false,
    collectionId: undefined,
    isMyCollection: false,
    doToast: noop,
    claimIsMine: true,
    fileInfo: undefined,
    prepareEdit: (value) => {
      prepared.push(value);
    },
    isSubscribed: false,
    doChannelSubscribe: noop,
    doChannelUnsubscribe: noop,
    isChannelPage: false,
    editedCollection: undefined,
    playNextUri: undefined,
    resolvedList: undefined,
    fetchCollectionItems: noop,
    doToggleShuffleList: noop,
    lastUsedCollection: undefined,
    hasClaimInLastUsedCollection: false,
    lastUsedCollectionIsNotBuiltin: false,
  };
  render(<ClaimMenu {...menuProps} claim={undefined} />, store, history);
  assert.equal(document.querySelector('.menu__button'), null);
  render(<ClaimMenu {...menuProps} />, store, history);
  await choose('Delete');
  assert.deepEqual(modals.pop(), { id: MODALS.CONFIRM_FILE_REMOVE, payload: { uri, doGoBack: false } });
  await choose('Edit');
  assert.equal(prepared[0], claim);
  unmount();
  render(<ClaimMenu {...menuProps} claimIsMine={false} />, store, history);
  await openMenu();
  assert.equal(menuItem('Edit'), null, 'An unowned stream must not expose editing');
  assert.equal(menuItem('Delete'), null);
  unmount();
  let fetched = 0;
  let shuffled = 0;
  function ShuffleFixture({ next }: { next: string }): React.Node {
    const [resolved, setResolved] = React.useState<?Array<?string>>(null);
    const [play, setPlay] = React.useState<?string>(null);
    return (
      <ClaimMenu
        {...menuProps}
        claim={{ ...claim, value_type: 'collection', value: { claims: ['first', 'second'] } }}
        collectionId="list"
        resolvedList={resolved}
        playNextUri={play ? next : null}
        fetchCollectionItems={() => {
          fetched++;
          setTimeout(() => setResolved([uri]), 20);
        }}
        doToggleShuffleList={() => {
          shuffled++;
          setPlay(uri);
        }}
      />
    );
  }
  render(<ShuffleFixture next={uri} />, store, history);
  await choose('Shuffle Play');
  await waitFor(
    () => shuffled >= 1 && history.location.pathname.includes('fixture-1'),
    'Shuffle must resolve and navigate'
  );
  const destination = history.location.pathname;
  render(<ShuffleFixture next="lbry://unexpected#abc" />, store, history);
  await tick();
  assert.equal(fetched, 1);
  assert.equal(shuffled, 1, 'A changing playback URI must not toggle shuffle again');
  assert.equal(history.location.pathname, destination, 'One menu selection must navigate only once');
  unmount();

  const deleted: Array<{ id: string, category: ?string }> = [];
  let closed = 0;
  const removeProps = {
    collectionId: collection.id,
    collectionName: collection.name,
    claim,
    redirect: undefined,
    closeModal: () => {
      closed++;
    },
    collectionDelete: (id: string, category: ?string): void => {
      deleted.push({ id, category });
    },
  };
  for (const published of [false, true]) {
    render(<Remove {...removeProps} uri={published ? uri : undefined} />, store, history);
    await tick();
    assert(document.body.textContent?.includes(collection.name));
    if (published) {
      assert(button('Delete').disabled);
      button('Delete').click();
      assert.equal(deleted.length, 1, 'A public list requires name confirmation');
      enter('input[type="text"]', collection.name);
    }
    button('Delete').click();
    await tick();
    assert.deepEqual(deleted.at(-1), { id: collection.id, category: published ? 'resolved' : undefined });
    unmount();
  }
  render(<Remove {...removeProps} uri={uri} />, store, history);
  button('Cancel').click();
  assert.equal(closed, 3);
  assert.equal(deleted.length, 2);
  unmount();
}
