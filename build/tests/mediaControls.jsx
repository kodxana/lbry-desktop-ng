import 'scss/third-party.scss';
import 'scss/all.scss';
import { strict as assert } from 'assert';
import { ipcRenderer } from 'electron';
import React, { useState } from 'react';
import VideoJs from 'component/viewers/videoViewer/internal/videojs';
import { render, unmount, waitFor, tick } from './helpers';

export default async function mediaControls(store, history, origin) {
  let player;
  let update;
  let ready = 0;
  let cleanup = 0;
  const app = document.getElementById('app');
  const originalStyle = app.getAttribute('style');
  const captions = URL.createObjectURL(
    new Blob(['WEBVTT\n\n00:00.000 --> 00:05.500\nLocal caption fixture\n'], { type: 'text/vtt' })
  );
  function Fixture() {
    const [settings, setSettings] = useState({ autoplay: false, theater: false, compact: false });
    update = setSettings;
    return (
      <VideoJs
        source={origin + '/sample.mp4'}
        sourceType="video/mp4"
        isAudio={false}
        autoplay={false}
        autoplaySetting={settings.autoplay}
        shareTelemetry={false}
        replay={false}
        videoTheaterMode={settings.theater}
        isMarkdownOrComment={settings.compact}
        toggleVideoTheaterMode={() => setSettings((state) => ({ ...state, theater: !state.theater }))}
        toggleAutoplayNext={() => setSettings((state) => ({ ...state, autoplay: !state.autoplay }))}
        playNext={() => {}}
        playPrevious={() => {}}
        tracks={[{ src: captions, kind: 'subtitles', srcLang: 'en', label: 'English' }]}
        onPlayerReady={(media) => {
          player = media;
          player.muted = true;
          player.volume = 0.5;
          ready++;
          return () => cleanup++;
        }}
      />
    );
  }
  const key = (value) => ipcRenderer.invoke('fixture-controls-key', value);
  const select = (node, value) => {
    node.value = value;
    node.dispatchEvent(new Event('change', { bubbles: true }));
  };
  try {
    document.documentElement.setAttribute('theme', 'dark');
    document.documentElement.setAttribute('dir', 'ltr');
    app.style.cssText = 'width:760px;height:428px;margin:40px auto;';
    render(<Fixture />, store, history);
    await waitFor(() => player?.readyState >= 2, 'Control fixture media decodes');
    await ipcRenderer.invoke('fixture-controls-focus');
    const surface = document.querySelector('.lbry-player');
    const controls = document.querySelector('.player-controls');
    assert(controls.hasAttribute('data-visible'), 'Paused controls stay visible');
    assert.equal(getComputedStyle(controls).opacity, '1');
    const autoplay = document.querySelector('.player-autoplay');
    autoplay.click();
    await waitFor(() => autoplay.getAttribute('aria-checked') === 'true', 'Autoplay toggle reflects saved choice');
    document.querySelector('.player-theater').click();
    await waitFor(
      () => document.querySelector('.player-theater').getAttribute('aria-pressed') === 'true',
      'Theater toggle reflects its state'
    );
    assert.equal(ready, 1, 'Updating controls must not recreate the decoder');
    select(document.querySelector('.player-rate'), '1.1');
    await waitFor(() => player.playbackRate === 1.1, 'Retain the custom 1.1x speed');
    document.querySelector('.player-play').click();
    await waitFor(() => !player.paused && player.currentTime > 0.2, 'The play control starts real playback');
    assert(document.querySelector('.player-unmute'), 'Muted playback exposes the unmute prompt');
    document.querySelector('.player-unmute').click();
    await waitFor(() => !player.muted && !document.querySelector('.player-unmute'), 'Unmute updates media and UI');
    document.querySelector('.player-mute').click();
    await waitFor(() => player.muted, 'Mute control uses the native media state');
    document.querySelector('.player-play').click();
    await waitFor(() => player.paused, 'The pause control stops playback');
    document.querySelector('.player-play').focus();
    await key(' ');
    await waitFor(() => !player.paused, 'Space activates a focused Play button exactly once');
    await key('k');
    await waitFor(() => player.paused, 'Letter shortcuts keep working when a player button has focus');
    const volume = document.querySelector('.player-volume [role="slider"]');
    assert(volume, 'Volume exposes a keyboard slider');
    volume.focus();
    await key('ArrowDown');
    await waitFor(() => player.volume < 0.5, 'Volume slider handles keyboard input');
    const seek = document.querySelector('.player-timeline [role="slider"]');
    assert(seek, 'Timeline exposes a keyboard slider');
    seek.focus();
    await key('End');
    await waitFor(() => player.currentTime >= 5.8, 'Timeline keyboard End reaches the media end');
    await key('Home');
    await waitFor(() => player.currentTime < 0.1, 'Timeline keyboard Home returns to the beginning');
    assert(player.paused, 'Scrubbing a paused player must not start playback');
    const rate = document.querySelector('.player-rate');
    rate.focus();
    await key('ArrowDown');
    await waitFor(
      () => player.playbackRate === 1.25,
      'Native select keyboard changes rate without triggering global volume shortcuts'
    );
    await ipcRenderer.invoke('fixture-media-action', 'fullscreen');
    await waitFor(() => document.fullscreenElement === surface, 'Fullscreen targets the complete player and controls');
    // fullscreenElement can change before the fullscreenchange event updates the control.
    await waitFor(
      () => document.querySelector('.player-fullscreen').getAttribute('aria-label') === 'Exit Fullscreen (f)',
      'Fullscreen control reflects the completed entry transition'
    );
    await ipcRenderer.invoke('fixture-media-action', 'fullscreen');
    await waitFor(() => !document.fullscreenElement, 'Fullscreen control exits cleanly');
    await waitFor(
      () => document.querySelector('.player-fullscreen').getAttribute('aria-label') === 'Fullscreen (f)',
      'Fullscreen control returns to its normal state'
    );
    await waitFor(() => document.querySelector('.player-captions'), 'Caption track appears in controls');
    const captionControl = document.querySelector('.player-captions');
    const english = [...captionControl.options].find((option) => option.textContent.includes('English'));
    assert(english, 'Caption language has a readable label');
    select(captionControl, english.value);
    await waitFor(
      () => player.textTracks[0].mode === 'showing' && player.textTracks[0].cues?.length === 1,
      'Caption selection loads and displays actual VTT cues'
    );
    await ipcRenderer.invoke('fixture-media-action', 'capture-captions');
    const off = [...captionControl.options].find((option) => option.value !== english.value);
    select(captionControl, off.value);
    await waitFor(() => player.textTracks[0].mode !== 'showing', 'Captions can be disabled');
    surface.focus();
    for (const theme of ['dark', 'light']) {
      document.documentElement.setAttribute('theme', theme);
      await tick();
      assert.equal(
        getComputedStyle(document.querySelector('.player-play')).color,
        'rgb(219, 216, 216)',
        'Player controls remain readable over video in either app theme'
      );
      await ipcRenderer.invoke('fixture-media-action', 'capture-' + theme);
    }
    app.style.width = '300px';
    app.style.height = '169px';
    await tick();
    assert.equal(getComputedStyle(document.querySelector('.player-volume')).display, 'none');
    assert.equal(getComputedStyle(document.querySelector('.player-theater')).display, 'none');
    assert.equal(getComputedStyle(document.querySelector('.player-rate')).display, 'none');
    assert(controls.scrollWidth <= controls.clientWidth, 'Floating player controls fit without horizontal overflow');
    await ipcRenderer.invoke('fixture-media-action', 'capture-compact');
    update((state) => ({ ...state, compact: true }));
    await waitFor(
      () => !document.querySelector('.player-theater') && !document.querySelector('.player-autoplay'),
      'Embedded controls hide desktop-only actions'
    );
    assert.equal(ready, 1);
  } finally {
    unmount();
    URL.revokeObjectURL(captions);
    if (originalStyle === null) app.removeAttribute('style');
    else app.setAttribute('style', originalStyle);
  }
  assert.equal(cleanup, 1, 'Callbacks are cleaned exactly once');
  assert.equal(window.player, undefined);
  await recovery(store, history, origin);
}

async function recovery(store, history, origin) {
  const defaults = {
    sourceType: 'video/mp4',
    isAudio: false,
    autoplay: false,
    autoplaySetting: false,
    shareTelemetry: false,
    replay: false,
    videoTheaterMode: false,
    toggleVideoTheaterMode: () => {},
    playNext: () => {},
    playPrevious: () => {},
  };
  let player;
  const ready = (media) => {
    player = media;
    media.muted = true;
  };
  const mount = (file, extra = {}) =>
    render(<VideoJs {...defaults} source={origin + '/' + file} onPlayerReady={ready} {...extra} />, store, history);
  const button = (label) =>
    [...document.querySelectorAll('.player-message button')].find((node) => node.textContent === label);
  const fetch = window.fetch;
  let fail = true;
  window.fetch = (...args) => {
    if (fail && args[1]?.method === 'HEAD') {
      fail = false;
      return Promise.reject(new TypeError('Fixture offline'));
    }
    return fetch(...args);
  };
  try {
    mount('sample.mp4');
    await waitFor(() => button('Retry'), 'Failed source detection offers retry');
    assert.equal(player, undefined);
    button('Retry').click();
    await waitFor(() => player?.readyState >= 2, 'Source detection retry recovers playback');
  } finally {
    unmount();
    window.fetch = fetch;
  }
  player = undefined;
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = () =>
    Promise.reject(new DOMException('Fixture autoplay blocked', 'NotAllowedError'));
  try {
    mount('sample.mp4', { autoplay: true });
    await waitFor(() => button('Play'), 'Rejected autoplay offers manual play instead of an unhandled promise');
    HTMLMediaElement.prototype.play = play;
    button('Play').click();
    await waitFor(
      () => player && !player.paused && player.currentTime > 0.1 && !button('Play'),
      'Manual play clears the blocked-autoplay prompt'
    );
  } finally {
    HTMLMediaElement.prototype.play = play;
    unmount();
  }
  player = undefined;
  try {
    mount('retry.mp4');
    await waitFor(() => button('Retry'), 'Decoder load failure offers retry');
    const failed = player;
    button('Retry').click();
    await waitFor(
      () => player && player !== failed && player.readyState >= 2,
      'Retry replaces the failed decoder and loads the same source'
    );
    assert(!failed.isConnected && failed.paused);
    await player.play();
    await waitFor(() => player.currentTime > 0.1, 'Retried media really plays');
  } finally {
    unmount();
  }
}
