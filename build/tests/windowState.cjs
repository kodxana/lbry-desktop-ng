/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { app, BrowserWindow, screen } = require('electron');
const windowStateKeeper = require('electron-window-state');

module.exports = async () => {
  const file = path.join(app.getPath('userData'), 'window-state.json');
  const defaults = { defaultWidth: 1000, defaultHeight: 600 };
  const bounds = (state) => ({ x: state.x, y: state.y, width: state.width, height: state.height });
  const primary = { x: 0, y: 0, width: 1920, height: 1080 };
  const secondary = { x: -1920, y: 0, width: 1920, height: 1080 };
  // The persisted v4 shape, including a monitor left of the primary display.
  const legacy = {
    x: -1800,
    y: 80,
    width: 1000,
    height: 700,
    isMaximized: false,
    isFullScreen: false,
    displayBounds: secondary,
  };
  const write = (state) => fs.writeFileSync(file, JSON.stringify(state));
  const getAllDisplays = screen.getAllDisplays;
  const getPrimaryDisplay = screen.getPrimaryDisplay;
  try {
    screen.getPrimaryDisplay = () => ({ bounds: primary });
    screen.getAllDisplays = () => [{ bounds: primary }, { bounds: secondary }];
    write(legacy);
    assert.deepEqual(bounds(windowStateKeeper(defaults)), bounds(legacy));
    assert.deepEqual(JSON.parse(fs.readFileSync(file)), legacy, 'Loading must not rewrite the old settings');
    screen.getAllDisplays = () => [{ bounds: primary }];
    for (const state of [legacy, { ...legacy, x: 1800, y: 80, displayBounds: primary }]) {
      write(state);
      assert.deepEqual(
        bounds(windowStateKeeper(defaults)),
        { x: 0, y: 0, width: 1000, height: 600 },
        'Missing displays and partially off-screen windows must recover to visible defaults'
      );
    }
    for (const mode of ['isMaximized', 'isFullScreen']) {
      write({ ...legacy, x: 80, displayBounds: primary, [mode]: true });
      const state = windowStateKeeper(defaults);
      const calls = [];
      const window = Object.assign(new EventEmitter(), {
        maximize: () => calls.push('maximize'),
        setFullScreen: (value) => calls.push(['fullscreen', value]),
        getBounds: () => primary,
        isMaximized: () => mode === 'isMaximized',
        isFullScreen: () => mode === 'isFullScreen',
        isMinimized: () => false,
      });
      state.manage(window);
      assert.deepEqual(calls, mode === 'isMaximized' ? ['maximize'] : [['fullscreen', true]]);
      window.emit('close');
      window.emit('closed');
      assert.equal(window.eventNames().length, 0, 'Closed windows must release state listeners');
      const restored = windowStateKeeper(defaults);
      assert.equal(restored[mode], true);
      assert.deepEqual(
        bounds(restored),
        { x: 80, y: 80, width: 1000, height: 700 },
        'Maximized and fullscreen bounds must not replace the normal window size'
      );
    }
  } finally {
    screen.getAllDisplays = getAllDisplays;
    screen.getPrimaryDisplay = getPrimaryDisplay;
  }
  for (const invalid of ['{broken', 'null', '{"x":0,"y":0,"width":-1,"height":600}']) {
    fs.writeFileSync(file, invalid);
    const state = windowStateKeeper(defaults);
    assert.equal(state.width, 1000);
    assert.equal(state.height, 600);
    assert.equal(state.x, undefined);
  }
  const blocked = path.join(app.getPath('userData'), 'blocked-window-state');
  fs.writeFileSync(blocked, 'preserve this file');
  assert.doesNotThrow(() => windowStateKeeper({ ...defaults, path: blocked }).saveState());
  assert.equal(fs.readFileSync(blocked, 'utf8'), 'preserve this file');

  const area = screen.getPrimaryDisplay().workArea;
  const initial = {
    x: area.x + 16,
    y: area.y + 16,
    width: Math.min(1000, area.width - 32),
    height: Math.min(600, area.height - 32),
  };
  write({ ...initial, isMaximized: false, isFullScreen: false, displayBounds: screen.getPrimaryDisplay().bounds });
  const state = windowStateKeeper(defaults);
  const window = new BrowserWindow({ ...bounds(state), show: false });
  try {
    state.manage(window);
    assert.deepEqual(window.getBounds(), initial);
    window.setBounds({ ...initial, x: initial.x + 8, width: initial.width - 16 });
    const moved = window.getBounds();
    await new Promise((resolve) => {
      window.once('closed', resolve);
      window.close();
    });
    const reopened = windowStateKeeper(defaults);
    assert.deepEqual(bounds(reopened), moved, 'Native close must save the latest bounds before the debounce fires');
    assert.equal(reopened.isMaximized, false);
    assert.equal(reopened.isFullScreen, false);
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
  console.log(
    'PASS: legacy window state, display removal, off-screen recovery, fullscreen/maximized bounds, corrupt/write-failed settings and native close/reopen'
  );
};
