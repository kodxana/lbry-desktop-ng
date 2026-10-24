// @flow
import type { Player } from './videojs';
import * as OVERLAY from './overlays';
import * as KEYCODES from 'constants/keycodes';
import isUserTyping from 'util/detect-typing';
type PlayerRef = { current: Player | void };
type ContainerRef = { current: HTMLDivElement | null };
type KeyboardControls = { curried_function: (PlayerRef, ContainerRef) => (KeyboardEvent) => void };

const SEEK_STEP_5 = 5;
const SEEK_STEP = 10; // time to seek in seconds

const videoPlaybackRates = [0.25, 0.5, 0.75, 1, 1.1, 1.25, 1.5, 1.75, 2];

// check if active (clicked) element is part of video div, used for keyboard shortcuts (volume etc)
function activeElementIsPartOfVideoElement() {
  const videoElementParent = document.getElementsByClassName('video-js-parent')[0];
  const activeElement = document.activeElement;
  return Boolean(videoElementParent && videoElementParent.contains(activeElement));
}

function volumeUp(event: KeyboardEvent, playerRef: PlayerRef) {
  // dont run if video element is not active element (otherwise runs when scrolling using keypad)
  const videoElementIsActive = activeElementIsPartOfVideoElement();
  const player = playerRef.current;
  if (!player || !videoElementIsActive) return;
  event.preventDefault();
  player.volume(player.volume() + 0.05);
  OVERLAY.showVolumeverlay(player, Math.round(player.volume() * 100));
  player.userActive(true);
}

function volumeDown(event: KeyboardEvent, playerRef: PlayerRef) {
  // dont run if video element is not active element (otherwise runs when scrolling using keypad)
  const videoElementIsActive = activeElementIsPartOfVideoElement();
  const player = playerRef.current;
  if (!player || !videoElementIsActive) return;
  event.preventDefault();
  player.volume(player.volume() - 0.05);
  OVERLAY.showVolumeverlay(player, Math.round(player.volume() * 100));
  player.userActive(true);
}

function seekVideo(stepSize: number, playerRef: PlayerRef, containerRef: ContainerRef) {
  const player = playerRef.current;
  const videoNode = containerRef.current && containerRef.current.querySelector<HTMLMediaElement>('video, audio');
  if (!videoNode || !player) return;
  const duration = videoNode.duration;
  const currentTime = videoNode.currentTime;
  const newDuration = currentTime + stepSize;
  if (newDuration < 0) {
    videoNode.currentTime = 0;
  } else if (newDuration > duration) {
    videoNode.currentTime = duration;
  } else {
    videoNode.currentTime = newDuration;
  }
  OVERLAY.showSeekedOverlay(player, Math.abs(stepSize), stepSize > 0);
  player.userActive(true);
}

function toggleFullscreen(playerRef: PlayerRef) {
  const player = playerRef.current;
  if (!player) return;
  if (!player.isFullscreen()) {
    player.requestFullscreen();
  } else {
    player.exitFullscreen();
  }
}

function toggleMute(containerRef: ContainerRef) {
  const videoNode = containerRef.current && containerRef.current.querySelector<HTMLMediaElement>('video, audio');
  if (!videoNode) return;
  videoNode.muted = !videoNode.muted;
}

function togglePlay(containerRef: ContainerRef) {
  const videoNode = containerRef.current && containerRef.current.querySelector<HTMLMediaElement>('video, audio');
  if (!videoNode) return;
  videoNode.paused ? videoNode.play() : videoNode.pause();
}

function changePlaybackSpeed(shouldSpeedUp: boolean, playerRef: PlayerRef) {
  const player = playerRef.current;
  if (!player) return;
  const isSpeedUp = shouldSpeedUp;
  const rate = player.playbackRate();
  let rateIndex = videoPlaybackRates.findIndex((x) => x === rate);
  if (rateIndex >= 0) {
    rateIndex = isSpeedUp ? Math.min(rateIndex + 1, videoPlaybackRates.length - 1) : Math.max(rateIndex - 1, 0);
    const nextRate = videoPlaybackRates[rateIndex];

    OVERLAY.showPlaybackRateOverlay(player, nextRate, isSpeedUp);
    player.userActive(true);
    player.playbackRate(nextRate);
  }
}

const VideoJsKeyboardShorcuts = ({
  playNext,
  playPrevious,
  toggleVideoTheaterMode,
}: {
  playNext: () => void,
  playPrevious: () => void,
  toggleVideoTheaterMode: () => void,
}): KeyboardControls => {
  function toggleTheaterMode(playerRef: PlayerRef) {
    const player = playerRef.current;
    if (!player) return;
    // TODO: have to fix this
    toggleVideoTheaterMode();
    if (player.isFullscreen()) {
      player.exitFullscreen();
    }
  }

  function handleKeyDown(e: KeyboardEvent, playerRef: PlayerRef, containerRef: ContainerRef) {
    const player = playerRef.current;
    const videoNode = containerRef.current && containerRef.current.querySelector<HTMLMediaElement>('video, audio');
    if (!videoNode || !player || isUserTyping()) return;
    handleSingleKeyActions(e, playerRef, containerRef);
    handleShiftKeyActions(e, playerRef);
  }

  function handleShiftKeyActions(e: KeyboardEvent, playerRef: PlayerRef) {
    if (e.altKey || e.ctrlKey || e.metaKey || !e.shiftKey) return;
    if (e.keyCode === KEYCODES.PERIOD) changePlaybackSpeed(true, playerRef);
    if (e.keyCode === KEYCODES.COMMA) changePlaybackSpeed(false, playerRef);
    if (e.keyCode === KEYCODES.N) playNext();
    if (e.keyCode === KEYCODES.P) playPrevious();
  }

  function handleSingleKeyActions(e: KeyboardEvent, playerRef: PlayerRef, containerRef: ContainerRef) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.keyCode === KEYCODES.SPACEBAR || e.keyCode === KEYCODES.K) togglePlay(containerRef);
    if (e.keyCode === KEYCODES.F) toggleFullscreen(playerRef);
    if (e.keyCode === KEYCODES.M) toggleMute(containerRef);
    if (e.keyCode === KEYCODES.UP) volumeUp(e, playerRef);
    if (e.keyCode === KEYCODES.DOWN) volumeDown(e, playerRef);
    if (e.keyCode === KEYCODES.T) toggleTheaterMode(playerRef);
    if (e.keyCode === KEYCODES.L) seekVideo(SEEK_STEP, playerRef, containerRef);
    if (e.keyCode === KEYCODES.J) seekVideo(-SEEK_STEP, playerRef, containerRef);
    if (e.keyCode === KEYCODES.RIGHT) seekVideo(SEEK_STEP_5, playerRef, containerRef);
    if (e.keyCode === KEYCODES.LEFT) seekVideo(-SEEK_STEP_5, playerRef, containerRef);
  }

  var curried_function = function (playerRef: PlayerRef, containerRef: ContainerRef) {
    return function curried_func(e: KeyboardEvent) {
      handleKeyDown(e, playerRef, containerRef);
    };
  };

  return {
    curried_function,
  };
};

export default VideoJsKeyboardShorcuts;
