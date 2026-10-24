// @flow
import type { Player } from './videojs';
import videojs from 'video.js';

const VideoButton = videojs.getComponent('Button');

class AutoplayNextButton extends VideoButton {
  constructor(player: Player, options: { ... } = {}, autoplayNext: boolean) {
    super(player, options, autoplayNext);
    const title = autoplayNext ? 'Autoplay Next On' : 'Autoplay Next Off';

    this.controlText(title);
    this.setAttribute('aria-label', title);
    this.addClass('vjs-button--autoplay-next');
    this.setAttribute('aria-checked', autoplayNext);
  }
}

export function addAutoplayNextButton(player: Player, toggleAutoplayNext: () => void, autoplayNext: boolean) {
  const controlBar = player.getChild('controlBar');

  const autoplayButton = new AutoplayNextButton(
    player,
    {
      name: 'AutoplayNextButton',
      text: 'Autoplay Next',
      clickHandler: () => {
        toggleAutoplayNext();
      },
    },
    autoplayNext
  );

  controlBar.addChild(autoplayButton);
}
