import { strict as assert } from 'assert';
import React from 'react';
import { ipcRenderer } from 'electron';
import VideoViewer from 'component/viewers/videoViewer/view';
import analytics from 'analytics';
import VideoJs from 'component/viewers/videoViewer/internal/videojs';
import { render, unmount, waitFor } from './helpers';
import mediaControls from './mediaControls';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
        collectionId="fixture-playlist"
        shareTelemetry={false}
        replay={false}
        videoTheaterMode={false}
        toggleVideoTheaterMode={() => {}}
        playNext={() => next++}
        playPrevious={() => {}}
        onPlayerReady={(player) => {
          player.muted = true;
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
    assert(!players[0].isConnected && players[0].paused, 'A source change must dispose the old player');
    assert.equal(window.player, players[1]);
    assert.equal(document.querySelectorAll('.lbry-player').length, 1, 'A source change must remove the old wrapper');
    playNext();
    assert.equal(next, 1, 'A source change must not duplicate keyboard shortcuts');
  } finally {
    unmount();
  }
  playNext();
  assert.equal(next, 1, 'Unmount must remove keyboard shortcuts');
  assert(players.every((player) => !player.isConnected && player.paused));

  const originalFetch = window.fetch;
  const release = [];
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (args[1] && args[1].method === 'HEAD') await new Promise((resolve) => release.push(resolve));
    return response;
  };
  try {
    mount('sample.mp4');
    await waitFor(() => release.length === 1, 'The source checks did not start');
    unmount();
    release.forEach((resolve) => resolve());
    await delay(100);
    assert.equal(players.length, 2, 'Late source detection must not initialize an unmounted player');
    assert.equal(window.player, undefined);
  } finally {
    release.forEach((resolve) => resolve());
    window.fetch = originalFetch;
    unmount();
  }
}

async function viewerCallbacks(store, history, origin) {
  const noop = () => {};
  const notifications = [];
  const positions = [];
  const volumes = [];
  const mutes = [];
  const rates = [];
  const previous = 'lbry://previous#def';
  const current = 'lbry://current#abc';
  const original = analytics.videoIsPlaying;
  analytics.videoIsPlaying = (playing, player) => notifications.push({ playing, player });
  history.replace('/current:abc');
  try {
    render(
      <VideoViewer
        source={origin + '/sample.mp4'}
        contentType="video/mp4"
        thumbnail=""
        claim={{
          claim_id: 'abc',
          permanent_url: current,
          canonical_url: current,
          value: { source: { size: 1000 }, video: { duration: 6 } },
        }}
        uri={current}
        position={1.5}
        muted
        volume={0.5}
        videoPlaybackRate={1.25}
        autoplayNext={false}
        changeVolume={(value) => volumes.push(value)}
        changeMute={(value) => mutes.push(value)}
        doAnalyticsView={async () => {}}
        doAnalyticsBuffer={noop}
        claimRewards={noop}
        savePosition={(uri, value) => positions.push([uri, value])}
        clearPosition={noop}
        toggleVideoTheaterMode={noop}
        toggleAutoplayNext={noop}
        setVideoPlaybackRate={(value) => rates.push(value)}
        userId={0}
        shareTelemetry={false}
        isFloating={false}
        doPlayUri={noop}
        collectionId="fixture-playlist"
        nextRecommendedUri=""
        previousListUri={previous}
        videoTheaterMode={false}
        isMarkdownOrComment={false}
      />,
      store,
      history
    );
    await waitFor(() => window.player && window.player.readyState >= 2, 'Viewer must initialize a real player');
    const player = window.player;
    player.pause();
    await waitFor(() => !player.seeking && player.currentTime >= 1.5, 'Saved position is restored after metadata');
    assert.equal(player.volume, 0.5);
    assert.equal(player.muted, true);
    assert.equal(player.playbackRate, 1.25);
    player.volume = 0.3;
    player.muted = false;
    player.playbackRate = 1.1;
    await waitFor(
      () => volumes.at(-1) === 0.3 && mutes.at(-1) === false && rates.at(-1) === 1.1,
      'Volume, mute and speed changes reach saved preferences'
    );
    player.muted = true;
    await player.play();
    await waitFor(() => notifications.some((event) => event.playing), 'Play notification must be delivered');
    assert(
      notifications.every((event) => event.player === player),
      'Playback callbacks must receive the player, not the DOM event'
    );
    player.pause();
    player.currentTime = 5.5;
    await waitFor(() => player.currentTime > 5, 'Seek before testing Previous');
    document.querySelector('.player-previous').click();
    await waitFor(() => player.currentTime < 0.1, 'Previous after five seconds restarts the current video');
    assert.equal(history.location.pathname, '/current:abc');
    document.querySelector('.player-previous').click();
    await waitFor(
      () => history.location.pathname === '/previous:def',
      'Previous near the start navigates to the preceding item'
    );
    player.currentTime = 2;
    await waitFor(() => !player.seeking && player.currentTime === 2, 'Seek before saving on unmount');
    positions.length = 0;
    unmount();
    assert.deepEqual(positions, [[current, 2]], 'Unmount saves the position once before resetting the decoder');
  } finally {
    unmount();
    analytics.videoIsPlaying = original;
  }
}

export default async function media(store, history) {
  const { origin } = await ipcRenderer.invoke('fixture-media');
  for (const [file, type, audio] of [
    ['sample.mp4', 'video/mp4', false],
    ['redirect.mp4', 'video/mp4', false],
    ['master.m3u8', 'application/x-mpegURL', false],
    ['manifest.mpd', 'application/dash+xml', false],
    ['audio.m4a', 'audio/mp4', true],
  ]) {
    let player;
    let element;
    let disposedAt;
    const calls = { next: 0, previous: 0, theater: 0, autoplay: 0, firstplay: 0, seek: 0 };
    const called = (name) => () => calls[name]++;
    render(
      <VideoJs
        source={origin + '/' + file}
        sourceType={type}
        isAudio={audio}
        autoplay={false}
        autoplaySetting={false}
        collectionId="fixture-playlist"
        shareTelemetry={false}
        replay={false}
        videoTheaterMode={false}
        toggleVideoTheaterMode={called('theater')}
        playNext={called('next')}
        playPrevious={called('previous')}
        onPlayerReady={(ready, node) => {
          player = ready;
          element = node;
          player.muted = true;
          player.addEventListener('tracking:firstplay', called('firstplay'));
          player.addEventListener('tracking:seek', called('seek'));
          return () => {
            disposedAt = player.currentTime;
          };
        }}
      />,
      store,
      history
    );
    const loaded = (predicate, message) =>
      waitFor(
        () => {
          assert(!player || !player.error, file + ': ' + JSON.stringify(player && player.error));
          return player && predicate();
        },
        file + ': ' + message
      );
    try {
      await loaded(() => element.readyState >= 2, 'media did not decode');
      assert(Math.abs(player.duration - 6) < 0.2, 'Read the actual fixture duration');
      if (!audio) {
        assert([32, 64].includes(element.videoHeight));
        assert.equal(element.videoWidth / element.videoHeight, 1.5);
      }
      if (file === 'redirect.mp4' || file === 'master.m3u8' || file === 'manifest.mpd') {
        assert(element.currentSrc.startsWith('blob:'), 'HLS must use the real MediaSource playback path');
      }
      for (const [name, call] of [
        ...(!audio ? [['theater', 'theater']] : []),
        ['next', 'next'],
        ['previous', 'previous'],
      ]) {
        const button = document.querySelector('.player-' + name);
        assert(button.getAttribute('aria-label'), 'Controls retain accessible labels');
        button.click();
        assert.equal(calls[call], 1, name + ' invokes its action once');
      }
      if (file === 'master.m3u8') {
        await loaded(
          () => document.querySelector('.player-quality')?.options.length === 3,
          'Both HLS qualities and Auto are available'
        );
        const selector = document.querySelector('.player-quality');
        assert.deepEqual(
          [...selector.options].map((option) => option.textContent).sort(),
          ['32p', '64p', 'Auto'].sort()
        );
        for (const label of ['32p', '64p', 'Auto']) {
          player.currentTime = 0;
          await loaded(() => !player.seeking && player.currentTime < 0.1, 'Seek before changing quality');
          selector.value = [...selector.options].find((option) => option.textContent === label).value;
          selector.dispatchEvent(new Event('change', { bubbles: true }));
          await delay(0);
          await loaded(() => selector.selectedOptions[0].textContent === label, 'Quality selection retained');
          if (label !== 'Auto') {
            await player.play();
            await loaded(
              () => player.videoHeight === parseInt(label, 10) && !player.seeking,
              'Manual quality must change the decoded frame size to ' + label
            );
            player.pause();
          }
        }
        player.currentTime = 0;
        await loaded(() => !player.seeking && player.currentTime < 0.1, 'Quality checks return to the start');
      } else if (audio || file === 'sample.mp4') {
        assert(!document.querySelector('.player-quality'), 'Single MP4/audio has no adaptive quality selector');
      }
      await player.play();
      await loaded(() => player.currentTime > 0.25, 'playback did not advance');
      assert.equal(calls.firstplay, 1, 'Native playback must report its first play');
      if (!audio) assert(element.getVideoPlaybackQuality().totalVideoFrames > 0, 'Chromium must decode video frames');
      player.pause();
      const pausedAt = player.currentTime;
      await delay(150);
      assert(player.paused);
      assert(Math.abs(player.currentTime - pausedAt) < 0.1, 'Pause must stop the playback clock');
      document.querySelector('.lbry-player').focus();
      window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 190, shiftKey: true }));
      await loaded(() => player.playbackRate === 1.1, 'keyboard playback speed did not change');
      assert(document.querySelector('.player-notice').textContent.includes('1.1x'));
      player.currentTime = 4;
      await loaded(() => !element.seeking && Math.abs(player.currentTime - 4) < 0.3, 'seek did not finish');
      assert(calls.seek > 0, 'The tracking plugin must receive seeks');
      player.playbackRate = 2;
      await player.play();
      await loaded(() => player.ended, 'playback did not reach the end after seeking');
      assert(player.currentTime >= 5.8);
      assert.equal(calls.firstplay, 1, 'Resume must not double-count the initial play');
    } finally {
      unmount();
    }
    assert(!player.isConnected && player.paused, 'Unmount stops and removes the native player');
    assert(disposedAt >= 5.8, file + ': cleanup must run before the decoder clears its playback position');
    assert.equal(window.player, undefined);
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
  await viewerCallbacks(store, history, origin);
  await mediaControls(store, history, origin);
  return 'Video.js 10: MP4, HLS/DASH MediaSource and audio decode; controls, quality choices, overlays, tracking, seek, source changes and disposal';
}
