import { strict as assert } from 'assert';
import React from 'react';
import { ipcRenderer } from 'electron';
import videojs from 'video.js';
import VideoJs from 'component/viewers/videoViewer/internal/videojs';
import LbryVolumeBar from 'component/viewers/videoViewer/internal/lbry-volume-bar';
import hlsQualitySelector from 'component/viewers/videoViewer/internal/plugins/videojs-hls-quality-selector/plugin';
import { addTheaterModeButton } from 'component/viewers/videoViewer/internal/theater-mode';
import { addAutoplayNextButton } from 'component/viewers/videoViewer/internal/autoplay-next';
import { addPlayNextButton } from 'component/viewers/videoViewer/internal/play-next';
import { addPlayPreviousButton } from 'component/viewers/videoViewer/internal/play-previous';
import { render, unmount, waitFor } from './helpers';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function lateQualityMenu() {
  const element = document.createElement('video');
  document.getElementById('app').appendChild(element);
  const player = videojs(element, { controls: true });
  try {
    await new Promise((resolve) => player.ready(resolve));
    for (const height of [32, 64]) {
      player
        .qualityLevels()
        .addQualityLevel({ id: String(height), height, bitrate: height * 1000, enabled: () => true });
    }
    hlsQualitySelector.call(player, {});
    await waitFor(() => typeof player.hlsQualitySelector === 'object', 'Late quality selector did not initialize');
    assert.deepEqual(
      player.controlBar.getChild('QualityButton').items.map((item) => item.item.value),
      [32, 64, 'auto'],
      'Quality levels loaded before plugin initialization must populate the menu'
    );
  } finally {
    player.dispose();
  }
}

async function lifecycle(store, history, origin) {
  const players = [];
  let next = 0;
  const mount = (file, isAudio = false) =>
    render(
      <VideoJs
        source={origin + '/' + file}
        sourceType={isAudio ? 'audio/mp4' : 'video/mp4'}
        isAudio={isAudio}
        autoplay={false}
        autoplaySetting={false}
        shareTelemetry={false}
        replay={false}
        videoTheaterMode={false}
        toggleVideoTheaterMode={() => {}}
        playNext={() => next++}
        playPrevious={() => {}}
        onPlayerReady={(player) => {
          player.muted(true);
          players.push(player);
        }}
      />,
      store,
      history
    );
  const playNext = () => window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 78, shiftKey: true }));
  try {
    mount('sample.mp4');
    await waitFor(() => players.length === 1, 'First source did not initialize');
    mount('audio.m4a', true);
    await waitFor(() => players.length === 2, 'Replacement source did not initialize');
    assert(players[0].isDisposed(), 'A source change must dispose the old player');
    assert.equal(window.player, players[1]);
    assert.equal(
      document.querySelectorAll('[data-vjs-player]').length,
      1,
      'A source change must remove the old wrapper'
    );
    playNext();
    assert.equal(next, 1, 'A source change must not duplicate keyboard shortcuts');
  } finally {
    unmount();
  }
  playNext();
  assert.equal(next, 1, 'Unmount must remove keyboard shortcuts');
  assert(players.every((player) => player.isDisposed()));

  const originalFetch = window.fetch;
  const release = [];
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (args[1] && args[1].method === 'HEAD') await new Promise((resolve) => release.push(resolve));
    return response;
  };
  try {
    mount('sample.mp4');
    await waitFor(() => release.length === 2, 'The source checks did not start');
    unmount();
    release.forEach((resolve) => resolve());
    await delay(100);
    assert.equal(players.length, 2, 'Late source detection must not initialize an unmounted player');
    assert.equal(window.player, undefined);
    assert.equal(Object.values(videojs.getPlayers()).filter(Boolean).length, 0);
  } finally {
    release.forEach((resolve) => resolve());
    window.fetch = originalFetch;
    unmount();
  }
}

export default async function media(store, history) {
  await lateQualityMenu();
  assert.equal(videojs.VERSION, '8.24.1');
  const { origin } = await ipcRenderer.invoke('fixture-media');
  for (const [file, type, audio] of [
    ['sample.mp4', 'video/mp4', false],
    ['redirect.mp4', 'video/mp4', false],
    ['master.m3u8', 'application/x-mpegURL', false],
    ['audio.m4a', 'audio/mp4', true],
  ]) {
    let player;
    let element;
    const calls = { next: 0, previous: 0, theater: 0, autoplay: 0, firstplay: 0, seek: 0 };
    const called = (name) => () => calls[name]++;
    render(
      <VideoJs
        source={origin + '/' + file}
        sourceType={type}
        isAudio={audio}
        autoplay={false}
        autoplaySetting={false}
        shareTelemetry={false}
        replay={false}
        videoTheaterMode={false}
        toggleVideoTheaterMode={called('theater')}
        playNext={called('next')}
        playPrevious={called('previous')}
        onPlayerReady={(ready, node) => {
          player = ready;
          element = node;
          player.muted(true);
          addTheaterModeButton(player, called('theater'));
          addAutoplayNextButton(player, called('autoplay'), false);
          addPlayNextButton(player, called('next'));
          addPlayPreviousButton(player, called('previous'));
          player.on('tracking:firstplay', called('firstplay'));
          player.on('tracking:seek', called('seek'));
        }}
      />,
      store,
      history
    );
    const loaded = (predicate, message) =>
      waitFor(() => {
        assert(!player || !player.error(), file + ': ' + JSON.stringify(player && player.error()));
        return player && predicate();
      }, file + ': ' + message);
    try {
      await loaded(() => element.readyState >= 2, 'media did not decode');
      assert(Math.abs(player.duration() - 6) < 0.2, 'Read the actual fixture duration');
      if (!audio) {
        assert([32, 64].includes(element.videoHeight));
        assert.equal(element.videoWidth / element.videoHeight, 1.5);
      }
      if (file === 'redirect.mp4' || file === 'master.m3u8') {
        assert(element.currentSrc.startsWith('blob:'), 'HLS must use the real MediaSource playback path');
      }
      const controls = player.getChild('ControlBar');
      const volumeControl = controls.getChild('VolumePanel').getChild('VolumeControl');
      assert(
        volumeControl.children().some((child) => child instanceof LbryVolumeBar),
        'Use the custom volume bar'
      );
      for (const [name, call] of [
        ['TheaterModeButton', 'theater'],
        ['PlayNextButton', 'next'],
        ['PlayPreviousButton', 'previous'],
        ['AutoplayNextButton', 'autoplay'],
      ]) {
        const button = controls.getChild(name).el();
        assert(button.getAttribute('title') || button.getAttribute('aria-label'), 'Controls must retain their labels');
        button.click();
        assert.equal(calls[call], 1, name + ' must invoke its action once');
      }
      assert.equal(controls.getChild('AutoplayNextButton').el().getAttribute('aria-checked'), 'false');
      if (file === 'master.m3u8') {
        await loaded(() => player.qualityLevels().length === 2, 'master playlist did not expose both qualities');
        const selector = player.hlsQualitySelector;
        const button = controls.getChild('QualityButton');
        assert(!button.hasClass('vjs-hidden'));
        assert.deepEqual(
          button.items.map((item) => item.item.value),
          [32, 64, 'auto']
        );
        const vhs = player.tech({ IWillNotUseThisInPlugins: true }).vhs;
        for (const height of [32, 64, 'auto']) {
          const item = button.items.find((entry) => entry.item.value === height);
          item.el().click();
          assert.equal(selector.getCurrentQuality(), height);
          assert.equal(item.el().getAttribute('aria-checked'), 'true');
          for (const representation of vhs.representations()) {
            assert.equal(representation.enabled(), height === 'auto' || representation.height === height);
          }
        }
      } else if (file !== 'redirect.mp4') {
        assert(controls.getChild('QualityButton').hasClass('vjs-hidden'), 'MP4/audio must not show HLS choices');
      }
      await player.play();
      await loaded(() => player.currentTime() > 0.25, 'playback did not advance');
      assert.equal(calls.firstplay, 1, 'The tracking plugin must share the production Video.js instance');
      if (!audio) assert(element.getVideoPlaybackQuality().totalVideoFrames > 0, 'Chromium must decode video frames');
      player.pause();
      const pausedAt = player.currentTime();
      await delay(150);
      assert(player.paused());
      assert(Math.abs(player.currentTime() - pausedAt) < 0.1, 'Pause must stop the playback clock');
      window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 190, shiftKey: true }));
      await loaded(() => player.playbackRate() === 1.1, 'keyboard playback speed did not change');
      assert(player.el().querySelector('.vjs-overlay-playrate').textContent.includes('1.1x'));
      player.currentTime(4);
      await loaded(() => !element.seeking && Math.abs(player.currentTime() - 4) < 0.3, 'seek did not finish');
      assert(calls.seek > 0, 'The tracking plugin must receive seeks');
      player.playbackRate(2);
      await player.play();
      await loaded(() => player.ended(), 'playback did not reach the end after seeking');
      assert(player.currentTime() >= 5.8);
      assert.equal(calls.firstplay, 1, 'Resume must not double-count the initial play');
    } finally {
      unmount();
    }
    assert(player.isDisposed(), 'Unmount must dispose the player');
    assert.equal(window.player, undefined);
    assert.equal(
      Object.values(videojs.getPlayers()).filter(Boolean).length,
      0,
      'No registered player survives unmount'
    );
  }
  const { requests } = await ipcRenderer.invoke('fixture-media');
  for (const name of ['sample.mp4', 'redirect.mp4', 'audio.m4a']) {
    assert(
      requests.some((request) => request.name === name && request.method === 'HEAD'),
      'Use production type detection'
    );
  }
  for (const name of ['master.m3u8', 'playlist.m3u8', 'segment-0.ts', 'segment-2.ts']) {
    assert(
      requests.some((request) => request.name === name && request.method === 'GET'),
      'Missing HLS request: ' + name
    );
  }
  assert(
    requests.some((request) => request.name === 'sample.mp4' && request.range),
    'Exercise HTTP range playback'
  );
  await lifecycle(store, history, origin);
  return 'Video.js 8: MP4, HLS/MediaSource and audio decode; controls, quality choices, overlays, tracking, seek, source changes and disposal';
}
