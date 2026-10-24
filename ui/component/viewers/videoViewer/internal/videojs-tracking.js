// @flow
type TrackingData = {
  secondsToLoad?: number,
  currentTime?: number,
  readyState?: number,
  bufferCount?: number,
  seekCount?: number,
  seekTo?: number,
};

type TrackingPlayer = {
  on: (string, () => void) => void,
  off: (string, () => void) => void,
  trigger: (string, TrackingData) => void,
  currentTime: () => number,
  readyState: () => number,
  scrubbing: () => boolean,
};

export default function eventTracking(this: TrackingPlayer): void {
  const player = this;
  let firstPlay = true;
  let loadStarted: number | void;
  let secondsToLoad = 0;
  let buffer: { started: number, position: number, readyState: number } | void;
  let bufferCount = 0;
  let seekCount = 0;
  let ignoreBufferUntil = 0;
  const seconds = (started: number) => Number((Math.max(0, performance.now() - started) / 1000).toFixed(3));
  const position = () => Math.round(player.currentTime());

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
        player.trigger('tracking:firstplay', { secondsToLoad });
      }
    },
    pause: () => {
      buffer = undefined;
      if (player.scrubbing()) ignoreBufferUntil = performance.now() + 200;
    },
    waiting: () => {
      if (!buffer && performance.now() >= ignoreBufferUntil && player.currentTime() > 0) {
        buffer = { started: performance.now(), position: position(), readyState: player.readyState() };
      }
    },
    timeupdate: () => {
      const pending = buffer;
      if (pending && pending.position !== position()) {
        buffer = undefined;
        player.trigger('tracking:buffered', {
          currentTime: position(),
          readyState: pending.readyState,
          secondsToLoad: seconds(pending.started),
          bufferCount: ++bufferCount,
        });
      }
    },
    seeking: () => player.trigger('tracking:seek', { seekCount: ++seekCount, seekTo: position() }),
    ended: reset,
    dispose: () => {
      reset();
      Object.keys(listeners).forEach((event) => player.off(event, listeners[event]));
    },
  };
  Object.keys(listeners).forEach((event) => player.on(event, listeners[event]));
}
