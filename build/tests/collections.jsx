// @flow
import { strict as assert } from 'assert';
import React from 'react';
import { useSelector } from 'react-redux';
import { ipcRenderer } from 'electron';
import Lbry from 'lbry';
import localForage from 'localforage';
import createCompressor from 'redux-persist-transform-compress';
import * as ACTIONS from 'constants/action_types';
import { doCollectionEdit } from 'redux/actions/collections';
import CollectionSidebar from 'component/collectionContentSidebar/view';
import CollectionPage from 'page/collection/view';
import CollectionEditor from 'component/collectionEdit/view';
import CollectionButtons from 'component/collectionEditButtons/view';
import reposts from './reposts';
import { render, unmount, waitFor, tick } from './helpers';
import 'scss/third-party.scss';
import 'scss/all.scss';

const noop = () => {};
const key = (value) => ipcRenderer.invoke('fixture-controls-key', value);
const handles = () => Array.from(document.querySelectorAll('.collection-preview__edit-group[role="button"]'));
const dragging = () => document.querySelector('.claim-list li[style*="position: fixed"]');
const button = (label: string): HTMLButtonElement => {
  const element = document.querySelector(`button[aria-label="${label}"]`);
  if (!(element instanceof HTMLButtonElement)) throw new Error('Missing button: ' + label);
  return element;
};
const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

export default async function collections(store, history) {
  const preferenceSet = Lbry.preference_set;
  const preferences = [];
  Lbry.preference_set = async ({ key, value }) => {
    assert.equal(key, 'local');
    const preference = JSON.parse(value);
    assert.equal(preference.version, '0.1');
    preferences.push(preference.value);
    return true;
  };
  try {
    for (const index of [undefined, -1, 3]) {
      const moves = [];
      render(
        <CollectionButtons
          uri="lbry://missing"
          collectionIndex={index}
          collectionUris={['one', 'two']}
          editCollection={(params) => {
            moves.push(params);
          }}
        />,
        store,
        history
      );
      for (const name of ['Move Top', 'Move Bottom', 'Move Up', 'Move Down']) {
        assert.equal(button(name).disabled, true, 'A missing item cannot reorder another collection entry');
        button(name).click();
      }
      assert.equal(moves.length, 0);
      unmount();
    }
    const uris = [1, 2, 3].map((number) => `lbry://fixture-${number}#${String(number).repeat(40)}`);
    store.dispatch({
      type: ACTIONS.RESOLVE_URIS_COMPLETED,
      data: {
        resolveInfo: Object.fromEntries(
          uris.map((uri, index) => [
            uri,
            {
              stream: {
                claim_id: String(index + 1).repeat(40),
                name: `fixture-${index + 1}`,
                permanent_url: uri,
                canonical_url: uri,
                value_type: 'stream',
                meta: { creation_timestamp: 1700000000 },
                value: {
                  title: `Fixture ${index + 1}`,
                  stream_type: 'video',
                  video: { duration: 60 },
                  source: { media_type: 'video/mp4', size: 1000 },
                  tags: [],
                },
              },
            },
          ])
        ),
      },
    });
    await ipcRenderer.invoke('fixture-controls-focus');
    const edits = [];
    const edit = (id, params) => {
      edits.push({ id, params });
      return store.dispatch(doCollectionEdit(id, params));
    };
    let published = 0;
    const publish = () => {
      published++;
      return Promise.resolve();
    };
    function Fixture({ id, kind }: { id: string, kind: string }) {
      const collection = useSelector((state) => state.collections.unpublished[id]);
      const common = { collectionId: id, collection, collectionUrls: collection.items };
      if (kind === 'sidebar')
        return (
          <CollectionSidebar
            {...common}
            id={id}
            collectionName={collection.name}
            isMyCollection
            url={uris[0]}
            doCollectionEdit={edit}
            doToggleLoopList={noop}
            doToggleShuffleList={noop}
          />
        );
      if (kind === 'page')
        return (
          <CollectionPage
            {...common}
            collectionCount={collection.items.length}
            editCollection={edit}
            fetchCollectionItems={noop}
          />
        );
      return (
        <CollectionEditor
          {...common}
          collectionClaimIds={collection.items.map((uri) => uri.split('#')[1])}
          balance={0}
          incognito
          doCollectionEdit={(params) => edit(id, params)}
          clearCollectionErrors={noop}
          resetThumbnailStatus={noop}
          setIncognito={noop}
          setActiveChannel={noop}
          publishCollection={publish}
          publishCollectionUpdate={publish}
        />
      );
    }
    for (const kind of ['sidebar', 'page', 'editor']) {
      const id = `fixture-${kind}-collection`;
      store.dispatch({
        type: ACTIONS.COLLECTION_NEW,
        data: { entry: { id, name: 'Fixture list', type: 'playlist', items: uris.slice() } },
      });
      history.push('/$/lists');
      render(<Fixture id={id} kind={kind} />, store, history);
      if (kind === 'editor') {
        const itemsTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
          (tab) => tab.textContent === 'Items'
        );
        itemsTab.click();
        await waitFor(() => itemsTab.getAttribute('aria-selected') === 'true', 'Editor items tab must open');
      } else {
        assert.equal(handles().length, 0, 'Read mode must not expose drag controls');
        button('Edit').click();
      }
      await waitFor(
        () => handles().length === 3 && handles()[0].getBoundingClientRect().height > 0,
        `${kind} must show real collection drag handles`
      );
      history.push('/$/lists');
      await tick();
      handles()[0].scrollIntoView({ block: 'center' });
      await frame();
      const original = store.getState().collections.unpublished[id];
      const before = edits.length;
      const handle = handles()[0];
      handle.focus();
      await key(' ');
      await waitFor(dragging, `${kind}: Space must pick up the focused item`);
      await key('ArrowDown');
      await frame();
      await key(' ');
      await waitFor(() => edits.length === before + 1 && !dragging(), `${kind}: keyboard drop must save one reorder`);
      assert.deepEqual(edits[before], { id, params: { order: { from: 0, to: 1 } } });
      assert.deepEqual(store.getState().collections.unpublished[id].items, [uris[1], uris[0], uris[2]]);
      assert.deepEqual(original.items, uris, 'Reordering must not mutate the previous collection snapshot');
      assert.equal(history.location.pathname, '/$/lists', 'Dragging must not navigate to the claim');
      await waitFor(() => document.activeElement === handle, 'Keyboard drop must restore focus to the visible handle');

      const reordered = store.getState().collections.unpublished[id];
      handle.focus();
      await key(' ');
      await waitFor(dragging, 'The same handle must support another drag');
      await key('ArrowUp');
      await frame();
      await key('Escape');
      await waitFor(() => !dragging(), 'Escape must cancel dragging');
      assert.equal(edits.length, before + 1, 'Cancelled dragging must not edit the collection');
      assert.equal(store.getState().collections.unpublished[id], reordered);

      if (kind === 'sidebar') {
        const currentHandles = handles();
        const first = currentHandles[0].getBoundingClientRect();
        const second = currentHandles[1].getBoundingClientRect();
        const x = first.x + first.width / 2;
        const y = first.y + first.height / 2;
        const mouse = (type, nextY) => ipcRenderer.invoke('fixture-collection-mouse', { type, x, y: nextY });
        await mouse('mousePressed', y);
        await mouse('mouseMoved', y + 10);
        await waitFor(dragging, 'Mouse movement must lift a collection item');
        await mouse('mouseMoved', second.y + second.height / 2 + 10);
        await frame();
        await mouse('mouseReleased', second.y + second.height / 2 + 10);
        await waitFor(() => edits.length === before + 2 && !dragging(), 'Mouse drop must save one reorder');
        assert.deepEqual(store.getState().collections.unpublished[id].items, uris);
        assert.equal(history.location.pathname, '/$/lists', 'Releasing a drag must suppress claim navigation');
        assert.equal(button('Move Top').disabled, true, 'The first item cannot move above the top');
        button('Move Bottom').click();
        await waitFor(
          () => store.getState().collections.unpublished[id].items[2] === uris[0],
          'Move buttons must still reorder through Redux'
        );
        const remove = document.querySelector('.button-collection-delete');
        remove.click();
        await waitFor(
          () => document.querySelector('.button-collection-delete-cancel'),
          'Removal must offer cancellation'
        );
        document.querySelector('.button-collection-delete-cancel').click();
        await waitFor(
          () => !document.querySelector('.button-collection-delete-cancel'),
          'Cancellation must close the prompt'
        );
        assert.equal(store.getState().collections.unpublished[id].items.length, 3, 'Cancel removal retains the item');
        document.querySelector('.button-collection-delete').click();
        await waitFor(
          () => document.querySelector('.button-collection-delete-confirm'),
          'Removal must require confirmation'
        );
        document.querySelector('.button-collection-delete-confirm').click();
        await waitFor(
          () => store.getState().collections.unpublished[id].items.length === 2,
          'Confirmed removal must remove only the chosen item'
        );
        button('Edit').click();
        await waitFor(() => !handles().length, 'Leaving edit mode removes the drag handles');
      }
      unmount();
      await tick();
      const snapshot = store.getState().collections.unpublished[id];
      await key('ArrowDown');
      await key(' ');
      assert.equal(store.getState().collections.unpublished[id], snapshot, 'Unmount must remove drag sensors');
    }
    assert.equal(published, 0, 'Reordering must never publish or spend credits');
    const latest = () => preferences[preferences.length - 1];
    const expected = store.getState().collections.unpublished;
    await waitFor(
      () => latest() && JSON.stringify(latest().unpublishedCollections) === JSON.stringify(expected),
      'The settled collection order must reach wallet preferences'
    );
    await require('../../ui/store').persistor.flush();
    const serialized = JSON.parse(await localForage.getItem('persist:v0'));
    const saved = createCompressor().out(JSON.parse(serialized.collections), 'collections');
    assert.deepEqual(saved.unpublished, expected, 'Desktop persistence must retain reordered and removed items');
    await reposts(store, history, uris[0]);
    return 'collection page, publishing editor and sidebar: keyboard/mouse reordering, focus, cancellation, move/remove controls, persisted order and no automatic publish; repost failure, success and cancellation';
  } finally {
    unmount();
    Lbry.preference_set = preferenceSet;
  }
}
