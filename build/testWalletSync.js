/* eslint no-console:0, react/prop-types:0 */
const assert = require('assert').strict;
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { load } = require('./testStartup');

module.exports = async function walletSyncTests() {
  const sync = load('util/wallet-sync.js', {});
  const history = { state: 'syncing', connected: true, entries_completed: 100, entries_total: 250, pending_operations: 1 };
  const status = { wallet: { available_servers: 1, headers_synchronization_progress: 100, history_sync: history } };
  const { walletSyncProgress } = sync;
  assert(walletSyncProgress(status).pending, '100% headers does not complete account history');
  assert(walletSyncProgress(status).count.includes('100 of 250'));
  for (const entries_completed of [-1, 251, NaN, '100']) {
    const invalid = { wallet: { ...status.wallet, history_sync: { ...history, entries_completed } } };
    assert.equal(walletSyncProgress(invalid).count, null);
    assert(walletSyncProgress(invalid).pending);
  }
  assert(walletSyncProgress(null).pending);
  assert(walletSyncProgress({ wallet: {} }).pending, 'Older SDK responses are unknown, not complete');
  history.state = 'incomplete';
  assert.equal(walletSyncProgress(status).title, 'Wallet history sync incomplete');
  history.state = 'complete';
  history.pending_operations = 0;
  history.entries_completed = 250;
  assert(!walletSyncProgress(status).pending);
  history.connected = false;
  assert(walletSyncProgress(status).pending, 'Last completed history does not make a disconnected wallet current');
  history.connected = true;
  status.wallet.headers_synchronization_progress = 75;
  status.wallet.blocks_behind = 0;
  assert(walletSyncProgress(status).pending);
  status.wallet.headers_synchronization_progress = 100;

  const Notice = load('component/walletSyncNotice/view.jsx', { react: React, 'util/wallet-sync': sync }).default;
  assert.equal(render(React.createElement(Notice, { status })), '');
  history.state = 'syncing';
  history.pending_operations = 1;
  history.entries_completed = 100;
  const markup = render(React.createElement(Notice, { status }));
  assert(markup.includes('role="status"'));
  assert(markup.includes('Syncing transaction history'));
  assert(markup.includes('100 of 250 known history entries saved'));
  assert(markup.includes('Your balance may change'));
  assert(!markup.includes('<progress'), 'A growing total must not be displayed as an overall percentage');

  const text = props => React.createElement('span', null, props.children || props.label || props.postfix);
  const WalletBalance = load('component/walletBalance/view.jsx', {
    react: React,
    'constants/icons': {},
    'constants/modal_types': {},
    'constants/pages': {},
    'component/common/credit-amount': text,
    'component/button': text,
    'component/common/help-link': text,
    'component/common/lbc-symbol': text,
    'component/i18nMessage': text,
    'component/common/card': props => React.createElement('section', null, props.title, props.subtitle, props.actions),
    'util/format-credits': { formatCredits: String },
    'component/walletSyncNotice/view': Notice,
    'util/wallet-sync': sync,
  }).default;
  const cardProps = { balance: 10, tipsBalance: 0, supportsBalance: 0, claimsBalance: 0, syncStatus: status };
  const card = render(React.createElement(WalletBalance, cardProps));
  assert(card.includes('Syncing transaction history') && !card.includes('Your total balance.'));

  const headerDependencies = {
    react: React,
classnames: require('classnames'),
    'effects/use-screensize': { useIsMobile: () => false },
    'react-router': { withRouter: component => component },
    'constants/icons': {},
'constants/pages': { WALLET: 'wallet' },
    '@electron/remote': {},
'component/app/view': { IS_MAC: false },
    'component/button': text,
    'component/common/tooltip': props => React.createElement('div', { title: props.title }, props.children),
    'util/wallet-sync': sync,
  };
  for (const component of ['headerMenuButtons', 'headerProfileMenuButton', 'logo', 'notificationBubble',
    'skipNavigationButton', 'wunderbar', 'navigationButton']) headerDependencies['component/' + component] = () => null;
  const Header = load('component/header/view.jsx', headerDependencies).default;
  const headerProps = { history: { location: { pathname: '/' } },
walletSyncStatus: status,
    roundedBalance: '123.45',
roundedSpendableBalance: '123.45',
balance: 123.45 };
  const header = render(React.createElement(Header, headerProps));
  assert(header.includes('Wallet sync') && !header.includes('123.45'));

  const WalletPage = load('page/wallet/view.jsx', {
    react: React,
    'react-router': { useHistory: () => ({ location: { search: '' } }) },
    'component/txoList': () => null,
    'component/page': props => props.children,
    'component/walletBalance': () => React.createElement('div', null, 'wallet balance card'),
    'component/spinner': () => null,
    'component/yrblWalletEmpty': () => React.createElement('div', null, 'empty wallet introduction'),
    'component/walletSyncNotice/view': Notice,
    'util/wallet-sync': sync,
  }).default;
  let page = render(React.createElement(WalletPage, { totalBalance: 0, syncStatus: status }));
  assert(page.includes('wallet balance card') && !page.includes('empty wallet introduction'));
  history.state = 'complete';
  page = render(React.createElement(WalletPage, { totalBalance: 0, syncStatus: status }));
  assert(page.includes('empty wallet introduction'));
  assert(render(React.createElement(WalletBalance, cardProps)).includes('Your total balance.'));
  assert(render(React.createElement(Header, headerProps)).includes('123.45'));
  assert(!render(React.createElement(Header, { ...headerProps, hideBalance: true })).includes('>123.45<'));

  let order = [];
  let failStatus = false;
  let failBalance = false;
  const balance = { available: '10', total: '10', reserved: '0', reserved_subtotals: { claims: '0', supports: '0', tips: '0' } };
  const sdk = {
    status: async () => { order.push('status'); if (failStatus) throw Error('offline'); return status },
    wallet_balance: async () => { order.push('balance'); if (failBalance) throw Error('locked'); return balance },
  };
  const dependencies = {
    'constants/action_types': { UPDATE_BALANCE: 'balance', WALLET_SYNC_STATUS_UNAVAILABLE: 'unavailable' },
    lbry: sdk,
    lbryinc: {},
    'redux/actions/notifications': {},
    'redux/selectors/wallet': {},
    'util/format-credits': {},
    'redux/selectors/claims': {},
    'redux/actions/claims': {},
    'util/wallet-sync': sync,
  };
  const { doUpdateBalance } = load('redux/actions/wallet.js', dependencies);
  const actions = [];
  const dispatch = action => actions.push(action);
  const first = doUpdateBalance()(dispatch);
  const second = doUpdateBalance()(dispatch);
  assert.equal(first, second, 'Concurrent polls share one status and balance request');
  await first;
  assert.deepEqual(order, ['status', 'balance']);
  assert.equal(actions.length, 1);
  history.state = 'syncing';
  await doUpdateBalance()(dispatch);
  assert.equal(actions.length, 2, 'History progress updates even when the total balance is unchanged');
  assert(walletSyncProgress(actions[1].data.syncStatus).pending);
  failStatus = true;
  await doUpdateBalance()(dispatch);
  assert.equal(actions[2].data.syncStatus, null, 'A failed status read must not retain completed status');
  assert.equal(actions[2].data.totalBalance, 10);
  failBalance = true;
  await doUpdateBalance()(dispatch);
  assert.equal(actions[3].type, 'unavailable');
  console.log('PASS: history progress, incomplete/disconnected states, provisional zero balance and fresh balance polling');
};
