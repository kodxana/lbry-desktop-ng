import { strict as assert } from 'assert';
import React from 'react';
import { flushSync } from 'react-dom';
import { ipcRenderer } from 'electron';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'component/common/tabs';
import HeaderMenuButtons from 'component/headerMenuButtons/view';
import CollectionMenuList from 'component/collectionMenuList/view';
import CollectionPreviewTile from 'component/collectionPreviewTile/view';
import Notification from 'component/notification/view';
import { Menu, MenuButton, MenuList, MenuItem } from 'component/common/menu';
import BlockList from 'component/blockList/view';
import WunderbarSuggestions from 'component/wunderbarSuggestions/view';
import TextareaWithSuggestions from 'component/textareaWithSuggestions/view';
import Expandable from 'component/expandable/view';
import Tooltip from 'component/common/tooltip';
import { lighthouse } from 'redux/actions/search';
import * as ACTIONS from 'constants/action_types';
import { render, unmount, tick, waitFor, submit } from './helpers';
import 'scss/third-party.scss';
import 'scss/all.scss';

const key = (node, value, keyCode) =>
  flushSync(() =>
    node.dispatchEvent(new KeyboardEvent('keydown', { key: value, keyCode, bubbles: true, cancelable: true }))
  );
const type = (field, value, cursor = value.length) => {
  field.focus();
  const prototype = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, value);
  field.setSelectionRange(cursor, cursor);
  flushSync(() => field.dispatchEvent(new Event('input', { bubbles: true })));
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
            <TabPanel>
              Content panel
              <input aria-label="Draft" defaultValue="Unsaved channel description" />
            </TabPanel>
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
    await waitFor(() => labels[index].getAttribute('aria-selected') === 'true', `Selected tab must change to ${index}`);
    await waitFor(() => {
      const rect = labels[index].getBoundingClientRect();
      const parent = document.querySelector('.tabs').getBoundingClientRect();
      return (
        Math.abs(parseFloat(indicator.style.width) - rect.width) < 1 &&
        Math.abs(parseFloat(indicator.style.left) - (rect.left - parent.left)) < 1
      );
    }, 'The active underline must follow the selected tab and its size');
    await waitFor(
      () => panels.every((panel, position) => panel.hidden === (position !== index)),
      `Only panel ${index} must be visible`
    );
    panels.forEach((panel, position) => {
      assert.equal(panel.hidden, position !== index);
      assert.equal(panel.getAttribute('aria-labelledby'), labels[position].id);
      assert.equal(labels[position].getAttribute('aria-controls'), panel.id);
      if (position === 1) {
        assert(labels[position].disabled, 'Unavailable tabs must be natively disabled');
      } else {
        assert.equal(
          labels[position].tabIndex,
          position === index ? 0 : -1,
          `Tab stop ${position} with selected tab ${index}`
        );
      }
    });
  };
  await check(0);
  const draft = document.querySelector('[aria-label="Draft"]');
  labels[0].focus();
  labels[1].focus();
  assert.equal(document.activeElement, labels[0], 'Disabled tabs must not take focus');
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
  rename('About');
  await check(3);
  select(0);
  await check(0);
  assert.equal(document.querySelector('[aria-label="Draft"]'), draft, 'Switching tabs must retain the form instance');
  assert.equal(draft.value, 'Unsaved channel description');
  assert.deepEqual(changes, [2, 3, 0, 2]);
  assert.equal(submissions, 0, 'Tab buttons inside channel forms must never submit');
  unmount();

  document.documentElement.dir = 'rtl';
  render(<Editor />, store, history);
  const rtlTabs = Array.from(document.querySelectorAll('[role="tab"]'));
  await waitFor(() => rtlTabs.every((tab) => tab.getAttribute('aria-controls')), 'RTL tab panels must register');
  rtlTabs[0].focus();
  key(rtlTabs[0], 'ArrowLeft', 37);
  await waitFor(() => rtlTabs[2].getAttribute('aria-selected') === 'true', 'RTL arrows must skip disabled tabs');
  unmount();
  document.documentElement.dir = 'ltr';

  const group = () => (
    <Tabs>
      <TabList aria-label="Independent tabs">
        <Tab index={0}>One</Tab>
        <Tab index={1}>Two</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>First</TabPanel>
        <TabPanel>Second</TabPanel>
      </TabPanels>
    </Tabs>
  );
  render(
    <>
      {group()}
      {group()}
    </>,
    store,
    history
  );
  const independent = Array.from(document.querySelectorAll('[role="tab"]'));
  await waitFor(
    () => independent.every((tab) => tab.getAttribute('aria-controls')),
    'Independent panels must register'
  );
  assert.equal(new Set(independent.map((tab) => tab.id)).size, 4, 'Tab groups need distinct accessible IDs');
  independent[1].click();
  await waitFor(() => independent[1].getAttribute('aria-selected') === 'true', 'Uncontrolled tabs must select');
  assert.equal(independent[2].getAttribute('aria-selected'), 'true', 'Changing one group must not change another');
  unmount();
}

async function menus(store, history) {
  const toggles = [];
  history.replace('/controls');
  render(
    <>
      <HeaderMenuButtons
        currentTheme="dark"
        automaticDarkModeEnabled={false}
        handleThemeToggle={(...args) => toggles.push(args)}
      />
      <div id="outside-menu" style={{ position: 'fixed', bottom: 0, right: 0, width: 100, height: 100 }} />
    </>,
    store,
    history
  );
  const triggers = Array.from(document.querySelectorAll('[aria-haspopup="menu"]'));
  assert.equal(triggers.length, 2);
  assert.notEqual(triggers[0].id, triggers[1].id, 'Multiple menus require distinct accessible IDs');
  let opening = 0;
  const open = async (trigger) => {
    opening++;
    const events = [];
    const record = (event) =>
      events.push({
        type: event.type,
        key: event.key,
        target: event.target.id,
        active: document.activeElement && document.activeElement.id,
        expanded: trigger.getAttribute('aria-expanded'),
      });
    for (const type of ['keydown', 'focusin', 'focusout']) document.addEventListener(type, record, true);
    try {
      trigger.focus();
      await ipcRenderer.invoke('fixture-controls-key', 'ArrowDown');
      await waitFor(
        () => trigger.getAttribute('aria-expanded') === 'true',
        `Menu must open from keyboard (open ${opening})`
      );
    } catch (error) {
      throw new Error(`${error.message}; trigger=${trigger.id}; events=${JSON.stringify(events)}`);
    } finally {
      for (const type of ['keydown', 'focusin', 'focusout']) document.removeEventListener(type, record, true);
    }
    let menu;
    await waitFor(
      () => {
        menu = document.querySelector(`[role="menu"][aria-labelledby="${trigger.id}"]`);
        return (
          menu && menu.contains(document.activeElement) && document.activeElement.getAttribute('role') === 'menuitem'
        );
      },
      `Menu ${trigger.getAttribute('aria-label')} receives focus (open ${opening})`
    );
    await Promise.all(menu.getAnimations().map((animation) => animation.finished));
    return menu;
  };
  const closed = async (trigger) => {
    await waitFor(() => trigger.getAttribute('aria-expanded') !== 'true', 'Menu must close');
    await waitFor(() => document.activeElement === trigger, 'Closing returns focus to the trigger');
  };
  let menu = await open(triggers[0]);
  for (const theme of ['dark', 'light']) {
    document.documentElement.setAttribute('theme', theme);
    await Promise.all(menu.getAnimations().map((animation) => animation.finished));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = menu.getBoundingClientRect();
    assert(
      rect.width > 0 && rect.height > 50 && rect.right <= window.innerWidth && rect.left >= 0,
      'Menu must fit within the viewport'
    );
    assert.notEqual(
      getComputedStyle(menu).backgroundColor,
      'rgba(0, 0, 0, 0)',
      'The menu retains its theme background'
    );
    const active = menu.querySelector('[data-active-item]');
    const contrast = document.createElement('span');
    contrast.style.color = 'var(--color-primary-contrast)';
    menu.appendChild(contrast);
    await waitFor(
      () => getComputedStyle(active).color === getComputedStyle(contrast).color,
      'Keyboard selection retains contrast after theme transitions'
    );
    contrast.remove();
    await ipcRenderer.invoke('fixture-controls-capture', theme);
  }
  document.documentElement.setAttribute('theme', 'dark');
  await ipcRenderer.invoke('fixture-controls-key', 'Escape');
  await closed(triggers[0]);
  assert.equal(history.location.pathname, '/controls', 'Dismissal must not navigate');
  menu = await open(triggers[0]);
  await ipcRenderer.invoke('fixture-controls-key', 'ArrowDown');
  await ipcRenderer.invoke('fixture-controls-key', 'Enter');
  await closed(triggers[0]);
  assert.equal(history.location.pathname, '/$/channel/new', 'MenuLink must retain React Router navigation');
  menu = await open(triggers[1]);
  await ipcRenderer.invoke('fixture-controls-key', 'End');
  await ipcRenderer.invoke('fixture-controls-key', 'Enter');
  await closed(triggers[1]);
  assert.deepEqual(toggles, [[false, 'dark']], 'A menu action runs exactly once');
  menu = await open(triggers[1]);
  const help = Array.from(menu.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent === 'Help');
  help.click();
  await closed(triggers[1]);
  assert.equal(history.location.pathname, '/$/help');
  for (let attempt = 0; attempt < 3; attempt++) {
    await open(triggers[0]);
    await ipcRenderer.invoke('fixture-controls-key', 'Escape');
    await closed(triggers[0]);
  }
  await open(triggers[0]);
  const requestFrame = window.requestAnimationFrame;
  const cancelFrame = window.cancelAnimationFrame;
  const deferred = new Map();
  let frameId = 0;
  try {
    // A temporarily unavailable trigger makes focus restoration retry on the next frame.
    triggers[0].disabled = true;
    window.requestAnimationFrame = (callback) => {
      deferred.set(--frameId, callback);
      return frameId;
    };
    window.cancelAnimationFrame = (id) => {
      if (id < 0) deferred.delete(id);
      else cancelFrame.call(window, id);
    };
    key(document.activeElement, 'Escape', 27);
    await waitFor(() => triggers[0].getAttribute('aria-expanded') === 'false', 'Menu closes before delayed focus');
    assert(deferred.size > 0, 'Closing with a disabled trigger must defer focus restoration');
    window.requestAnimationFrame = requestFrame;
    window.cancelAnimationFrame = cancelFrame;
    triggers[0].disabled = false;
    menu = await open(triggers[0]);
    for (const callback of deferred.values()) callback(performance.now());
    await tick();
    assert.equal(
      triggers[0].getAttribute('aria-expanded'),
      'true',
      'An earlier close must not dismiss a reopened menu'
    );
    assert(menu.contains(document.activeElement), 'Delayed close must not steal focus from the reopened menu');
  } finally {
    window.requestAnimationFrame = requestFrame;
    window.cancelAnimationFrame = cancelFrame;
    triggers[0].disabled = false;
  }
  await ipcRenderer.invoke('fixture-controls-key', 'Escape');
  await closed(triggers[0]);
  await open(triggers[1]);
  await ipcRenderer.invoke('fixture-controls-click-outside');
  await waitFor(() => triggers[1].getAttribute('aria-expanded') !== 'true', 'Outside click dismisses the menu');
  assert.equal(toggles.length, 1);
  unmount();
  assert(!document.querySelector('[role="menu"]'), 'Menu portals must be cleaned up');
}

async function nestedMenus(store, history) {
  let cardClicks = 0;
  let disabledClicks = 0;
  let submissions = 0;
  const visits = [];
  const stop = history.listen((location) => visits.push(location.pathname));
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submissions++;
      }}
    >
      <div onClick={() => cardClicks++}>
        <CollectionMenuList
          collectionId="fixture-list"
          collectionName="Fixture"
          doOpenModal={noop}
          doToggleShuffleList={noop}
        />
      </div>
      <Menu>
        <MenuButton>Actions</MenuButton>
        <MenuList className="menu__list">
          <MenuItem disabled onClick={() => disabledClicks++}>
            Unavailable
          </MenuItem>
          <MenuItem onClick={noop}>Enabled</MenuItem>
        </MenuList>
      </Menu>
      <button type="button" id="after-menu">
        Next field
      </button>
    </form>,
    store,
    history
  );
  try {
    const [collection, actions] = document.querySelectorAll('[aria-haspopup="menu"]');
    collection.click();
    await waitFor(() => collection.getAttribute('aria-expanded') === 'true', 'Collection menu must open with a click');
    await waitFor(() => document.querySelector('.menu__popup[data-open] a'), 'The collection link must mount');
    const link = document.querySelector('.menu__popup[data-open] a');
    assert(link);
    assert.equal(
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })),
      false,
      'Nested menu links must not reload the renderer'
    );
    await waitFor(() => collection.getAttribute('aria-expanded') !== 'true', 'Selection dismisses the collection menu');
    assert.deepEqual(visits, ['/$/list/fixture-list']);
    assert.equal(cardClicks, 0, 'Neither opening nor selecting a menu may activate the enclosing card');
    actions.click();
    await waitFor(() => actions.getAttribute('aria-expanded') === 'true', 'Action menu opens');
    await waitFor(
      () => document.activeElement.getAttribute('role') === 'menuitem',
      'The action menu must receive focus before Tab navigation'
    );
    document.querySelector('.menu__popup[data-open] [role="menuitem"][aria-disabled="true"]').click();
    assert.equal(disabledClicks, 0);
    assert.equal(actions.getAttribute('aria-expanded'), 'true');
    await ipcRenderer.invoke('fixture-controls-key', 'Tab');
    await waitFor(() => actions.getAttribute('aria-expanded') !== 'true', 'Tab dismisses the menu');
    await waitFor(() => document.activeElement.id === 'after-menu', 'Tab continues through the form');
    assert.equal(submissions, 0, 'Opening menus must not submit their parent form');
  } finally {
    stop();
    unmount();
  }
}

async function linkedCards(store, history) {
  let reads = 0;
  let deletes = 0;
  history.replace('/controls');
  render(
    <>
      <CollectionPreviewTile
        collectionId="fixture-list"
        collectionName="Fixture"
        collectionCount={0}
        collectionItemUrls={[]}
      />
      <Notification
        notification={{
          notification_rule: 'weekly_watch_reminder',
          is_read: false,
          active_at: '2026-01-01T00:00:00Z',
          notification_parameters: {
            device: { title: 'Fixture reminder', text: 'Fixture text', target: 'lbry://fixture#1234' },
          },
        }}
        readNotification={() => reads++}
        deleteNotification={() => deletes++}
      />
    </>,
    store,
    history
  );
  const triggers = Array.from(document.querySelectorAll('[aria-haspopup="menu"]'));
  assert.equal(triggers.length, 2);
  for (const trigger of triggers) {
    assert.equal(trigger.closest('a'), null, 'A menu button must not activate an enclosing navigation link');
    trigger.click();
    await waitFor(() => trigger.getAttribute('aria-expanded') === 'true', 'Card menu opens');
    await waitFor(
      () => document.querySelector(`[role="menu"][aria-labelledby="${trigger.id}"]`)?.contains(document.activeElement),
      'Card menu receives focus'
    );
    assert.equal(history.location.pathname, '/controls');
    await ipcRenderer.invoke('fixture-controls-key', 'Escape');
    await waitFor(() => trigger.getAttribute('aria-expanded') === 'false', 'Card menu dismisses');
  }
  triggers[1].click();
  await waitFor(
    () => document.querySelector('.menu__popup[data-open] [role="menuitem"]'),
    'Notification actions appear'
  );
  document.querySelector('.menu__popup[data-open] [role="menuitem"]').click();
  assert.equal(deletes, 1);
  assert.equal(reads, 0, 'Opening and deleting a notification must not activate its content link');
  assert.equal(history.location.pathname, '/controls');
  unmount();
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
  await waitFor(() => document.querySelector('input[role="combobox"]'), 'Blocked-channel search must mount');
  const field = document.querySelector('input[role="combobox"]');
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
    const field = document.querySelector('input[role="combobox"]');
    type(field, 'cats');
    await waitFor(() => options().length === 2, 'Search actions must appear');
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, isComposing: true, bubbles: true, cancelable: true })
    );
    assert.equal(searches.length, 0, 'Confirming composed text must not select a search action');
    await ipcRenderer.invoke('fixture-controls-key', 'Home');
    await waitFor(() => field.selectionStart === 0, 'Home moves the text caret');
    await ipcRenderer.invoke('fixture-controls-key', 'End');
    await waitFor(() => field.selectionStart === 4, 'End moves the text caret');
    await ipcRenderer.invoke('fixture-controls-key', 'ArrowDown');
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, isComposing: true, bubbles: true, cancelable: true })
    );
    assert.equal(searches.length, 0, 'Composing text must not select the highlighted action');
    await ipcRenderer.invoke('fixture-controls-key', 'Enter');
    assert.deepEqual(searches, ['cats']);
    field.focus();
    await waitFor(() => options().length === 2, 'Focusing search reopens suggestions');
    options()[0].click();
    assert.deepEqual(searches, ['cats', 'cats'], 'The same search can be selected again, once per click');
    type(field, 'dogs');
    await waitFor(() => options().length === 2, 'Search actions must reopen');
    await ipcRenderer.invoke('fixture-controls-key', 'ArrowDown');
    await ipcRenderer.invoke('fixture-controls-key', 'ArrowDown');
    await ipcRenderer.invoke('fixture-controls-key', 'Enter');
    assert.equal(history.location.pathname, '/$/discover');
    assert.equal(new URLSearchParams(history.location.search).get('t'), 'dogs');
    type(field, 'lbry://fixture#1234');
    submit();
    assert.equal(history.location.pathname, '/fixture:1234', 'Typed LBRY links retain claim IDs');
    assert.equal(searches.length, 2, 'Choosing a tag or URI must not submit a duplicate text search');
    type(field, 'clear me');
    await ipcRenderer.invoke('fixture-controls-key', 'Escape');
    await waitFor(
      () => field.value === '' && field.getAttribute('aria-expanded') === 'false',
      'Escape clears search state and closes suggestions'
    );
    await ipcRenderer.invoke('fixture-controls-key', 'Escape');
    assert.notEqual(document.activeElement, field, 'Escape on an empty search moves focus away');
    unmount();
  } finally {
    lighthouse.search = remoteSearch;
  }
}

async function suggestions(store, history) {
  const uri = 'lbry://@fixture#' + 'a'.repeat(40);
  const channel = {
    claim_id: 'a'.repeat(40),
    name: '@fixture',
    value_type: 'channel',
    value: { title: 'Fixture channel' },
    canonical_url: uri,
    permanent_url: uri,
    meta: { claims_in_channel: 0 },
  };
  store.dispatch({ type: ACTIONS.RESOLVE_URIS_COMPLETED, data: { resolveInfo: { [uri]: { channel, stream: null } } } });
  const focus = [];
  let setDisabled;
  function Comment() {
    const [value, setValue] = React.useState('');
    const [disabled, updateDisabled] = React.useState(false);
    setDisabled = updateDisabled;
    const ref = React.useRef();
    return (
      <TextareaWithSuggestions
        id="fixture-comment"
        canonicalCreatorUri={uri}
        inputRef={ref}
        isLivestream
        maxLength={500}
        disabled={disabled}
        placeholder="Write a comment"
        className="fixture-comment-input"
        onFocus={() => focus.push('focus')}
        onBlur={() => focus.push('blur')}
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
  assert.equal(field.tagName, 'TEXTAREA');
  assert.equal(field.maxLength, 500);
  assert.equal(field.placeholder, 'Write a comment');
  assert(field.classList.contains('fixture-comment-input'));
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
  await waitFor(() => !field.hasAttribute('term'), 'Selecting an emoji must release the livestream send guard');
  const highlighted = () => {
    const active = document.getElementById(field.getAttribute('aria-activedescendant'));
    return (
      field.getAttribute('aria-expanded') === 'true' && active && active.textContent.includes('slightly_smiling_face')
    );
  };
  type(field, 'before :slightly_smiling_face after', 'before :slightly_smiling_face'.length);
  await waitFor(highlighted, 'Keyboard suggestions must highlight a current match after filtering');
  key(field, 'Enter', 13);
  await waitFor(() => field.value === 'before :slightly_smiling_face: after', 'Enter preserves text after the cursor');
  assert.equal(field.selectionStart, 'before :slightly_smiling_face: '.length);
  type(field, ':slightly_smiling_face');
  await waitFor(highlighted, 'Tab suggestions must highlight a current match');
  field.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, which: 229, isComposing: true, bubbles: true })
  );
  assert.equal(field.value, ':slightly_smiling_face', 'IME composition must not select a suggestion');
  await tick();
  assert.equal(key(field, 'Tab', 9), false, 'Selecting with Tab must prevent moving focus');
  await waitFor(() => field.value === ':slightly_smiling_face: ', 'Tab inserts the highlighted emoji');
  type(field, 'hello :grin');
  await waitFor(
    () => options().filter((node) => node.textContent.includes('grin')).length > 1,
    'Arrow navigation needs multiple matches'
  );
  key(field, 'ArrowDown', 40);
  const selected = document.getElementById(field.getAttribute('aria-activedescendant'));
  const label = selected.querySelector('.textareaSuggestion__value').textContent;
  key(field, 'Enter', 13);
  await waitFor(() => field.value === 'hello ' + label + ' ', 'Enter must respect the option chosen with arrow keys');
  type(field, ':slightly_smiling_face');
  await waitFor(highlighted, 'Escape suggestions must highlight a current match');
  key(field, 'Escape', 27);
  await waitFor(() => field.getAttribute('aria-expanded') === 'false', 'Escape dismisses suggestions');
  assert.equal(field.value, ':slightly_smiling_face', 'Dismissal must not insert a suggestion');
  assert.equal(key(field, 'Tab', 9), true, 'Tab must navigate normally when suggestions are dismissed');
  type(field, ':no_such_emoji_12345');
  await tick();
  key(field, 'Enter', 13);
  assert.equal(field.value, ':no_such_emoji_12345', 'Free text must not be treated as a selected option');
  type(field, 'hello @fi');
  await waitFor(
    () => options().some((node) => node.textContent.includes('Fixture channel')),
    'Known channel mentions must appear'
  );
  key(field, 'ArrowDown', 40);
  key(field, 'Enter', 13);
  await waitFor(
    () => field.value === 'hello @fixture:' + 'a'.repeat(40) + ' ',
    'Mention selection must retain its claim ID'
  );
  type(field, 'plain\nmultiline comment');
  assert.equal(field.value, 'plain\nmultiline comment');
  field.blur();
  assert.deepEqual(focus, ['focus', 'blur']);
  setDisabled(true);
  await waitFor(() => field.disabled, 'Disabled suggestions must stop accepting input');
  unmount();
  assert(!document.querySelector('[role="listbox"]'), 'Suggestion portals must be cleaned up');
}

async function tooltips(store, history) {
  render(
    <Tooltip title="Back up your wallet">
      <button>Backup</button>
    </Tooltip>,
    store,
    history
  );
  const button = document.querySelector('#app button');
  button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  assert(!document.querySelector('[role="tooltip"]'), 'Tooltips respect their hover delay');
  await waitFor(() => document.querySelector('[role="tooltip"]'), 'Hover must show the tooltip');
  assert.equal(document.querySelector('[role="tooltip"]').textContent, 'Back up your wallet');
  assert(document.querySelector('.MuiTooltip-arrow'));
  key(button, 'Escape', 27);
  await waitFor(() => !document.querySelector('[role="tooltip"]'), 'Escape dismisses the tooltip');
  button.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  button.focus();
  await waitFor(() => document.querySelector('[role="tooltip"]'), 'Keyboard focus must show the tooltip');
  button.blur();
  await waitFor(() => !document.querySelector('[role="tooltip"]'), 'Blur dismisses the tooltip');
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
  await waitFor(() => document.querySelector('.expandable--open'), 'Expand must reveal the comment');
  assert.equal(button.textContent, 'Less');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  button.click();
  await waitFor(() => document.querySelector('.expandable--closed'), 'Collapse must clip the comment');
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
  document.documentElement.setAttribute('dir', 'ltr');
  await tabs(store, history);
  await menus(store, history);
  await nestedMenus(store, history);
  await linkedCards(store, history);
  await blockedChannels(store, history);
  await searchBar(store, history);
  await suggestions(store, history);
  await tooltips(store, history);
  await measurement(store, history);
  return 'accessible controls: tabs, menus, search, LBRY links, emoji mouse/Enter/Tab/Escape, input refs/props, multiline/free text, tooltip hover/focus/dismissal and measured descriptions';
}
