// @flow
import * as React from 'react';
import { VideoPlayer, Video, usePlayer } from '@videojs/react/video';
import { Audio } from '@videojs/react/audio';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { DashVideo } from '@videojs/react/media/dash-video';
import {
  Container,
  Controls,
  PlayButton,
  MuteButton,
  FullscreenButton,
  Time,
  TimeSlider,
  VolumeSlider,
  StatusAnnouncer,
  useMedia,
  useQualityOptions,
  useCaptionsOptions,
} from '@videojs/react';
import {
  PlayIcon,
  PauseIcon,
  VolumeHighIcon,
  VolumeOffIcon,
  FullscreenEnterIcon,
  FullscreenExitIcon,
} from '@videojs/react/icons';
import classnames from 'classnames';
import resolveMediaSource from './videojs-functions';
import type { MediaSource } from './videojs-functions';
import eventTracking from './videojs-tracking';
import trackRecommendations from './track-recommendations';
import keyboardShortcuts, { playbackRates } from './videojs-keyboard-shortcuts';

export type Player = HTMLMediaElement;
type Props = {
  source: string,
  sourceType: string,
  poster?: ?string,
  isAudio: boolean,
  onPlayerReady: (Player, HTMLMediaElement) => ?() => void,
  autoplay: boolean,
  autoplaySetting: boolean,
  toggleAutoplayNext?: () => void,
  toggleVideoTheaterMode: () => void,
  claimId?: ?string,
  userId?: ?number,
  shareTelemetry: boolean,
  replay: boolean,
  videoTheaterMode: boolean,
  playNext: () => void,
  playPrevious: () => void,
  collectionId?: ?string,
  isMarkdownOrComment?: boolean,
  tracks?: Array<{ src: string, kind: string, srcLang: string, label: string }>,
};

function QualityControl(): React.Node {
  const quality = useQualityOptions({ label: __('Quality') });
  if (!quality || quality.hidden || quality.state.availability !== 'available') return null;
  return (
    <select
      className="player-quality"
      aria-label={__('Quality')}
      value={quality.value}
      disabled={quality.disabled}
      onChange={(event) => quality.setValue(event.target.value)}
    >
      {quality.options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.value === 'auto' ? __('Auto') : option.label}
        </option>
      ))}
    </select>
  );
}

function CaptionControl(): React.Node {
  const captions = useCaptionsOptions({ label: __('Captions') });
  if (!captions || captions.hidden) return null;
  return (
    <select
      className="player-captions"
      aria-label={__('Captions')}
      value={captions.value}
      disabled={captions.disabled}
      onChange={(event) => captions.setValue(event.target.value)}
    >
      {captions.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Playback(props: { ...Props, resolved: MediaSource, retry: () => void }): React.Node {
  const latest = React.useRef(props);
  latest.current = props;
  const node = React.useRef<?HTMLMediaElement>(null);
  const root = React.useRef<?HTMLDivElement>(null);
  const media = useMedia();
  const store = usePlayer();
  const state = usePlayer((state) => ({
    paused: state.paused,
    muted: state.muted,
    volume: state.volume,
    playbackRate: state.playbackRate,
    isFullscreen: state.isFullscreen,
    waiting: state.waiting,
    error: state.error,
  }));
  const [notice, setNotice] = React.useState('');
  const [playBlocked, setPlayBlocked] = React.useState(false);
  const noticeTimer = React.useRef<number | void>(undefined);
  const showNotice = React.useCallback((text: string) => {
    clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(''), 1200);
  }, []);
  const play = React.useCallback(() => {
    const element = node.current;
    if (element)
      element.play().then(
        () => {
          if (node.current === element) setPlayBlocked(false);
        },
        () => {
          if (node.current === element) setPlayBlocked(true);
        }
      );
  }, []);
  const fullscreen = React.useCallback(() => {
    const action = store.state.isFullscreen ? store.exitFullscreen : store.requestFullscreen;
    action().catch(() => showNotice(__('Fullscreen is unavailable')));
  }, [store, showNotice]);
  const theater = React.useCallback(() => {
    latest.current.toggleVideoTheaterMode();
    if (store.state.isFullscreen) store.exitFullscreen().catch(() => {});
  }, [store]);

  // Save position before child adapters detach and reset their media element.
  React.useLayoutEffect(() => {
    const element = node.current;
    const container = root.current;
    if (!media || !element || !container) return;
    window.player = element;
    const stopTracking = eventTracking(element);
    const cleanup = latest.current.onPlayerReady(element, element);
    const stopKeyboard = keyboardShortcuts(element, container, {
      play,
      fullscreen,
      theater,
      notice: showNotice,
      playNext: () => latest.current.playNext(),
      playPrevious: () => latest.current.playPrevious(),
    });
    if (latest.current.autoplay) play();
    return () => {
      stopKeyboard();
      stopTracking();
      clearTimeout(noticeTimer.current);
      cleanup?.();
      element.pause();
      // React can replay effects while keeping the native element mounted.
      if (media === element)
        setTimeout(() => {
          if (!element.isConnected) {
            element.removeAttribute('src');
            element.load();
          }
        }, 0);
      if (window.player === element) window.player = undefined;
    };
  }, [media, play, fullscreen, theater, showNotice]);

  React.useEffect(() => {
    const element = node.current;
    if (!media || !element || !props.shareTelemetry) return;
    return trackRecommendations(element, props.claimId, () => latest.current.shareTelemetry);
  }, [media, props.claimId, props.shareTelemetry]);

  React.useEffect(() => {
    if (props.replay && media) play();
  }, [props.replay, media, play]);

  const Media = /mpegurl/i.test(props.resolved.type)
    ? HlsJsVideo
    : props.resolved.type === 'application/dash+xml'
      ? DashVideo
      : props.isAudio
        ? Audio
        : Video;
  const extended = !props.isMarkdownOrComment;
  const tracks = props.tracks || [];
  return (
    <Container
      ref={root}
      className={classnames('lbry-player', { 'lbry-player--audio': props.isAudio })}
      tabIndex={0}
      aria-label={__('Media player')}
    >
      {props.isAudio && props.poster && <img className="player-poster" src={props.poster} alt="" />}
      <Media
        ref={node}
        src={props.resolved.src}
        preload="auto"
        playsInline
        onClick={() => {
          if (node.current?.paused) play();
          else node.current?.pause();
        }}
        onDoubleClick={fullscreen}
      >
        {tracks.map((track) => (
          <track key={track.src} {...track} />
        ))}
      </Media>
      <StatusAnnouncer />
      {state.waiting && !state.error && (
        <div className="player-message" role="status">
          {__('Buffering…')}
        </div>
      )}
      {(state.error || playBlocked) && (
        <div className="player-message" role="status">
          {state.error ? __('Unable to play this media.') : __('Press play to start playback.')}
          <button type="button" onClick={state.error ? props.retry : play}>
            {state.error ? __('Retry') : __('Play')}
          </button>
        </div>
      )}
      {notice && (
        <div className="player-notice" aria-live="polite">
          {notice}
        </div>
      )}
      {!state.paused && (state.muted || state.volume === 0) && (
        <button
          type="button"
          className="player-unmute"
          onClick={() => {
            if (node.current) {
              node.current.muted = false;
              if (!node.current.volume) node.current.volume = 1;
            }
          }}
        >
          {__('Tap to unmute')}
        </button>
      )}
      <Controls.Root>
        <Controls.Content className="player-controls">
          <TimeSlider.Root className="player-timeline" aria-label={__('Seek')}>
            <TimeSlider.Track className="player-track">
              <TimeSlider.Buffer className="player-buffer" />
              <TimeSlider.Fill className="player-fill" />
            </TimeSlider.Track>
            <TimeSlider.Thumb className="player-thumb" />
          </TimeSlider.Root>
          <Controls.Group className="player-buttons" aria-label={__('Playback controls')}>
            {extended && props.collectionId && (
              <button
                type="button"
                className="player-previous"
                title={__('Play Previous (SHIFT+P)')}
                aria-label={__('Play Previous (SHIFT+P)')}
                onClick={props.playPrevious}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 5h2v14H5zm14 0v14L8 12z" />
                </svg>
              </button>
            )}
            <PlayButton
              className="player-play"
              aria-label={state.paused ? __('Play (space)') : __('Pause (space)')}
              title={state.paused ? __('Play (space)') : __('Pause (space)')}
            >
              {state.paused ? <PlayIcon /> : <PauseIcon />}
            </PlayButton>
            {extended && props.collectionId && (
              <button
                type="button"
                className="player-next"
                title={__('Play Next (SHIFT+N)')}
                aria-label={__('Play Next (SHIFT+N)')}
                onClick={props.playNext}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17 5h2v14h-2zM5 5l11 7-11 7z" />
                </svg>
              </button>
            )}
            <MuteButton
              className="player-mute"
              aria-label={state.muted ? __('Unmute (m)') : __('Mute (m)')}
              title={state.muted ? __('Unmute (m)') : __('Mute (m)')}
            >
              {state.muted || !state.volume ? <VolumeOffIcon /> : <VolumeHighIcon />}
            </MuteButton>
            <VolumeSlider.Root className="player-volume" aria-label={__('Volume')}>
              <VolumeSlider.Track className="player-track">
                <VolumeSlider.Fill className="player-fill" />
              </VolumeSlider.Track>
              <VolumeSlider.Thumb className="player-thumb" />
            </VolumeSlider.Root>
            <div className="player-time">
              <Time.Value type="current" />
              <span> / </span>
              <Time.Value type="duration" />
            </div>
            <span className="player-spacer" />
            {extended && !props.collectionId && (
              <button
                type="button"
                className="player-autoplay"
                role="switch"
                aria-checked={props.autoplaySetting}
                title={__('Autoplay Next')}
                aria-label={__('Autoplay Next')}
                onClick={props.toggleAutoplayNext}
              />
            )}
            <select
              className="player-rate"
              aria-label={__('Playback Rate')}
              value={state.playbackRate || 1}
              onChange={(event) => {
                if (node.current) node.current.playbackRate = Number(event.target.value);
              }}
            >
              {playbackRates.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>
            <QualityControl />
            <CaptionControl />
            {extended && !props.isAudio && (
              <button
                type="button"
                className="player-theater"
                aria-pressed={props.videoTheaterMode}
                title={props.videoTheaterMode ? __('Default Mode (t)') : __('Theater Mode (t)')}
                aria-label={props.videoTheaterMode ? __('Default Mode (t)') : __('Theater Mode (t)')}
                onClick={theater}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="2" y="5" width="20" height="14" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            )}
            <FullscreenButton
              className="player-fullscreen"
              aria-label={state.isFullscreen ? __('Exit Fullscreen (f)') : __('Fullscreen (f)')}
            >
              {state.isFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
            </FullscreenButton>
          </Controls.Group>
        </Controls.Content>
      </Controls.Root>
    </Container>
  );
}

function SourcePlayer(props: Props): React.Node {
  const [resolved, setResolved] = React.useState<?MediaSource>(null);
  const [error, setError] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    const controller = new AbortController();
    setResolved(null);
    setError(false);
    resolveMediaSource(props.source, props.sourceType, controller.signal).then(
      (source) => {
        if (!controller.signal.aborted) setResolved(source);
      },
      () => {
        if (!controller.signal.aborted) setError(true);
      }
    );
    return () => controller.abort();
  }, [props.source, props.sourceType, attempt]);
  const retry = () => setAttempt((value) => value + 1);
  return (
    <div className="video-js-parent">
      {resolved ? (
        <VideoPlayer key={attempt} poster={props.poster || ''}>
          <Playback {...props} resolved={resolved} retry={retry} />
        </VideoPlayer>
      ) : (
        <div className="player-message" role="status">
          {error ? __('Unable to load this media.') : __('Loading media…')}
          {error && (
            <button type="button" onClick={retry}>
              {__('Retry')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function VideoJs(props: Props): React.Node {
  return <SourcePlayer key={props.source + '|' + props.sourceType + '|' + String(props.isAudio)} {...props} />;
}
