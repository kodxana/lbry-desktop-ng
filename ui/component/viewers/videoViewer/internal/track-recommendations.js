// @flow
import RecSys from 'recsys/recsys';

export default function trackRecommendations(
  media: HTMLMediaElement,
  claimId: ?string,
  enabled: () => boolean
): () => void {
  let previousTime = media.currentTime;
  const send = (event: number, offset: number, arg?: number) => {
    if (enabled()) RecSys.onRecsysPlayerEvent(claimId, arg === undefined ? { event, offset } : { event, offset, arg });
  };
  const listeners = {
    playing: () => {
      send(0, media.currentTime);
      previousTime = media.currentTime;
    },
    pause: () => send(1, media.currentTime),
    ended: () => send(1, media.currentTime),
    ratechange: () => send(3, media.currentTime, media.playbackRate),
    timeupdate: () => {
      if (!media.seeking) previousTime = media.currentTime;
    },
    seeking: () => {
      if (previousTime !== media.currentTime) send(2, previousTime, media.currentTime);
    },
  };
  Object.keys(listeners).forEach((name) => media.addEventListener(name, listeners[name]));
  return () => {
    Object.keys(listeners).forEach((name) => media.removeEventListener(name, listeners[name]));
    if (enabled()) RecSys.onPlayerDispose(claimId);
  };
}
