// @flow
import isUserTyping from 'util/detect-typing';

export const playbackRates: Array<number> = [0.25, 0.5, 0.75, 1, 1.1, 1.25, 1.5, 1.75, 2];
type Controls = {
  playNext: () => void,
  playPrevious: () => void,
  theater: () => void,
  fullscreen: () => void,
  play: () => void,
  notice: (string) => void,
};

export default function keyboardShortcuts(
  media: HTMLMediaElement,
  container: HTMLElement,
  controls: Controls
): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isUserTyping()) return;
    const active = document.activeElement;
    const code = event.keyCode;
    if (active instanceof HTMLElement) {
      if (active.isContentEditable || active.closest('input, select, textarea, [role="menu"]')) return;
      // Keep native activation and slider keys; letter shortcuts still work after clicking Play.
      if (active.closest('button') && code === 32) return;
      if (active.closest('[role="slider"]') && [32, 35, 36, 37, 38, 39, 40].includes(code)) return;
    }
    if (event.shiftKey) {
      if (code === 78) controls.playNext();
      else if (code === 80) controls.playPrevious();
      else if (code === 188 || code === 190) {
        const index = playbackRates.indexOf(media.playbackRate);
        if (index < 0) return;
        media.playbackRate =
          playbackRates[Math.max(0, Math.min(playbackRates.length - 1, index + (code === 190 ? 1 : -1)))];
        controls.notice(`${media.playbackRate}x`);
      } else return;
    } else if (code === 32 || code === 75) {
      if (media.paused) controls.play();
      else media.pause();
    } else if (code === 70) controls.fullscreen();
    else if (code === 84) controls.theater();
    else if (code === 77) media.muted = !media.muted;
    else if (code === 38 || code === 40) {
      if (!active || !container.contains(active)) return;
      media.volume = Math.max(0, Math.min(1, media.volume + (code === 38 ? 0.05 : -0.05)));
      controls.notice(`${Math.round(media.volume * 100)}%`);
    } else if ([37, 39, 74, 76].includes(code)) {
      if (!Number.isFinite(media.duration)) return;
      const step = (code === 37 || code === 39 ? 5 : 10) * (code === 37 || code === 74 ? -1 : 1);
      media.currentTime = Math.max(0, Math.min(media.duration, media.currentTime + step));
      controls.notice(`${step > 0 ? '+' : ''}${step}s`);
    } else return;
    event.preventDefault();
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}
