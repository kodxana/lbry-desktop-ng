// @flow
import { CHANNEL_STAKED_LEVEL_VIDEO_COMMENTS } from 'config';
import * as ICONS from 'constants/icons';
import * as React from 'react';
import Button from 'component/button';
import classnames from 'classnames';
import MarkdownLink from 'component/markdownLink';
import OptimizedImage from 'component/optimizedImage';
import markdownRenderer from 'util/markdown-renderer';
import markdownProcessor from 'util/markdown-processor';
import ZoomableImage from 'component/zoomableImage';
import { parse } from 'node-html-parser';

const RE_EMOTE = /:\+1:|:-1:|:[\w-]+:/;

function isEmote(title: ?string, src: string): boolean {
  return Boolean(title && RE_EMOTE.test(title) && src.includes('static.odycdn.com/emoticons'));
}

type SimpleTextProps = {
  children?: React.Node,
};

type SimpleLinkProps = {
  href?: string,
  title?: string,
  embed?: boolean,
  children?: React.Node,
};

type ImageLinkProps = {
  src: string,
  title?: string,
  alt?: string,
  helpText?: string,
};

type MarkdownProps = {
  strip?: boolean,
  content: ?string,
  simpleLinks?: boolean,
  noDataStore?: boolean,
  className?: string,
  parentCommentId?: string,
  isMarkdownPost?: boolean,
  disableTimestamps?: boolean,
  stakedLevel?: number,
};

// ****************************************************************************
// ****************************************************************************

const SimpleText = (props: SimpleTextProps) => {
  return <span>{props.children}</span>;
};

// ****************************************************************************
// ****************************************************************************

const SimpleLink = (props: SimpleLinkProps) => {
  const { title, children, href, embed } = props;

  if (!href) {
    return children || null;
  }

  if (!href.startsWith('lbry:/')) {
    return (
      <a href={href} title={title} target={'_blank'} rel={'noreferrer noopener'}>
        {children}
      </a>
    );
  }

  const [uri, search] = href.split('?');
  const urlParams = new URLSearchParams(search);
  const embedParam = urlParams.get('embed');

  if (embed || embedParam) {
    // Decode this since users might just copy it from the url bar
    const decodedUri = decodeURI(uri);
    return (
      <div className="embed__inline-button embed__inline-button--preview">
        <pre>{decodedUri}</pre>
      </div>
    );
  }

  // Dummy link (no 'href')
  return <a title={title}>{children}</a>;
};

// ****************************************************************************
// ****************************************************************************

const SimpleImageLink = (props: ImageLinkProps) => {
  const { src, title, alt, helpText } = props;

  if (!src) {
    return null;
  }

  if (isEmote(title, src)) {
    return <OptimizedImage src={src} title={title} className="emote" waitLoad loading="lazy" />;
  }

  return (
    <Button
      button="link"
      iconRight={ICONS.EXTERNAL}
      label={title || alt || src}
      title={helpText || title || alt || src}
      className="button--external-link"
      href={src}
    />
  );
};

// ****************************************************************************
// ****************************************************************************

const REPLACE_REGEX = /(<iframe\s+src=["'])(.*?(?=))(["']\s*><\/iframe>)/g;

// ****************************************************************************
// ****************************************************************************

function isStakeEnoughForPreview(stakedLevel: ?number): boolean {
  return !stakedLevel || stakedLevel >= CHANNEL_STAKED_LEVEL_VIDEO_COMMENTS;
}

// ****************************************************************************
// ****************************************************************************

const MarkdownPreview: React.ComponentType<MarkdownProps> = React.memo<MarkdownProps>(function MarkdownPreview(
  props: MarkdownProps
): React.Node {
  const {
    content,
    strip,
    simpleLinks,
    noDataStore,
    className,
    parentCommentId,
    isMarkdownPost,
    disableTimestamps,
    stakedLevel,
  } = props;

  const strippedContent = content
    ? content.replace(REPLACE_REGEX, (iframeHtml) => {
        // Read the legacy embed source without creating an iframe in the page.
        let lbrySrc;
        try {
          let p = parse(iframeHtml);
          const tag = p.getElementsByTagName('iframe');
          const s = tag[0];
          lbrySrc = s && s.getAttribute('src');
        } catch (e) {}

        if (lbrySrc && lbrySrc.startsWith('lbry://')) {
          return lbrySrc;
        }
        return iframeHtml;
      })
    : '';

  const remarkOptions = {
    components: {
      ...(strip ? { p: SimpleText } : {}),
      a: noDataStore
        ? SimpleLink
        : (linkProps) => (
            <MarkdownLink
              {...linkProps}
              parentCommentId={parentCommentId}
              isMarkdownPost={isMarkdownPost}
              simpleLinks={simpleLinks}
              allowPreview={isStakeEnoughForPreview(stakedLevel)}
            />
          ),
      img: (imgProps: ImageLinkProps) =>
        noDataStore ? (
          <div className="file-viewer file-viewer--document">
            <img {...imgProps} />
          </div>
        ) : isStakeEnoughForPreview(stakedLevel) && !isEmote(imgProps.title, imgProps.src) ? (
          <ZoomableImage {...imgProps} />
        ) : (
          <SimpleImageLink src={imgProps.src} alt={imgProps.alt} title={imgProps.title} />
        ),
    },
  };

  // Strip all content and just render text
  if (strip) {
    // Remove new lines and extra space
    return (
      <span dir="auto" className="markdown-preview">
        {
          markdownProcessor({ strip: true })
            .use(markdownRenderer, remarkOptions)
            .processSync(content || '').result
        }
      </span>
    );
  }

  return (
    <div dir="auto" className={classnames('markdown-preview', className)}>
      {
        markdownProcessor({ disableTimestamps: disableTimestamps || isMarkdownPost })
          .use(markdownRenderer, remarkOptions)
          .processSync(strippedContent).result
      }
    </div>
  );
});

export default MarkdownPreview;
