import { strict as assert } from 'assert';
import React from 'react';
import { flushSync } from 'react-dom';
import moment from 'moment';
import WalletSend from 'component/walletSend/view';
import ConfirmTransaction from 'modal/modalConfirmTransaction/view';
import PublishReleaseDate from 'component/publishReleaseDate/view';
import DateTime from 'component/dateTime/view';
import BlockChannel from 'modal/modalBlockChannel/view';
import ListBlocked from 'page/listBlocked/view';
import formatMediaDuration from 'util/formatMediaDuration';
import formControls from './formControls';
import * as ACTIONS from 'constants/action_types';
import * as MODALS from 'constants/modal_types';
import { render, unmount, tick, waitFor, input, submit } from './helpers';
import 'scss/third-party.scss';
import 'scss/all.scss';

const noop = () => {};
const button = (label) => Array.from(document.querySelectorAll('button')).find((node) => node.textContent === label);
const change = (field, value) => {
  assert(field, 'Missing input');
  const prototype = field.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, value);
  flushSync(() => field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })));
};

async function walletSend(store, history, uri) {
  // Synthetic address and callbacks: these tests never submit a transaction to an SDK.
  const address = 'b' + 'a'.repeat(33);
  const modals = [];
  const sends = [];
  let props = {
    draftTransaction: { address: '', amount: '' },
    balance: 10,
    isAddress: true,
    contentUri: uri,
    contentClaim: undefined,
    contentError: '',
    confirmed: false,
    sendLabel: 'Send',
    setSendLabel: noop,
    setConfirmed: noop,
    openModal: (id, values) => modals.push({ id, values }),
    setDraftTransaction: (draftTransaction) => draw({ draftTransaction }),
    setIsAddress: (isAddress) => draw({ isAddress }),
    setEnteredContentUri: (contentUri) => draw({ contentUri }),
  };
  const draw = (updates = {}) => {
    props = { ...props, ...updates };
    render(<WalletSend {...props} />, store, history);
  };
  const reject = async (message) => {
    assert(button('Send').disabled, message);
    const before = modals.length;
    submit(); // Also check form submission, which can bypass a disabled button.
    await tick();
    assert.equal(modals.length, before, message);
  };
  draw();
  await reject('Empty draft must not open confirmation');
  input('address', address);
  for (const amount of ['0', '-1', '10', '11', '']) {
    input('amount', amount);
    await reject('Invalid or unaffordable amount: ' + amount);
  }
  input('amount', '0.00000001');
  input('address', 'not-an-address');
  await reject('Invalid address must not open confirmation');
  input('address', address);
  draw({ balance: undefined });
  await reject('Unknown balance must not permit spending');
  draw({ balance: 10, sendLabel: 'Sending...' });
  submit();
  await tick();
  assert.equal(modals.length, 0, 'An in-flight send cannot open another confirmation');
  draw({ sendLabel: 'Send' });
  assert(!button('Send').disabled);
  button('Send').click();
  await waitFor(() => modals.length === 1, 'Send did not open confirmation');
  assert.equal(modals[0].id, MODALS.CONFIRM_TRANSACTION);
  assert.equal(modals[0].values.amount, '0.00000001', 'Keep the exact amount string through confirmation');
  assert.equal(modals[0].values.destination, address);
  assert.equal(modals[0].values.isAddress, true);
  const confirm = (values) => {
    unmount();
    render(
      <ConfirmTransaction
        {...values}
        incognito
        claim={{ claim_id: 'fixture-tip' }}
        closeModal={unmount}
        sendToAddress={(...args) => sends.push(['address', ...args])}
        sendTip={(...args) => sends.push(['tip', ...args])}
      />,
      store,
      history
    );
  };
  confirm(modals[0].values);
  assert.equal(sends.length, 0, 'Opening confirmation must not send funds');
  button('Cancel').click();
  assert.equal(sends.length, 0, 'Cancellation must not send funds');
  draw();
  assert.equal(document.getElementById('amount').value, '0.00000001');
  // Retry twice on the same mounted Formik instance after a cancelled confirmation.
  submit();
  await waitFor(() => modals.length === 2, 'Cancelled confirmation must allow retry');
  submit();
  await waitFor(() => modals.length === 3, 'Formik must finish its synchronous submit cycle');
  confirm(modals[2].values);
  button('Send').click();
  assert.deepEqual(sends, [['address', address, '0.00000001']]);
  draw();
  button('Search').click();
  await reject('Unresolved recipient must not open confirmation');
  draw({ contentClaim: { claim_id: 'fixture-tip' } });
  input('amount', '1.25000000');
  submit();
  await waitFor(() => modals.length === 4, 'Resolved content recipient must open confirmation');
  assert.equal(modals[3].values.destination, uri);
  assert.equal(modals[3].values.isAddress, false);
  confirm(modals[3].values);
  submit();
  assert.deepEqual(sends[1], ['tip', { amount: '1.25000000', claim_id: 'fixture-tip' }, false]);
  unmount();
}

async function publishDate(store, history) {
  const changes = [];
  const original = new Date(2024, 1, 28, 23, 45);
  const stamp = (date) => Math.round(date.getTime() / 1000);
  // eslint-disable-next-line react/prop-types
  function Editor({ existing }) {
    const [edited, setEdited] = React.useState();
    return (
      <PublishReleaseDate
        releaseTime={existing}
        releaseTimeEdited={edited}
        updatePublishForm={({ releaseTimeEdited }) => {
          changes.push(releaseTimeEdited);
          setEdited(releaseTimeEdited);
        }}
      />
    );
  }
  const field = (label) => document.querySelector('[aria-label="' + label + '"]');
  render(<Editor existing={stamp(original)} />, store, history);
  await waitFor(() => field('Year').value === '2024', 'Date inputs did not initialize');
  assert.equal(field('Month').value, '2');
  assert.equal(field('Day').value, '28');
  assert.equal(field('Hour').value, '11');
  assert.equal(field('AM/PM').value, 'pm');
  change(field('Day'), '29');
  await waitFor(() => changes.length === 1, 'Leap-day input did not update the publish draft');
  assert.equal(changes[0], stamp(new Date(2024, 1, 29, 23, 45)), 'Local date/time must become Unix seconds');
  // The picker's prop-sync effect follows the draft callback.
  await tick();
  change(field('Minute'), '30');
  await waitFor(() => changes.length === 2, 'Minute input did not update the publish draft');
  assert.equal(changes[1], stamp(new Date(2024, 1, 29, 23, 30)));
  button('Reset').click();
  assert.equal(changes[2], undefined);
  await waitFor(() => field('Day').value === '28', 'Reset did not restore the original date');
  assert.equal(field('Minute').value, '45');
  field('Choose release date').click();
  await waitFor(() => document.querySelector('.react-calendar'), 'Calendar did not open');
  assert(document.querySelector('.react-calendar.form-field-calendar'), 'Calendar must retain the app theme class');
  const calendar = document.querySelector('.react-calendar');
  assert.equal(getComputedStyle(document.querySelector('.react-datetime-picker__wrapper')).display, 'flex');
  assert.equal(getComputedStyle(calendar).backgroundColor, 'rgb(31, 31, 34)', 'Keep the desktop dark calendar theme');
  const day = Array.from(calendar.querySelectorAll('button.react-calendar__tile')).find(
    (node) => node.textContent === '27'
  );
  day.click();
  await waitFor(() => changes.length === 4, 'Calendar selection did not update the publish draft');
  assert.equal(changes[3], stamp(new Date(2024, 1, 27, 23, 45)), 'Calendar selection must preserve the time');
  const beforeNow = Math.floor(Date.now() / 1000);
  button('Now').click();
  assert(changes[4] >= beforeNow && changes[4] <= Math.ceil(Date.now() / 1000));
  const count = changes.length;
  change(field('Year'), String(new Date().getFullYear() + 1));
  await tick();
  assert.equal(changes.length, count, 'A future release date must not enter the draft');
  unmount();
  render(<Editor />, store, history);
  assert(!document.querySelector('.react-datetime-picker'));
  button('Edit').click();
  await waitFor(() => document.querySelector('.react-datetime-picker'), 'Editing must show the date picker');
  assert(Number.isInteger(changes[changes.length - 1]));
  button('Default').click();
  assert.equal(changes[changes.length - 1], undefined);
  await waitFor(() => !document.querySelector('.react-datetime-picker'), 'Default must hide the date picker');
  unmount();
}

async function durations(store, history, uri) {
  const blocks = [];
  render(
    <BlockChannel
      commenterUri={uri}
      contentClaim={{ is_my_output: true }}
      moderationDelegatorsById={{}}
      closeModal={noop}
      commentModBlock={(...args) => blocks.push(args)}
      commentModBlockAsAdmin={assert.fail}
      commentModBlockAsModerator={assert.fail}
    />,
    store,
    history
  );
  await tick();
  document.getElementById('timeout').click();
  await waitFor(() => document.getElementById('time_out'), 'Timeout input did not appear');
  for (const [value, seconds] of [
    ['30s', 30],
    ['10m', 600],
    ['1h 30m', 5400],
    ['2d', 172800],
    ['3mo', 7889400],
    ['1y', 31557600],
  ]) {
    input('time_out', value);
    await tick();
    assert(!button('Block').disabled, value);
    button('Block').click();
    assert.deepEqual(blocks[blocks.length - 1], [uri, seconds]);
  }
  const count = blocks.length;
  for (const value of ['', 'nonsense', '0s', '-1s', '0.5s', '101y']) {
    input('time_out', value);
    await tick();
    assert(button('Block').disabled, 'Reject timeout: ' + value);
    button('Block').click();
    assert.equal(blocks.length, count);
  }
  document.getElementById('permanent').click();
  await waitFor(() => !document.getElementById('time_out'), 'Permanent blocking must clear the timeout input');
  button('Block').click();
  assert.deepEqual(blocks[blocks.length - 1], [uri, undefined], 'Permanent blocking has no timeout');
  unmount();
  store.dispatch({
    type: ACTIONS.RESOLVE_URIS_COMPLETED,
    data: {
      resolveInfo: {
        [uri]: {
          channel: {
            claim_id: '123',
            name: '@form-fixture',
            permanent_url: uri,
            canonical_url: uri,
            value_type: 'channel',
            value: {},
            meta: { claims_in_channel: 0 },
          },
        },
      },
    },
  });
  render(
    <ListBlocked
      personalBlockList={[uri]}
      personalTimeoutMap={{
        [uri]: { blockedAt: '2024-02-29T12:30:00', bannedFor: 5400000000000, banRemaining: 30000000000 },
      }}
      moderatorBlockListDelegatorsMap={{}}
      delegatorsById={{}}
      fetchModBlockedList={noop}
      fetchModAmIList={noop}
    />,
    store,
    history
  );
  await waitFor(() => document.querySelector('blockquote'), 'Timed block information did not render');
  const text = document.querySelector('blockquote').textContent;
  assert(text.includes('February 29th, 2024 @ 12:30'));
  assert(text.includes('1 hour, 30 minutes'));
  assert(text.includes('30 seconds'));
  unmount();
}

async function dateFormatting(store, history) {
  const date = new Date(2024, 1, 29, 23, 5);
  render(<DateTime date={date} show={DateTime.SHOW_DATE} />, store, history);
  assert.equal(document.querySelector('.date_time').textContent, 'February 29th, 2024');
  render(<DateTime date={date} show={DateTime.SHOW_TIME} />, store, history);
  assert.equal(document.querySelector('.date_time').textContent, '11:05 PM');
  render(<DateTime date={date} show={DateTime.SHOW_TIME} clock24h />, store, history);
  assert.equal(document.querySelector('.date_time').textContent, '23:05');
  assert.equal(DateTime.getTimeAgoStr(new Date(Date.now() - 90000)), '1 minute ago');
  for (const [seconds, normal, spoken] of [
    [0, '00:00', '00:00:00'],
    [65, '01:05', '00:01:05'],
    [3661, '01:01:01', '01:01:01'],
  ]) {
    assert.equal(formatMediaDuration(seconds), normal);
    assert.equal(formatMediaDuration(seconds, { screenReader: true }), spoken);
  }
  const locale = 'pl';
  await import('moment/locale/' + locale);
  moment.locale(locale);
  unmount();
  render(<DateTime date={date} show={DateTime.SHOW_DATE} />, store, history);
  assert.equal(document.querySelector('.date_time').textContent, 'luty 29., 2024');
  moment.locale('en');
  unmount();
}

export default async function formsAndDates(store, history) {
  const uri = 'lbry://@form-fixture#123';
  store.dispatch({
    type: ACTIONS.RESOLVE_URIS_COMPLETED,
    data: { resolveInfo: { [uri]: { stream: null, channel: null } } },
  });
  document.documentElement.setAttribute('theme', 'dark');
  document.documentElement.setAttribute('dir', 'ltr');
  try {
    await formControls(store, history);
    await walletSend(store, history, uri);
    await publishDate(store, history);
    await durations(store, history, uri);
    await dateFormatting(store, history);
    return 'shared form focus/checkboxes/textarea/submit/disabled state, price precision/currency/clearing, wallet send validation/confirmation/retry, publish dates, timed blocks, localized dates and media duration';
  } finally {
    moment.locale('en');
    unmount();
  }
}
