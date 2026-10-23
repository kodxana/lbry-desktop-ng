/* eslint no-console:0 */
const assert = require('assert').strict;
const { load } = require('./testStartup');
const createHistory = load('util/desktop-history.js', {
  history: require('history'),
  'react-router': require('react-router'),
}).default;

const history = createHistory('/@channel:abc/video:def?t=4#comments');
assert.equal(history.index, 0);
assert.equal(history.length, 1);
history.entries[0].title = 'Original video';
assert.equal(history.location.title, undefined, 'Menu titles must not mutate router locations');
const original = history.location;
const state = { collectionId: 'fixture', forceAutoplay: true, hideFloatingPlayer: true };
const updates = [];
const stop = history.listen((update) => {
  assert.equal(history.entries[history.index].key, update.location.key, 'Menus must update before subscribers');
  updates.push(update);
});
history.push({ pathname: '/next', search: '?list=fixture', hash: '#details' }, state);
assert.equal(history.location.state, state, 'Playback state must reach the destination');
assert.equal(history.length, 2);
history.entries[1].title = 'Next video';
history.back();
assert.equal(history.location, original);
assert.equal(history.entries[0].title, 'Original video');
assert.equal(history.location.search, '?t=4');
assert.equal(history.location.hash, '#comments');
history.forward();
assert.equal(history.location.state, state);
assert.equal(history.entries[1].title, 'Next video');
history.replace('/replacement', { from: 'replace' });
assert.equal(history.length, 2);
assert.equal(history.entries[1].title, undefined, 'Replacement must not inherit the previous page title');
assert.equal(history.location.state.from, 'replace');

let pending;
const unblock = history.block((transition) => {
  pending = transition;
});
const before = history.location;
for (const navigate of [() => history.push('/blocked'), () => history.replace('/blocked'), () => history.back()]) {
  navigate();
  assert.equal(history.location, before, 'Declining navigation must preserve the current location');
  assert.equal(history.index, 1);
  assert.equal(history.length, 2);
  assert.equal(history.entries[1].key, before.key);
}
assert.equal(pending.action, 'POP');
unblock();
pending.retry();
assert.equal(history.location, original, 'Accepting a blocked Back must retry the original transition');
history.push('/branch');
assert.equal(history.length, 2, 'Pushing after Back discards the forward branch');
assert.equal(history.entries[0].title, 'Original video');
history.go(100);
assert.equal(history.index, 1);
history.go(-100);
assert.equal(history.index, 0);
history.push('other:123');
assert.equal(history.location.pathname, '/@channel:abc/other:123');
history.replace('../日本語');
assert.equal(history.location.pathname, '/日本語');
history.push('?page=2#results');
assert.equal(history.location.pathname, '/日本語');
assert.equal(history.location.search, '?page=2');
assert.equal(history.location.hash, '#results');
assert.equal(updates.at(-1).action, 'PUSH');
const count = updates.length;
stop();
history.push('/unsubscribed');
assert.equal(updates.length, count);
console.log(
  'PASS: History 5 menu titles/branches, query/hash/playback state, relative paths, listeners and blocked navigation retry'
);
