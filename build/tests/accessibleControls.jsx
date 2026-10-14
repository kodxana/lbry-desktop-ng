import { strict as assert } from 'assert';
import React from 'react';
import { ipcRenderer } from 'electron';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'component/common/tabs';
import HeaderMenuButtons from 'component/headerMenuButtons/view';
import BlockList from 'component/blockList/view';
import WunderbarSuggestions from 'component/wunderbarSuggestions/view';
import TextareaWithSuggestions from 'component/textareaWithSuggestions/view';
import Expandable from 'component/expandable/view';
import { lighthouse } from 'redux/actions/search';
import * as ACTIONS from 'constants/action_types';
import { render, unmount, tick, waitFor, submit } from './helpers';
import 'scss/third-party.scss';
import 'scss/all.scss';

const key = (node, value, keyCode) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key: value, keyCode, bubbles: true, cancelable: true }));
const type = (field, value) => {
  field.focus();
  const prototype = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, value);
  field.setSelectionRange(value.length, value.length);
  field.dispatchEvent(new Event('input', { bubbles: true }));
};
const options = () => Array.from(document.querySelectorAll('[role="option"]'));
const noop = () => {};

async function tabs(store, history) {
  let submissions = 0;
  const changes = [];
  let select;
  let rename;
  function Editor() {
    const [index, setIndex] = React.useState(0);
    const [label, setLabel] = React.useState('About');
    select = setIndex;
    rename = setLabel;
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submissions++;
        }}
      >
        <Tabs
          index={index}
          onChange={(next) => {
            changes.push(next);
            setIndex(next);
          }}
        >
          <TabList aria-label="Channel editor">
            <Tab index={0}>Content</Tab>
            <Tab index={1} disabled>
              Playlists
            </Tab>
            <Tab index={2}>{label}</Tab>
            <Tab index={3}>Community</Tab>
          </TabList>
          <TabPanels header={<p>Editor header</p>}>
            <TabPanel>Content panel</TabPanel>
            <TabPanel>Playlists panel</TabPanel>
            <TabPanel>About panel</TabPanel>
            <TabPanel>Community panel</TabPanel>
          </TabPanels>
        </Tabs>
      </form>
    );
  }
  render(<Editor />, store, history);
  const labels = Array.from(document.querySelectorAll('[role="tab"]'));
  const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
  const indicator = document.querySelector('.tab__divider');
  const check = async (index) => {
    await waitFor(() => labels[index].getAttribute('aria-selected') === 'true', 'Selected tab must change');
    await waitFor(() => {
      const rect = labels[index].getBoundingClientRect();
      const parent = document.querySelector('.tabs').getBoundingClientRect();
      return (
        Math.abs(parseFloat(indicator.style.width) - rect.width) < 1 &&
        Math.abs(parseFloat(indicator.style.left) - (rect.left - parent.left)) < 1
      );
    }, 'The active underline must follow the selected tab and its size');
    panels.forEach((panel, position) => {
      assert.equal(panel.hidden, position !== index);
      assert.equal(panel.getAttribute('aria-labelledby'), labels[position].id);
      assert.equal(labels[position].getAttribute('aria-controls'), panel.id);
      assert.equal(labels[position].tabIndex, position === index ? 0 : -1);
    });
  };
  await check(0);
  labels[0].focus();
  key(labels[0], 'ArrowRight', 39);
  await check(2);
  assert.equal(document.activeElement, labels[2], 'Arrow navigation skips disabled tabs');
  key(labels[2], 'End', 35);
  await check(3);
  key(labels[3], 'Home', 36);
  await check(0);
  labels[1].click();
  await check(0);
  labels[2].click();
  await check(2);
  rename('Editing your channel with a longer label');
  await check(2);
  select(3);
  await check(3);
  assert.deepEqual(changes, [2, 3, 0, 2]);
  assert.equal(submissions, 0, 'Tab buttons inside channel forms must never submit');
  unmount();
}

async function menus(store, history) {
  const toggles = [];
  history.replace('/controls');
  render(
    <HeaderMenuButtons
      currentTheme="dark"
      automaticDarkModeEnabled={false}
      handleThemeToggle={(...args) => toggles.push(args)}
    />,
    store,
    history
  );
  const triggers = Array.from(document.querySelectorAll('[data-reach-menu-button]'));
  assert.equal(triggers.length, 2);
  assert.notEqual(triggers[0].id, triggers[1].id, 'Multiple menus require distinct accessible IDs');
  const open = async (trigger) => {
    trigger.focus();
    key(trigger, 'ArrowDown', 40);
    await waitFor(() => trigger.getAttribute('aria-expanded') === 'true', 'Menu must open from keyboard');
    const menu = document.querySelector(`[role="menu"][aria-labelledby="${trigger.id}"]`);
    assert.equal(menu.getAttribute('aria-labelledby'), trigger.id);
    await waitFor(() => document.activeElement === menu, 'Menu receives focus');
    return menu;
  };
  const closed = async (trigger) => {
    await waitFor(() => trigger.getAttribute('aria-expanded') !== 'true', 'Menu must close');
    assert.equal(document.activeElement, trigger, 'Closing returns focus to the trigger');
  };
  let menu = await open(triggers[0]);
  key(menu, 'Escape', 27);
  await closed(triggers[0]);
  assert.equal(history.location.pathname, '/controls', 'Dismissal must not navigate');
  menu = await open(triggers[0]);
  key(menu, 'ArrowDown', 40);
  key(menu, 'Enter', 13);
  await closed(triggers[0]);
  assert.equal(history.location.pathname, '/$/channel/new', 'MenuLink must retain React Router navigation');
  menu = await open(triggers[1]);
  key(menu, 'End', 35);
  key(menu, 'Enter', 13);
  await closed(triggers[1]);
  assert.deepEqual(toggles, [[false, 'dark']], 'A menu action runs exactly once');
  menu = await open(triggers[1]);
  const help = Array.from(menu.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent === 'Help');
  help.click();
  await closed(triggers[1]);
  assert.equal(history.location.pathname, '/$/help');
  await open(triggers[1]);
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  await waitFor(() => triggers[1].getAttribute('aria-expanded') !== 'true', 'Outside click dismisses the menu');
  assert.equal(toggles.length, 1);
  unmount();
  assert(!document.querySelector('[role="menu"]'), 'Menu portals must be cleaned up');
}

async function blockedChannels(store, history) {
  const uris = ['alpha', 'alphabeta', 'café'].map((name, index) => `lbry://@${name}#${String(index + 1).repeat(40)}`);
  store.dispatch({
    type: ACTIONS.RESOLVE_URIS_COMPLETED,
    data: { resolveInfo: Object.fromEntries(uris.map((uri) => [uri, { stream: null, channel: null }])) },
  });
  render(
    <BlockList uris={uris} help="Fixture blocked channels" titleEmptyList="Empty" subtitleEmptyList="No channels" />,
    store,
    history
  );
  await waitFor(() => document.querySelector('[data-reach-combobox-input]'), 'Blocked-channel search must mount');
  const field = document.querySelector('[data-reach-combobox-input]');
  type(field, 'al');
  await waitFor(() => options().length === 2, 'Substring search must find both matching channels');
  assert.deepEqual(
    options().map((node) => node.textContent),
    ['alpha', 'alphabeta']
  );
  key(field, 'ArrowDown', 40);
  await tick();
  assert.equal(document.getElementById(field.getAttribute('aria-activedescendant')).textContent, 'alpha');
  key(field, 'Enter', 13);
  await waitFor(() => field.value === 'alpha', 'Keyboard selection must retain the channel name');
  type(field, 'cafe');
  await waitFor(
    () => options().length === 1 && options()[0].textContent === 'café',
    'Search retains accent-insensitive matching'
  );
  type(field, 'zzzz');
  await waitFor(
    () => document.querySelector('.wunderbar__suggestions').textContent.includes('No results'),
    'No-match search must be empty'
  );
  type(field, '');
  await waitFor(() => !document.querySelector('.wunderbar__suggestions'), 'Clearing search restores the full list');
  unmount();
}

async function searchBar(store, history) {
  const searches = [];
  const remoteSearch = lighthouse.search;
  lighthouse.search = async () => ({ body: [] });
  try {
    history.replace('/controls');
    render(
      <WunderbarSuggestions
        navigateToSearchPage={(term) => searches.push(term)}
        doShowSnackBar={(message) => {
          throw new Error(message);
        }}
        doResolveUris={noop}
        doCloseMobileSearch={noop}
        noTopSuggestion
        showMature={false}
        isMobile={false}
      />,
      store,
      history
    );
    const field = document.querySelector('[data-reach-combobox-input]');
    type(field, 'cats');
    await waitFor(() => options().length === 2, 'Search actions must appear');
    key(field, 'ArrowDown', 40);
    key(field, 'Enter', 13);
    assert.deepEqual(searches, ['cats']);
    type(field, 'dogs');
    await waitFor(() => options().length === 2, 'Search actions must reopen');
    key(field, 'ArrowDown', 40);
    key(field, 'ArrowDown', 40);
    key(field, 'Enter', 13);
    assert.equal(history.location.pathname, '/$/discover');
    assert.equal(new URLSearchParams(history.location.search).get('t'), 'dogs');
    type(field, 'lbry://fixture#1234');
    submit();
    assert.equal(history.location.pathname, '/fixture:1234', 'Typed LBRY links retain claim IDs');
    assert.equal(searches.length, 1, 'Choosing a tag or URI must not submit a duplicate text search');
    unmount();
  } finally {
    lighthouse.search = remoteSearch;
  }
}

async function suggestions(store, history) {
  function Comment() {
    const [value, setValue] = React.useState('');
    const ref = React.useRef();
    return (
      <TextareaWithSuggestions
        id="fixture-comment"
        inputRef={ref}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        doResolveUris={noop}
        doSetMentionSearchResults={noop}
        showMature={false}
      />
    );
  }
  render(<Comment />, store, history);
  const field = document.getElementById('fixture-comment');
  type(field, 'hello :slightly_smiling_face');
  await waitFor(
    () => options().some((node) => node.textContent.includes('slightly_smiling_face')),
    'Comment emoji search must find an exact match'
  );
  const option = options().find((node) => node.textContent.includes('slightly_smiling_face'));
  option.click();
  await waitFor(
    () => field.value === 'hello :slightly_smiling_face: ',
    'Selecting an emoji must preserve surrounding comment text'
  );
  assert.equal(document.activeElement, field);
  assert.equal(field.selectionStart, field.value.length);
  unmount();
}

async function measurement(store, history) {
  const show = (height) =>
    render(
      <Expandable>
        <div style={{ height }}>A resizable comment</div>
      </Expandable>,
      store,
      history
    );
  show(240);
  await waitFor(() => document.querySelector('.expandable__button'), 'Long descriptions need an expand control');
  const button = document.querySelector('.expandable__button');
  assert(document.querySelector('.expandable--closed'));
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  assert.equal(document.querySelector('.expandable__button'), button, 'Clipping must not remove the expand control');
  button.click();
  assert(document.querySelector('.expandable--open'));
  assert.equal(button.textContent, 'Less');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  button.click();
  assert(document.querySelector('.expandable--closed'));
  show(40);
  await waitFor(
    () => !document.querySelector('.expandable__button'),
    'Shrinking content must remove unnecessary controls'
  );
  show(240);
  await waitFor(() => document.querySelector('.expandable__button'), 'Growing content must regain its expand control');
  unmount();
}

export default async function accessibleControls(store, history) {
  await ipcRenderer.invoke('fixture-controls-focus');
  document.documentElement.setAttribute('theme', 'dark');
  await tabs(store, history);
  await menus(store, history);
  await blockedChannels(store, history);
  await searchBar(store, history);
  await suggestions(store, history);
  await measurement(store, history);
  return 'accessible controls: tab focus/underline, menu dismissal/actions/routing, channel search, LBRY links, comment suggestions and measured descriptions';
}
