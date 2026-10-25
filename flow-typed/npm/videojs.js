// Video.js 10 public APIs used by the desktop player.
declare module '@videojs/react' {
  import type { ComponentType, ComponentProps, Node, RefSetter } from 'react';
  declare export type MediaProps = {
    src?: string,
    preload?: 'none' | 'metadata' | 'auto',
    playsInline?: boolean,
    children?: Node,
    ref?: RefSetter<HTMLMediaElement>,
    onClick?: ({currentTarget: HTMLMediaElement, nativeEvent: MouseEvent, ...}) => void,
    onDoubleClick?: ({currentTarget: HTMLMediaElement, nativeEvent: MouseEvent, ...}) => void,
  };
  declare export type PlayerState = {
    paused: boolean, muted: boolean, volume: number, playbackRate: number,
    isFullscreen: boolean, waiting: boolean, error: ?{message: string},
  };
  declare export type PlayerStore = {
    state: PlayerState,
    requestFullscreen: () => Promise<void>,
    exitFullscreen: () => Promise<void>,
  };
  declare export type Media = { play: () => Promise<void>, ... };
  declare export type Options = {
    state: { availability: 'available' | 'unavailable', ... },
    value: string, hidden: boolean, disabled: boolean,
    options: Array<{ value: string, label: string, disabled: boolean, ... }>,
    setValue: (string) => void,
  };
  declare export var Container: ComponentType<ComponentProps<'div'>>;
  declare export var PlayButton: ComponentType<ComponentProps<'button'>>;
  declare export var MuteButton: ComponentType<ComponentProps<'button'>>;
  declare export var FullscreenButton: ComponentType<ComponentProps<'button'>>;
  declare export var StatusAnnouncer: ComponentType<{}>;
  declare export var Time: { Value: ComponentType<{type: 'current' | 'duration', className?: string}> };
  declare export type SliderParts = {
    Root: ComponentType<ComponentProps<'div'>>,
    Track: ComponentType<ComponentProps<'div'>>,
    Fill: ComponentType<ComponentProps<'div'>>,
    Buffer: ComponentType<ComponentProps<'div'>>,
    Thumb: ComponentType<ComponentProps<'div'>>,
  };
  declare export var TimeSlider: SliderParts;
  declare export var VolumeSlider: SliderParts;
  declare export var Controls: {
    Root: ComponentType<{children?: Node, visibility?: 'auto' | 'always'}>,
    Content: ComponentType<ComponentProps<'div'>>,
    Group: ComponentType<ComponentProps<'div'>>,
  };
  declare export function useMedia(): ?Media;
  declare export function useQualityOptions(props?: {label?: string}): ?Options;
  declare export function useCaptionsOptions(props?: {label?: string}): ?Options;
}
declare module '@videojs/react/video' {
  import type { ComponentType, ComponentProps, Node } from 'react';
  import type { PlayerStore, PlayerState, MediaProps } from '@videojs/react';
  declare export var VideoPlayer: ComponentType<{children?: Node, poster?: string}>;
  declare export var Video: ComponentType<MediaProps>;
  declare export function usePlayer(): PlayerStore;
  declare export function usePlayer<T>(selector: (PlayerState) => T): T;
}
declare module '@videojs/react/audio' {
  import type { ComponentType } from 'react';
  import type { MediaProps } from '@videojs/react';
  declare export var Audio: ComponentType<MediaProps>;
}
declare module '@videojs/react/media/hlsjs-video' {
  import type { ComponentType } from 'react';
  import type { MediaProps } from '@videojs/react';
  declare export var HlsJsVideo: ComponentType<MediaProps>;
}
declare module '@videojs/react/media/dash-video' {
  import type { ComponentType } from 'react';
  import type { MediaProps } from '@videojs/react';
  declare export var DashVideo: ComponentType<MediaProps>;
}
declare module '@videojs/react/icons' {
  import type { ComponentType, ComponentProps } from 'react';
  declare export var PlayIcon: ComponentType<ComponentProps<'svg'>>;
  declare export var PauseIcon: ComponentType<ComponentProps<'svg'>>;
  declare export var VolumeHighIcon: ComponentType<ComponentProps<'svg'>>;
  declare export var VolumeOffIcon: ComponentType<ComponentProps<'svg'>>;
  declare export var FullscreenEnterIcon: ComponentType<ComponentProps<'svg'>>;
  declare export var FullscreenExitIcon: ComponentType<ComponentProps<'svg'>>;
}
