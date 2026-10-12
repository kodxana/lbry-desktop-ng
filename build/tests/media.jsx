import { strict as assert } from 'assert';
import React from 'react';
import { ipcRenderer } from 'electron';
import VideoJs from 'component/viewers/videoViewer/internal/videojs';
import { render, unmount, waitFor } from './helpers';

const noop = () => {};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function media(store, history) {
  const { origin } = await ipcRenderer.invoke('fixture-media');
  for (const [file, type, audio] of [
    ['sample.mp4', 'video/mp4', false],
    ['redirect.mp4', 'video/mp4', false],
    ['audio.m4a', 'audio/mp4', true],
  ]) {
    let player;
    let element;
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
        toggleVideoTheaterMode={noop}
        playNext={noop}
        playPrevious={noop}
        onPlayerReady={(ready, node) => {
          player = ready;
          element = node;
          player.muted(true);
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
        assert.equal(element.videoWidth, 96);
        assert.equal(element.videoHeight, 64);
      }
      if (file === 'redirect.mp4') {
        assert(element.currentSrc.startsWith('blob:'), 'HLS must use the real MediaSource playback path');
      }
      await player.play();
      await loaded(() => player.currentTime() > 0.25, 'playback did not advance');
      if (!audio) assert(element.getVideoPlaybackQuality().totalVideoFrames > 0, 'Chromium must decode video frames');
      player.pause();
      const pausedAt = player.currentTime();
      await delay(150);
      assert(player.paused());
      assert(Math.abs(player.currentTime() - pausedAt) < 0.1, 'Pause must stop the playback clock');
      player.currentTime(4);
      await loaded(() => !element.seeking && Math.abs(player.currentTime() - 4) < 0.3, 'seek did not finish');
      player.playbackRate(2);
      await player.play();
      await loaded(() => player.ended(), 'playback did not reach the end after seeking');
      assert(player.currentTime() >= 5.8);
    } finally {
      unmount();
    }
    assert(player.isDisposed(), 'Unmount must dispose the player');
    assert.equal(window.player, undefined);
  }
  const { requests } = await ipcRenderer.invoke('fixture-media');
  for (const name of ['sample.mp4', 'redirect.mp4', 'audio.m4a']) {
    assert(
      requests.some((request) => request.name === name && request.method === 'HEAD'),
      'Use production type detection'
    );
  }
  for (const name of ['playlist.m3u8', 'segment-0.ts', 'segment-2.ts']) {
    assert(
      requests.some((request) => request.name === name && request.method === 'GET'),
      'Missing HLS request: ' + name
    );
  }
  assert(
    requests.some((request) => request.name === 'sample.mp4' && request.range),
    'Exercise HTTP range playback'
  );
  return 'production player: H.264/AAC MP4, redirected HLS/MediaSource and audio decode, pause, seek, ended and disposal';
}
