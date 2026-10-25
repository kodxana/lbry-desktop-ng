// @flow
import React, { useEffect, useState, useCallback } from 'react';
import { stopContextMenu } from 'util/context-menu';
import type { Player } from './internal/videojs';
import VideoJs from './internal/videojs';
import analytics from 'analytics';
import classnames from 'classnames';
import { FORCE_CONTENT_TYPE_PLAYER } from 'constants/claim';
import AutoplayCountdown from 'component/autoplayCountdown';
import usePrevious from 'effects/use-previous';
import LoadingScreen from 'component/common/loading-screen';
import { useDesktopHistory } from 'component/common/desktop-router';
import debounce from 'util/debounce';
import { formatLbryUrlForWeb, generateListSearchUrlParams } from 'util/url';

const PLAY_TIMEOUT_LIMIT = 2000;

type Props = {
  position: number,
  changeVolume: (number) => void,
  changeMute: (boolean) => void,
  source: string,
  contentType: string,
  thumbnail: string,
  claim: StreamClaim,
  muted: boolean,
  videoPlaybackRate: number,
  volume: number,
  uri: string,
  autoplayNext: boolean,
  desktopPlayStartTime?: number,
  doAnalyticsView: (string, number) => Promise<any>,
  doAnalyticsBuffer: (string, any) => void,
  claimRewards: () => void,
  savePosition: (string, number) => void,
  clearPosition: (string) => void,
  toggleVideoTheaterMode: () => void,
  toggleAutoplayNext: () => void,
  setVideoPlaybackRate: (number) => void,
  userId: number,
  homepageData?: HomepageData,
  shareTelemetry: boolean,
  isFloating: boolean,
  doPlayUri: (string, string) => void,
  collectionId: string,
  nextRecommendedUri: string,
  previousListUri: string,
  videoTheaterMode: boolean,
  isMarkdownOrComment: boolean,
};

function VideoViewer(props: Props): React.Node {
  const {
    contentType,
    source,
    changeVolume,
    changeMute,
    videoPlaybackRate,
    thumbnail,
    position,
    claim,
    uri,
    muted,
    volume,
    autoplayNext,
    doAnalyticsView,
    doAnalyticsBuffer,
    claimRewards,
    savePosition,
    clearPosition,
    desktopPlayStartTime,
    toggleVideoTheaterMode,
    toggleAutoplayNext,
    setVideoPlaybackRate,
    userId,
    shareTelemetry,
    isFloating,
    doPlayUri,
    collectionId,
    nextRecommendedUri,
    previousListUri,
    videoTheaterMode,
    isMarkdownOrComment,
  } = props;
  const permanentUrl = claim && claim.permanent_url;
  const claimId = claim && claim.claim_id;
  const isAudio = contentType.includes('audio');
  const forcePlayer = FORCE_CONTENT_TYPE_PLAYER.includes(contentType);
  const { push } = useDesktopHistory();
  const [doNavigate, setDoNavigate] = useState(false);
  const [playNextUrl, setPlayNextUrl] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [showAutoplayCountdown, setShowAutoplayCountdown] = useState(false);
  const playbackRateRef = React.useRef(videoPlaybackRate);
  const previousUri = usePrevious(uri);
  /* isLoading was designed to show loading screen on first play press, rather than completely black screen, but
  breaks because some browsers (e.g. Firefox) block autoplay but leave the player.play Promise pending */
  const [isLoading, setIsLoading] = useState(false);
  const [replay, setReplay] = useState(false);
  const activePlayerRef = React.useRef<?Player>(null);

  const updateVolumeState = React.useCallback(
    debounce((volume, muted) => {
      changeVolume(volume);
      changeMute(muted);
    }, 500),
    []
  );

  // force everything to recent when URI changes, can cause weird corner cases otherwise (e.g. navigate while autoplay is true)
  useEffect(() => {
    if (uri && previousUri && uri !== previousUri) {
      setShowAutoplayCountdown(false);
      setIsLoading(false);
    }
  }, [uri, previousUri]);

  useEffect(() => {
    playbackRateRef.current = videoPlaybackRate;
  }, [videoPlaybackRate]);

  function doTrackingBuffered(e: Event) {
    if (!(e instanceof CustomEvent)) return;
    const data = e.detail;
    fetch(source, { method: 'HEAD', cache: 'no-store' }).then((response) => {
      data.playerPoweredBy = response.headers.get('x-powered-by');
      doAnalyticsBuffer(uri, data);
    });
  }

  function doTrackingFirstPlay(player: Player, e: Event) {
    if (!(e instanceof CustomEvent)) return;
    const data = e.detail;
    let timeToStart = data.secondsToLoad;

    if (desktopPlayStartTime !== undefined) {
      const differenceToAdd = Date.now() - desktopPlayStartTime;
      timeToStart += differenceToAdd;
    }
    analytics.playerStartedEvent();

    // convert bytes to bits, and then divide by seconds
    const contentInBits = Number(claim.value.source.size) * 8;
    const durationInSeconds = claim.value.video && claim.value.video.duration;
    let bitrateAsBitsPerSecond;
    if (durationInSeconds) {
      bitrateAsBitsPerSecond = Math.round(contentInBits / durationInSeconds);
    }

    fetch(source, { method: 'HEAD', cache: 'no-store' }).then((response) => {
      let playerPoweredBy = response.headers.get('x-powered-by') || '';
      analytics.videoStartEvent(
        claimId,
        timeToStart,
        playerPoweredBy,
        userId,
        claim.canonical_url,
        player,
        bitrateAsBitsPerSecond
      );
    });

    doAnalyticsView(uri, timeToStart).then(() => {
      claimRewards();
    });
  }

  const doPlay = useCallback(
    (playUri: string) => {
      setDoNavigate(false);
      if (!isFloating) {
        const navigateUrl = formatLbryUrlForWeb(playUri);
        push(
          { pathname: navigateUrl, search: (collectionId && generateListSearchUrlParams(collectionId)) || '' },
          { collectionId, forceAutoplay: true, hideFloatingPlayer: true }
        );
      } else {
        doPlayUri(playUri, collectionId);
      }
    },
    [collectionId, doPlayUri, isFloating, push]
  );

  useEffect(() => {
    if (!doNavigate) return;

    if (playNextUrl) {
      if (permanentUrl !== nextRecommendedUri) {
        if (nextRecommendedUri) {
          if (collectionId) clearPosition(permanentUrl);
          doPlay(nextRecommendedUri);
        }
      } else {
        setReplay(true);
      }
    } else {
      const activePlayer = activePlayerRef.current;
      if (activePlayer) {
        const currentTime = activePlayer.currentTime;

        if (currentTime <= 5) {
          if (previousListUri && permanentUrl !== previousListUri) doPlay(previousListUri);
        } else {
          activePlayer.currentTime = 0;
        }
        setDoNavigate(false);
      }
    }
    if (!ended) setDoNavigate(false);
    setEnded(false);
    setPlayNextUrl(true);
  }, [
    clearPosition,
    collectionId,
    doNavigate,
    doPlay,
    ended,
    nextRecommendedUri,
    permanentUrl,
    playNextUrl,
    previousListUri,
  ]);

  React.useEffect(() => {
    if (!ended) return;

    analytics.videoIsPlaying(false);

    if (!collectionId && autoplayNext) {
      setShowAutoplayCountdown(true);
    } else if (collectionId) {
      setDoNavigate(true);
    }

    clearPosition(uri);
  }, [autoplayNext, clearPosition, collectionId, ended, uri]);

  function onPlay(player: Player) {
    setEnded(false);
    setIsLoading(false);
    setIsPlaying(true);
    setShowAutoplayCountdown(false);
    setReplay(false);
    setDoNavigate(false);
    analytics.videoIsPlaying(true, player);
  }

  function onPause(event: Event, player: Player) {
    setIsPlaying(false);
    handlePosition(player);
    analytics.videoIsPlaying(false, player);
  }

  function onDispose(event: Event, player: Player) {
    handlePosition(player);
    analytics.videoIsPlaying(false, player);
  }

  function handlePosition(player: Player) {
    const currTime = player.currentTime;
    if (player.duration > currTime) {
      savePosition(uri, player.currentTime);
    }
  }

  function restorePlaybackRate(player: Player) {
    player.playbackRate = playbackRateRef.current;
  }

  const playerReadyDependencyList = [uri, desktopPlayStartTime];

  const doPlayNext = () => {
    setPlayNextUrl(true);
    setEnded(true);
  };

  const doPlayPrevious = () => {
    setPlayNextUrl(false);
    setEnded(true);
  };

  const onPlayerReady = useCallback((player: Player) => {
    activePlayerRef.current = player;
    player.muted = muted;
    player.volume = Math.max(0, Math.min(1, volume));
    player.playbackRate = videoPlaybackRate;
    let active = true;
    let restored = false;
    const restore = () => {
      restorePlaybackRate(player);
      if (!restored) {
        restored = true;
        if (position && Number.isFinite(player.duration)) player.currentTime = Math.min(position, player.duration);
      }
    };
    const listeners = {
      loadedmetadata: restore,
      'tracking:buffered': doTrackingBuffered,
      'tracking:firstplay': (event: Event) => doTrackingFirstPlay(player, event),
      ended: () => setEnded(true),
      play: () => onPlay(player),
      pause: (event: Event) => onPause(event, player),
      volumechange: () => updateVolumeState(player.volume, player.muted),
      ratechange: () => {
        if (player.readyState !== 0) setVideoPlaybackRate(player.playbackRate);
      },
    };
    Object.keys(listeners).forEach((event) => player.addEventListener(event, listeners[event]));
    if (player.readyState >= 1) restore();
    setIsLoading(true);
    const timeout = setTimeout(() => {
      if (active) setIsLoading(false);
    }, PLAY_TIMEOUT_LIMIT);
    return () => {
      active = false;
      clearTimeout(timeout);
      onDispose(new Event('dispose'), player);
      Object.keys(listeners).forEach((event) => player.removeEventListener(event, listeners[event]));
      if (activePlayerRef.current === player) activePlayerRef.current = null;
    };
  }, playerReadyDependencyList); // eslint-disable-line

  return (
    <div
      className={classnames('file-viewer', {
        'file-viewer--is-playing': isPlaying,
      })}
      onContextMenu={stopContextMenu}
    >
      {showAutoplayCountdown && (
        <AutoplayCountdown
          nextRecommendedUri={nextRecommendedUri}
          doNavigate={() => setDoNavigate(true)}
          doReplay={() => setReplay(true)}
        />
      )}
      {/* disable this loading behavior because it breaks when player.play() promise hangs */}
      {isLoading && <LoadingScreen status={__('Loading')} />}
      <VideoJs
        source={source}
        sourceType={forcePlayer ? 'video/mp4' : contentType}
        isAudio={isAudio}
        poster={isAudio ? thumbnail : ''}
        onPlayerReady={onPlayerReady}
        toggleVideoTheaterMode={toggleVideoTheaterMode}
        autoplay
        autoplaySetting={autoplayNext}
        toggleAutoplayNext={toggleAutoplayNext}
        collectionId={collectionId}
        isMarkdownOrComment={isMarkdownOrComment}
        claimId={claimId}
        userId={userId}
        shareTelemetry={shareTelemetry}
        replay={replay}
        videoTheaterMode={videoTheaterMode}
        playNext={doPlayNext}
        playPrevious={doPlayPrevious}
      />
    </div>
  );
}

export default VideoViewer;
