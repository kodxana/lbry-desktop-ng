// @flow
type TrackingData = {
  secondsToLoad?: number,
  currentTime?: number,
  readyState?: number,
  bufferCount?: number,
  seekCount?: number,
  seekTo?: number,
};

export default function eventTracking(player: HTMLMediaElement): () => void {
  let firstPlay = true;
  let loadStarted: number | void;
  let secondsToLoad = 0;
  let buffer: { started: number, position: number, readyState: number } | void;
  let bufferCount = 0;
  let seekCount = 0;
  let ignoreBufferUntil = 0;
  const seconds = (started: number) => Number((Math.max(0, performance.now() - started) / 1000).toFixed(3));
  const position = () => Math.round(player.currentTime);
  const emit = (name: string, detail: TrackingData) => player.dispatchEvent(new CustomEvent(name, { detail }));

  function reset() {
    firstPlay = true;
    loadStarted = undefined;
    secondsToLoad = 0;
    buffer = undefined;
    bufferCount = 0;
    seekCount = 0;
    ignoreBufferUntil = 0;
  }

  const listeners: { [string]: () => void } = {
    loadstart: () => {
      reset();
      loadStarted = performance.now();
    },
    loadeddata: () => {
      if (loadStarted !== undefined) secondsToLoad = seconds(loadStarted);
    },
    playing: () => {
      if (firstPlay) {
        firstPlay = false;
        emit('tracking:firstplay', { secondsToLoad });
      }
    },
    pause: () => {
      buffer = undefined;
      if (player.seeking) ignoreBufferUntil = performance.now() + 200;
    },
    waiting: () => {
      if (!buffer && performance.now() >= ignoreBufferUntil && player.currentTime > 0) {
        buffer = { started: performance.now(), position: position(), readyState: player.readyState };
      }
    },
    timeupdate: () => {
      const pending = buffer;
      if (pending && pending.position !== position()) {
        buffer = undefined;
        emit('tracking:buffered', {
          currentTime: position(),
          readyState: pending.readyState,
          secondsToLoad: seconds(pending.started),
          bufferCount: ++bufferCount,
        });
      }
    },
    seeking: () => {
      buffer = undefined;
      ignoreBufferUntil = performance.now() + 200;
      emit('tracking:seek', { seekCount: ++seekCount, seekTo: position() });
    },
    ended: reset,
  };
  Object.keys(listeners).forEach((event) => player.addEventListener(event, listeners[event]));
  return () => {
    reset();
    Object.keys(listeners).forEach((event) => player.removeEventListener(event, listeners[event]));
  };
}
