// @flow
import { strict as assert } from 'assert';
import React from 'react';
import { connect, useSelector } from 'react-redux';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import { withDesktopRouter } from 'component/common/desktop-router';
import { push, replace, goBack, goForward } from 'redux-first-history';
import { ipcRenderer } from 'electron';
import ReactModal from 'react-modal';
import NavigationButton from 'component/navigationButton/view';
import Button from 'component/button/view';
import CollectionActions from 'component/collectionActions/view';
import { AppRoutes } from 'component/router/view';
import usePersistedState from 'effects/use-persisted-state';
import { WELCOME_VERSION } from 'config';
import ViewImage from 'modal/modalViewImage/view';
import Unlock from 'modal/modalWalletUnlock/view';
import Encrypt from 'modal/modalWalletEncrypt/view';
import ErrorBoundary from 'component/errorBoundary/view';
import TruncatedText from 'component/common/truncated-text';
import analytics from 'analytics';
import Native from 'native';
import Lbry from 'lbry';
import { doWalletEncrypt, doWalletUnlock } from 'redux/actions/wallet';
import { selectWalletUnlockSucceeded } from 'redux/selectors/wallet';
import { getSavedPassword, setSavedPassword, deleteSavedPassword } from 'util/saved-passwords';
import * as ACTIONS from 'constants/action_types';
import { render, unmount, waitFor, tick, input, submit } from './helpers';
import imageUrl from './fixtures/build-probe.svg';
import 'scss/all.scss';

const Navigation = withDesktopRouter(NavigationButton);

async function navigation(store, history) {
  const commits = [];
  let batch;
  function Location() {
    const location = useLocation();
    const stored = useSelector((state) => state.router.location);
    const [first, setFirst] = React.useState(0);
    const [second, setSecond] = React.useState(0);
    batch = () =>
      Promise.resolve().then(() => {
        setFirst(1);
        setSecond(2);
      });
    React.useLayoutEffect(() => {
      for (const key of ['pathname', 'search', 'hash', 'key']) {
        assert.equal(location[key], stored[key], `Router and Redux must commit the same ${key}`);
      }
      assert.deepEqual(location.state, stored.state ?? null, 'Navigation state must stay consistent');
      commits.push([first, second]);
    });
    return (
      <output>
        {location.pathname}:{first}:{second}
      </output>
    );
  }
  history.replace('/first?tab=history#details', { from: 'fixture' });
  const initialIndex = history.index;
  history.entries[initialIndex].title = 'First page';
  render(
    <>
      <Location />
      <Navigation isBackward />
      <Navigation isBackward={false} />
    </>,
    store,
    history
  );
  await batch();
  await waitFor(() => document.querySelector('output').textContent.endsWith(':1:2'), 'Promise updates must render');
  assert.deepEqual(
    commits,
    [
      [0, 0],
      [1, 2],
    ],
    'The fixture must use automatic batching'
  );
  store.dispatch(push('/second'));
  await waitFor(() => document.querySelector('output').textContent.startsWith('/second:'), 'Redux push must render');
  assert.equal(history.index, initialIndex + 1);
  assert.equal(history.entries[initialIndex].title, 'First page');
  const back = document.querySelector('.header__navigation-item--back');
  assert(!back.disabled);
  back.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  await waitFor(() => document.querySelector('.header__navigation-dropdown'), 'History menu must open');
  const entry = Array.from(document.querySelectorAll('.header__navigation-button')).find((node) =>
    node.textContent.includes('First page')
  );
  assert(entry, 'The history menu must retain page titles');
  entry.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await waitFor(() => history.index === initialIndex, 'History menu must navigate to its selected entry');
  assert.equal(history.location.search, '?tab=history');
  assert.equal(history.location.hash, '#details');
  assert.deepEqual(history.location.state, { from: 'fixture' });
  store.dispatch(goForward());
  assert.equal(history.location.pathname, '/second');
  const length = history.length;
  store.dispatch(replace('/replacement'));
  assert.equal(history.length, length, 'Replace must not append to the back stack');
  store.dispatch(goBack());
  assert.equal(history.location.pathname, '/first');
  let pendingNavigation;
  const stopBlocking = history.block((transition) => {
    pendingNavigation = transition;
  });
  const blocked = history.location;
  store.dispatch(push('/blocked'));
  assert.equal(history.location, blocked, 'Blocked navigation must not change Redux');
  assert.equal(pendingNavigation.location.pathname, '/blocked');
  stopBlocking();
  pendingNavigation.retry();
  assert.equal(history.location.pathname, '/blocked', 'Accepted navigation must retry through Redux');
  let visits = 0;
  const stop = history.listen(() => visits++);
  history.push('/after-block');
  stop();
  history.push('/after-unsubscribe');
  assert.equal(visits, 1);
  await tick();
  unmount();
  const count = commits.length;
  history.push('/unmounted');
  await tick();
  assert.equal(commits.length, count, 'Unmounted route components must unsubscribe');
  assert.equal(store.getState().router.location, history.location);

  function Detail() {
    const { id } = useParams();
    return <output>{id}</output>;
  }
  history.replace('/redirect');
  render(
    <Routes>
      <Route path="/redirect" element={<Navigate replace to="/channel/fixture" />} />
      <Route path="/channel">
        <Route path=":id" element={<Detail />} />
      </Route>
    </Routes>,
    store,
    history
  );
  await waitFor(
    () => document.querySelector('output')?.textContent === 'fixture',
    'Mount redirects and nested params must render'
  );
  assert.equal(history.location.pathname, '/channel/fixture');
  unmount();
}

async function links(store, history) {
  history.replace('/$/wallet?tab=history#details');
  render(
    <>
      <Button id="wallet-nav" navigate="/$/wallet" label="Wallet" activeClass="selected-wallet" />
      <Button id="content-nav" navigate="lbry://@fixture#abc/video#def" label="Content" />
      <Link id="state-nav" to="/$/backup?from=wallet#export" state={{ from: 'wallet' }}>
        Backup
      </Link>
      <Link id="cancel-nav" to="/$/send" onClick={(event) => event.preventDefault()}>
        Stay here
      </Link>
      <Link id="query-nav" to="?tab=transactions" relative="path">
        Transactions
      </Link>
    </>,
    store,
    history
  );
  assert(document.getElementById('wallet-nav').classList.contains('selected-wallet'));
  assert.equal(document.getElementById('wallet-nav').getAttribute('aria-current'), 'page');
  document.getElementById('state-nav').click();
  await waitFor(() => history.location.pathname === '/$/backup', 'Link must use the Redux history');
  assert.equal(history.location.search, '?from=wallet');
  assert.equal(history.location.hash, '#export');
  assert.deepEqual(history.location.state, { from: 'wallet' });
  document.getElementById('cancel-nav').click();
  await tick();
  assert.equal(history.location.pathname, '/$/backup', 'A prevented click must not navigate');
  // Prevent native browser navigation after React handles this modified click.
  // Button stops propagation at React's root, so document would not see the event.
  document.getElementById('app').addEventListener('click', (event) => event.preventDefault(), { once: true });
  const modifiedClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
  document.getElementById('wallet-nav').dispatchEvent(modifiedClick);
  assert(modifiedClick.defaultPrevented, 'The fixture must suppress native navigation after testing React');
  await tick();
  assert.equal(history.location.pathname, '/$/backup', 'Modified clicks must not change the current page');
  document.getElementById('query-nav').click();
  await waitFor(() => history.location.search === '?tab=transactions', 'Query-only links must retain the pathname');
  assert.equal(history.location.pathname, '/$/backup');
  document.getElementById('content-nav').click();
  await waitFor(
    () => history.location.pathname === '/@fixture:abc/video:def',
    'LBRY links must keep channel and claim IDs'
  );
  history.push('/$/wallet/child');
  await tick();
  assert(
    !document.getElementById('wallet-nav').classList.contains('selected-wallet'),
    'Navigation buttons must match exactly'
  );
  unmount();

  const length = history.length;
  render(<Navigate replace to="/$/wallet?tab=history#details" state={{ from: 'redirect' }} />, store, history);
  await waitFor(() => history.location.pathname === '/$/wallet', 'Mount redirects must navigate');
  assert.equal(history.length, length, 'Redirects must replace the current entry');
  assert.equal(history.location.search, '?tab=history');
  assert.equal(history.location.hash, '#details');
  assert.deepEqual(history.location.state, { from: 'redirect' });
  unmount();
}

async function discoveryNavigation(store, history) {
  const first = '/$/fixture-category-one';
  const second = '/$/fixture-category-two';
  const key = (pathname) => `fixture-order-${pathname}`;
  localStorage.setItem(key(first), 'new');
  localStorage.setItem(key(second), 'top');
  function Discovery({ location }: { location: { pathname: string } }) {
    const [order, setOrder] = usePersistedState(key(location.pathname), 'trending');
    return (
      <button id="discovery-order" onClick={() => setOrder('edited')}>
        {order}
      </button>
    );
  }
  function Fixture() {
    const location = useLocation();
    const routes = AppRoutes({
      location,
      welcomeVersion: WELCOME_VERSION,
      dynamicRoutes: [{ route: first }, { route: second }],
    });
    // Use the production route tree and element identity, with a small page body
    // that exercises the same persisted-state hook as discovery sorting.
    return React.cloneElement(
      routes,
      {},
      React.Children.map(routes.props.children, (route) => {
        const element = route?.props.element;
        if (!element?.props.dynamicRouteProps) return route;
        return React.cloneElement(route, {
          element: React.createElement(Discovery, { ...element.props, key: element.key }),
        });
      })
    );
  }
  try {
    history.replace(first);
    render(<Fixture />, store, history);
    assert.equal(document.getElementById('discovery-order').textContent, 'new');
    document.getElementById('discovery-order').click();
    await waitFor(() => localStorage.getItem(key(first)) === 'edited', 'Category sorting must save');
    history.push(second);
    await tick();
    assert.equal(
      document.getElementById('discovery-order').textContent,
      'top',
      'Categories must load their own saved sort order'
    );
    assert.equal(localStorage.getItem(key(second)), 'top', 'Navigation must not overwrite another category preference');
    history.goBack();
    await tick();
    assert.equal(document.getElementById('discovery-order').textContent, 'edited');
    history.push('?page=2');
    await tick();
    assert.equal(document.getElementById('discovery-order').textContent, 'edited');
  } finally {
    unmount();
    localStorage.removeItem(key(first));
    localStorage.removeItem(key(second));
  }
}

async function collectionPlayback(store, history) {
  const shuffle = [];
  render(
    <CollectionActions
      collectionId="fixture-list"
      isBuiltin
      firstItem="lbry://first:abc"
      playNextUri="lbry://next:def"
      doToggleShuffleList={(...args) => shuffle.push(args)}
    />,
    store,
    history
  );
  document.querySelector('button[title="Play"]').click();
  await waitFor(() => history.location.pathname === '/first:abc', 'Collection Play must navigate');
  assert.equal(history.location.state.forceAutoplay, true, 'Collection Play must retain autoplay state');
  assert(history.location.search.includes('fixture-list'), 'Collection Play must retain the list query');
  document.querySelector('button[title="Shuffle Play"]').click();
  await waitFor(() => history.location.pathname === '/next:def', 'Shuffle must navigate to the chosen item');
  assert.equal(history.location.state.forceAutoplay, true, 'Shuffle must retain autoplay state');
  assert.deepEqual(shuffle, [
    ['fixture-list', false],
    ['fixture-list', true],
  ]);
  unmount();
}

async function fastUnlock(store, history) {
  const ConnectedUnlock = connect((state) => ({ walletUnlockSucceded: selectWalletUnlockSucceeded(state) }))(Unlock);
  let closed = 0;
  const calls = [];
  const original = Lbry.wallet_unlock;
  try {
    await setSavedPassword('fixture-batched-unlock', false);
    store.dispatch({ type: ACTIONS.WALLET_UNLOCK_COMPLETED, result: true });
    Lbry.wallet_unlock = async (params) => {
      calls.push(params);
      return true;
    };
    render(
      <ConnectedUnlock
        unlockWallet={(password) => store.dispatch(doWalletUnlock(password))}
        closeModal={() => closed++}
        quit={() => assert.fail('Unexpected quit')}
      />,
      store,
      history
    );
    await waitFor(() => closed === 1, 'A fast saved-password unlock must close even after a previous success');
    assert.deepEqual(calls, [{ password: 'fixture-batched-unlock' }]);
    assert.equal(await getSavedPassword(), 'fixture-batched-unlock');
    unmount();
    await deleteSavedPassword();
    let settle;
    Lbry.wallet_unlock = () =>
      new Promise((resolve) => {
        settle = resolve;
      });
    render(
      <ConnectedUnlock
        unlockWallet={(password) => store.dispatch(doWalletUnlock(password))}
        closeModal={() => closed++}
        quit={() => assert.fail('Unexpected quit')}
      />,
      store,
      history
    );
    input('wallet-password', 'fixture-late-unlock');
    submit();
    unmount();
    settle(true);
    await tick();
    assert.equal(closed, 1, 'Leaving a pending unlock must not close a later modal');
    assert.equal(await getSavedPassword(), null, 'Leaving a pending unlock must not save its password');
  } finally {
    unmount();
    delete Lbry.wallet_unlock;
    assert.equal(typeof original, 'function');
    await deleteSavedPassword();
  }
}

async function encryptionCompletion(store, history) {
  let closed = 0;
  let refreshed = 0;
  let calls = 0;
  const show = () => {
    render(
      <Encrypt
        encryptWallet={(password) => store.dispatch(doWalletEncrypt(password))}
        closeModal={() => closed++}
        updateWalletStatus={() => refreshed++}
      />,
      store,
      history
    );
    input('wallet-new-password', 'fixture-batched-encryption');
    input('wallet-new-password-confirm', 'fixture-batched-encryption');
    input('wallet-understand', 'I Understand');
  };
  const original = Lbry.wallet_encrypt;
  try {
    store.dispatch({ type: ACTIONS.WALLET_ENCRYPT_COMPLETED, result: true });
    Lbry.wallet_encrypt = async () => {
      calls++;
      return true;
    };
    show();
    submit();
    submit();
    await waitFor(() => closed === 1, 'Fast encryption must finish independently of a previous success');
    assert.equal(calls, 1, 'Repeated submissions must not encrypt twice');
    assert.equal(refreshed, 1);
    assert.equal(await getSavedPassword(), 'fixture-batched-encryption');
    unmount();
    await deleteSavedPassword();

    let settle;
    Lbry.wallet_encrypt = () =>
      new Promise((resolve) => {
        settle = resolve;
      });
    show();
    submit();
    unmount();
    settle(true);
    await tick();
    assert.equal(closed, 1, 'Leaving a pending encryption must not close a later modal');
    assert.equal(await getSavedPassword(), null, 'Leaving a pending encryption must not save its password');
  } finally {
    unmount();
    delete Lbry.wallet_encrypt;
    assert.equal(typeof original, 'function');
    await deleteSavedPassword();
  }
}

async function lightbox(store, history) {
  await ipcRenderer.invoke('fixture-controls-focus');
  ReactModal.setAppElement(document.getElementById('app'));
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  let closed = 0;
  const show = (src) =>
    render(
      <ViewImage
        src={src}
        title="Fixture image"
        closeModal={() => {
          closed++;
          unmount();
        }}
      />,
      store,
      history
    );
  const button = (label) => document.querySelector(`.lb-root button[aria-label="${label}"]`);
  const key = (key) => ipcRenderer.invoke('fixture-controls-key', key);
  show(imageUrl);
  await waitFor(() => document.querySelector('.lb-img')?.naturalWidth > 0, 'Lightbox must decode the image');
  const root = document.querySelector('.lb-root');
  assert(root.closest('.modal--image'), 'Keep the image inside the application modal focus boundary');
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
  assert.equal(document.getElementById('app').getAttribute('aria-hidden'), 'true');
  assert.equal(getComputedStyle(root.closest('.modal')).backdropFilter, 'none');
  const initial = document.querySelector('.lb-img').style.transform;
  button('Zoom in').click();
  await waitFor(
    () => document.querySelector('.lb-img').style.transform !== initial,
    'Zoom must change the rendered image'
  );
  button('Rotate right').click();
  await waitFor(
    () => document.querySelector('.lb-img').style.transform.includes('rotate(90deg)'),
    'Rotation must work'
  );
  await key('Escape');
  await waitFor(
    () => document.querySelector('.lb-img').style.transform === initial,
    'Escape resets an image transformation first'
  );
  assert.equal(closed, 0);
  button('Close').focus();
  await key('Tab');
  assert(root.contains(document.activeElement), 'Keyboard focus must remain in the viewer');
  await key('Escape');
  await waitFor(() => closed === 1, 'Escape must close the reset viewer once');
  assert.equal(document.activeElement, opener);
  assert(!document.body.classList.contains('lb-open'));
  assert(!document.getElementById('app').hasAttribute('aria-hidden'));
  show('data:image/png;base64,bm90IGFuIGltYWdl');
  await waitFor(() => document.querySelector('.lb-error'), 'A broken image must report its error');
  button('Close').click();
  await waitFor(() => closed === 2, 'A failed image must remain dismissible');
  opener.remove();
}

async function renderingCompatibility(store, history) {
  render(
    <>
      <TruncatedText text="A long title" lines={2} />
      <TruncatedText text="No tooltip" lines={1} showTooltip={false} />
    </>,
    store,
    history
  );
  const titles = document.querySelectorAll('.truncated-text');
  assert.equal(titles[0].title, 'A long title', 'Omitted tooltip preference must retain the default');
  assert.equal(titles[0].style.webkitLineClamp, '2');
  assert.equal(titles[1].title, '', 'Explicitly disabling tooltips must still work');
  unmount();

  const originalVersion = Native.getAppVersionInfo;
  const originalSdkVersion = Lbry.version;
  const originalError = analytics.error;
  const reports = [];
  let broken = true;
  function Page() {
    if (broken) throw new Error('Fixture render failure');
    return <output>Recovered page</output>;
  }
  try {
    Native.getAppVersionInfo = async () => ({ localVersion: 'fixture-desktop' });
    Lbry.version = async () => ({ lbrynet_version: 'fixture-sdk' });
    analytics.error = async (message) => {
      reports.push(message);
      return false;
    };
    history.replace('/broken');
    render(
      <ErrorBoundary>
        <Page />
      </ErrorBoundary>,
      store,
      history
    );
    await waitFor(() => reports.length === 1, 'Caught rendering errors must reach the existing diagnostic handler');
    assert(reports[0].includes('Fixture render failure'));
    assert(reports[0].includes('fixture-desktop'));
    assert(reports[0].includes('fixture-sdk'));
    assert(document.querySelector('.error__text').textContent.includes('not reported'));
    broken = false;
    document.querySelector('.load-screen__button').click();
    await waitFor(
      () => document.querySelector('output')?.textContent === 'Recovered page',
      'Error fallback must recover'
    );
    assert.equal(history.location.pathname, '/', 'Error recovery must return home');
    assert.equal(reports.length, 1, 'Recovery must not duplicate the diagnostic report');
  } finally {
    unmount();
    Native.getAppVersionInfo = originalVersion;
    Lbry.version = originalSdkVersion;
    analytics.error = originalError;
  }
}

export default async function reactState(store, history) {
  try {
    assert.match(React.version, /^19\./, 'Exercise the upgraded React runtime');
    await renderingCompatibility(store, history);
    await navigation(store, history);
    await links(store, history);
    await collectionPlayback(store, history);
    await discoveryNavigation(store, history);
    await fastUnlock(store, history);
    await encryptionCompletion(store, history);
    await lightbox(store, history);
    return 'React 19 defaults/error recovery/batching, Redux/router consistency, history menus/blocking, fast wallet completion/cancellation and lightbox zoom/rotation/focus/error cleanup';
  } finally {
    unmount();
  }
}
