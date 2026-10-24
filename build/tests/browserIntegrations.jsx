import { strict as assert } from 'assert';
import React from 'react';
import { Route, Routes } from 'react-router';
import { get as getEmoji, search as searchEmojis } from 'node-emoji';
import Lbry from 'lbry';
import { Lbryio } from 'lbryinc';
import SignInVerify from 'page/signInVerify/view';
import Buy from 'page/buy/view';
import EmoteSelector from 'component/commentCreate/emote-selector';
import { EMOTES_48px as EMOTES } from 'constants/emotes';
import image from './fixtures/build-probe.svg';
import { render, unmount, tick, waitFor } from './helpers';

const noop = () => {};
const button = (label) => Array.from(document.querySelectorAll('button')).find((node) => node.textContent === label);

async function emojiCompatibility(store, history) {
  const EMOJI_NAMES = searchEmojis('').map(({ name }) => name);
  const bytes = new TextEncoder().encode(JSON.stringify(EMOJI_NAMES.map((name) => [name, getEmoji(name)])));
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  assert.equal(EMOJI_NAMES.length, 1570);
  // Snapshot of emoji-dictionary 1.0.11: names, order and Unicode bytes.
  assert.equal(digest, '34cd8cd432243bde7b7244bf7bc920775c0698791cf2239417aee027c54e4601');
  const inserted = [];
  let closed = 0;
  const urls = EMOTES.map((emote) => emote.url);
  EMOTES.forEach((emote) => {
    emote.url = image;
  });
  try {
    render(
      <EmoteSelector
        commentValue="hello"
        setCommentValue={(value) => inserted.push(value)}
        closeSelector={() => closed++}
      />,
      store,
      history
    );
    for (const [name, emoji] of [
      ['rocket', '🚀'],
      ['jeans', '👖'],
      ['fire', '🔥'],
      ['heart', '❤️'],
      ['open_mouth', '😮'],
    ]) {
      const choice = document.querySelector(`[title=":${name}:"]`);
      assert.equal(choice.textContent, emoji);
      choice.click();
      assert.equal(inserted[inserted.length - 1], `hello ${emoji} `);
    }
    document.querySelector('.emoteSelector .button--close').click();
    assert.equal(closed, 1);
    document.querySelector(`[title="${EMOTES[0].name.toLowerCase()}"]`).click();
    assert.equal(inserted[inserted.length - 1], `hello ${EMOTES[0].name.toLowerCase()} `);
  } finally {
    unmount();
    EMOTES.forEach((emote, index) => {
      emote.url = urls[index];
    });
  }
}

async function nativeProxy() {
  const fetch = window.fetch;
  const requests = [];
  let reply = { result: { fixture: true } };
  window.fetch = async (url, options) => {
    requests.push({ url, ...JSON.parse(options.body) });
    return { status: 200, json: async () => reply };
  };
  try {
    assert.deepEqual(await Lbry.fixture_proxy_call({ value: 'ł' }), { fixture: true });
    assert.deepEqual(await Lbry.fixture_proxy_call(), { fixture: true });
    assert.deepEqual(
      requests.map(({ method, params }) => ({ method, params })),
      [
        { method: 'fixture_proxy_call', params: { value: 'ł' } },
        { method: 'fixture_proxy_call', params: {} },
      ]
    );
    assert(requests.every((request) => request.jsonrpc === '2.0' && typeof request.id === 'number'));
    assert(requests.every((request) => request.url === Lbry.daemonConnectionString + '?m=fixture_proxy_call'));
    reply = { error: { code: -1, message: 'Fixture rejection' } };
    await assert.rejects(Lbry.fixture_proxy_call(), (error) => error.message === 'Fixture rejection');
    window.fetch = async () => {
      throw new Error('Fixture offline');
    };
    await assert.rejects(Lbry.fixture_proxy_call(), /Fixture offline/);
  } finally {
    window.fetch = fetch;
  }
}

async function verification(store, history) {
  const call = Lbryio.call;
  const captcha = window.grecaptcha;
  const requests = [];
  const notices = [];
  const widgets = [];
  const toast = (notice) => notices.push(notice);
  const url = (extra = {}) =>
    '/$/verify?' +
    new URLSearchParams({
      auth_token: 'fixture-auth',
      email: 'fixture@example.org',
      verification_token: 'fixture-verification',
      needs_recaptcha: 'true',
      ...extra,
    });
  const mount = (extra) => {
    render(
      <Routes>
        <Route path="/$/verify" element={<SignInVerify doToast={toast} />} />
        <Route path="*" element={null} />
      </Routes>,
      store,
      history
    );
    history.replace(url(extra));
  };
  const leave = () => {
    history.replace('/controls');
    unmount();
  };
  Lbryio.call = (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject }));
  try {
    delete window.grecaptcha;
    mount();
    await waitFor(
      () => document.body.textContent.includes('Not seeing a captcha?'),
      'Blocked CAPTCHA script must show recovery guidance'
    );
    assert.equal(requests.length, 0, 'A missing CAPTCHA must never confirm a sign-in');
    leave();
    window.grecaptcha = {
      render: (_element, options) => {
        widgets.push(options);
        return widgets.length - 1;
      },
      reset: noop,
    };
    mount();
    await waitFor(() => widgets.length === 1, 'The upgraded wrapper must render a CAPTCHA');
    assert.equal(widgets[0].sitekey, '6LePsJgUAAAAAFTuWOKRLnyoNKhm0HA4C3elrFMG');
    widgets[0].callback(null);
    assert.equal(requests.length, 0, 'An empty CAPTCHA response must not confirm a sign-in');
    widgets[0].callback('fixture-captcha');
    widgets[0].callback('fixture-captcha');
    assert.equal(requests.length, 1, 'Duplicate callbacks must not submit duplicate confirmations');
    assert.deepEqual(requests[0].args, [
      'user_email',
      'confirm',
      {
        auth_token: 'fixture-auth',
        email: 'fixture@example.org',
        verification_token: 'fixture-verification',
        recaptcha: 'fixture-captcha',
      },
    ]);
    requests[0].resolve();
    await waitFor(() => document.body.textContent.includes('Log in success!'), 'Successful verification must finish');
    widgets[0]['expired-callback']();
    assert.equal(notices.length, 0, 'A completed verification must ignore late widget expiry');
    leave();

    for (const event of ['expired-callback', 'error-callback']) {
      mount();
      await waitFor(
        () => widgets.length >= (event === 'expired-callback' ? 2 : 3),
        'Remount must create a new CAPTCHA'
      );
      widgets[widgets.length - 1][event]();
      await waitFor(() => history.location.pathname === '/$/signup', 'CAPTCHA failure must return to sign-in');
      assert(notices[notices.length - 1].isError);
      assert.equal(requests.length, 1);
      leave();
    }
    mount({ verification_token: '', needs_recaptcha: 'false' });
    await waitFor(() => history.location.pathname === '/$/signup', 'Invalid links must return to sign-in');
    assert.equal(requests.length, 1, 'Invalid links must not contact the confirmation API');
    leave();
    mount({ needs_recaptcha: 'false' });
    await waitFor(() => requests.length === 2, 'A valid non-CAPTCHA link must confirm automatically');
    assert(!('recaptcha' in requests[1].args[2]));
    requests[1].reject(new Error('Fixture rejected'));
    await waitFor(() => history.location.pathname === '/$/signup', 'Server rejection must be recoverable');
    leave();
    mount({ needs_recaptcha: 'false' });
    await waitFor(() => requests.length === 3, 'A new link can retry');
    const before = notices.length;
    leave();
    requests[2].reject(new Error('Late fixture rejection'));
    await tick();
    assert.equal(history.location.pathname, '/controls', 'A late rejection must not navigate away from another page');
    assert.equal(notices.length, before, 'A late rejection must not show a stale error');
    mount({ needs_recaptcha: 'false' });
    await waitFor(() => requests.length === 4, 'A new confirmation must start');
    history.replace(url({ needs_recaptcha: 'false', verification_token: 'replacement-verification' }));
    await waitFor(() => requests.length === 5, 'Replacing the link must start a new confirmation');
    requests[3].resolve();
    await tick();
    assert(
      !document.body.textContent.includes('Log in success!'),
      'The old link must not complete the new verification'
    );
    assert.equal(requests[4].args[2].verification_token, 'replacement-verification');
    requests[4].resolve();
    await waitFor(
      () => document.body.textContent.includes('Log in success!'),
      'The replacement link must finish normally'
    );
  } finally {
    leave();
    Lbryio.call = call;
    if (captcha === undefined) delete window.grecaptcha;
    else window.grecaptcha = captcha;
  }
}

async function savedCountries(store, history) {
  for (const [country, supported] of [
    ['Turkey', true],
    ['Turkiye', true],
    ['Viet Nam', true],
    ['Vietnam', true],
    ['Ceuta, Mulilla', false],
    ['Custom saved country', false],
    ['Poland', true],
  ]) {
    const saved = [];
    try {
      render(
        <Buy
          receiveAddress={null}
          gettingNewAddress
          email=""
          user={{ country }}
          doGetNewAddress={noop}
          doUserSetCountry={(value) => saved.push(value)}
        />,
        store,
        history
      );
      await tick();
      const select = document.querySelector('select');
      assert.equal(select.value, country, 'Existing names must remain selected');
      assert.equal(select.selectedOptions[0].textContent, country);
      assert.equal(Array.from(select.options).filter((option) => option.value === country).length, 1);
      assert.equal(!!button('Continue'), supported);
      assert.equal(!!button('Try Anyway'), !supported);
      assert.deepEqual(saved, [country], 'Mounting must not silently migrate an account country');
      select.value = 'Turkiye';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await tick();
      assert.equal(select.value, 'Turkiye');
      assert(button('Continue'), 'Renamed countries retain the existing provider eligibility');
      assert.equal(saved[saved.length - 1], 'Turkiye');
      assert(!document.querySelector('iframe'), 'Choosing a country must not start a purchase');
    } finally {
      unmount();
    }
  }
}

async function purchases(store, history) {
  const sign = crypto.subtle.sign;
  const pending = [];
  let addresses = 0;
  const countries = [];
  let props = {
    receiveAddress: 'fixture-address-a',
    gettingNewAddress: false,
    email: 'fixture+ł@example.org',
    user: { country: 'Poland' },
    doGetNewAddress: () => addresses++,
    doUserSetCountry: (value) => countries.push(value),
  };
  const draw = (updates = {}) => {
    props = { ...props, ...updates };
    render(<Buy {...props} />, store, history);
  };
  const frame = () => document.querySelector('iframe');
  crypto.subtle.sign = (...args) => new Promise((resolve, reject) => pending.push({ args, resolve, reject }));
  const finish = async (index) => pending[index].resolve(await sign.apply(crypto.subtle, pending[index].args));
  try {
    draw();
    button('Continue').click();
    await waitFor(() => pending.length === 1, 'Purchase must wait for Web Crypto');
    assert(!frame(), 'No unsigned URL may be embedded');
    draw({ receiveAddress: 'fixture-address-b' });
    await waitFor(() => pending.length === 2, 'Address changes require a fresh signature');
    await finish(1);
    await waitFor(() => frame(), 'A signed purchase URL must appear');
    const signedB = frame().src;
    assert.equal(new URL(signedB).searchParams.get('walletAddress'), 'fixture-address-b');
    assert.equal(new URL(signedB).searchParams.get('email'), props.email);
    await finish(0);
    await tick();
    assert.equal(frame().src, signedB, 'An older signature must not replace the new address');
    draw({ receiveAddress: 'fixture-address-c' });
    assert(!frame(), 'Changing address immediately removes the previous purchase destination');
    await waitFor(() => pending.length === 3, 'The new destination must be signed');
    pending[2].reject(new Error('Fixture signing failure'));
    await waitFor(() => document.querySelector('[role="alert"]'), 'Signing failure must show a recoverable error');
    assert(!frame());
    draw({ email: 'changed@example.org' });
    await waitFor(() => pending.length === 4, 'Changing email retries with the current details');
    await finish(3);
    await waitFor(() => frame(), 'A later valid signature must recover');
    assert.equal(new URL(frame().src).searchParams.get('email'), 'changed@example.org');
    assert.equal(addresses, 0);
    assert(countries.every((country) => country === 'Poland'));
    draw({ receiveAddress: 'fixture-address-a' });
    await waitFor(() => pending.length === 5, 'Unmount fixture must begin signing');
    unmount();
    await finish(4);
    await tick();
    assert(!frame(), 'Late signatures after unmount must not create a purchase frame');
  } finally {
    unmount();
    crypto.subtle.sign = sign;
  }
}

export default async function browserIntegrations(store, history) {
  await emojiCompatibility(store, history);
  await nativeProxy();
  await verification(store, history);
  await savedCountries(store, history);
  await purchases(store, history);
  return 'browser integrations: all legacy emoji bytes, quick reactions, native SDK Proxy, CAPTCHA callbacks/errors and asynchronous signed purchase URLs';
}
