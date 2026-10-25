// @flow
import { THUMBNAIL_CDN_URL } from 'config';

const THUMBNAIL_HEIGHT = 220;
const THUMBNAIL_WIDTH = 390;
const THUMBNAIL_QUALITY = 85;

type Props<T> = {
  thumbnail: T,
  height?: number,
  width?: number,
  quality?: number,
};

export function getThumbnailCdnUrl<T extends ?string>(props: Props<T>): T | string {
  const { thumbnail, height = THUMBNAIL_HEIGHT, width = THUMBNAIL_WIDTH, quality = THUMBNAIL_QUALITY } = props;

  if (!THUMBNAIL_CDN_URL || !thumbnail) {
    return thumbnail;
  }

  if (!thumbnail.includes('https://spee.ch')) {
    return `${THUMBNAIL_CDN_URL}s:${width}:${height}/quality:${quality}/plain/${thumbnail}`;
  }

  return `${thumbnail}?quality=${quality}&height=${height}&width=${width}`;
}
