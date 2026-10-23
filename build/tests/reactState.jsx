import { strict as assert } from 'assert';
import React from 'react';
import { connect, useSelector } from 'react-redux';
import { Redirect, Route, Switch, useLocation, useParams, withRouter } from 'react-router-dom';
import { push, replace, goBack, goForward } from 'redux-first-history';
import { ipcRenderer } from 'electron';
import ReactModal from 'react-modal';
import NavigationButton from 'component/navigationButton/view';
import ViewImage from 'modal/modalViewImage/view';
import Unlock from 'modal/modalWalletUnlock/view';
import Encrypt from 'modal/modalWalletEncrypt/view';
import Lbry from 'lbry';
import { doWalletEncrypt, doWalletUnlock } from 'redux/actions/wallet';
import { selectWalletUnlockSucceeded } from 'redux/selectors/wallet';
import { getSavedPassword, setSavedPassword, deleteSavedPassword } from 'util/saved-passwords';
import * as ACTIONS from 'constants/action_types';
import { render, unmount, waitFor, tick, input, submit } from './helpers';
import imageUrl from './fixtures/build-probe.svg';
import 'scss/all.scss';

const Navigation = withRouter(NavigationButton);

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
      assert.equal(location, stored, 'Router context and Redux must commit the same location');
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
    'The fixture must use React 18 automatic batching'
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
  const stopBlocking = history.block(() => false);
  const blocked = history.location;
  store.dispatch(push('/blocked'));
  assert.equal(history.location, blocked, 'Blocked navigation must not change Redux');
  stopBlocking();
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
    <Switch>
      <Route path="/redirect">
        <Redirect to="/channel/fixture" />
      </Route>
      <Route path="/channel">
        <Route path="/channel/:id" component={Detail} />
      </Route>
    </Switch>,
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

export default async function reactState(store, history) {
  try {
    await navigation(store, history);
    await fastUnlock(store, history);
    await encryptionCompletion(store, history);
    await lightbox(store, history);
    return 'React 18 batching, Redux/router consistency, history menus/blocking, fast wallet completion/cancellation and lightbox zoom/rotation/focus/error cleanup';
  } finally {
    unmount();
  }
}
