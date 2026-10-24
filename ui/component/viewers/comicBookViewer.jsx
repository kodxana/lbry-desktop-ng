// @flow
import * as React from 'react';
import OpenSeadragon from 'openseadragon';
import { MenuItemCheckbox } from '@ariakit/react';
import { Menu, MenuButton, MenuList } from 'component/common/menu';
import Button from 'component/button';
import LoadingScreen from 'component/common/loading-screen';
import { readComic } from 'util/comic-archive';

type ReadFile = () => Promise<Uint8Array>;
type Props = { source: { file: ReadFile }, theme: string };
type ComicViewer = {
  world: {
    getItemCount: () => number,
    getItemAt: (number) => {
      setHeight: (number, boolean) => void,
      setPosition: ({ x: number, y: number, ... }, boolean) => void,
      getBounds: () => { width: number, ... },
    },
  },
  viewport: {
    goHome: (boolean) => void,
    getZoom: () => number,
    getHomeZoom: () => number,
    getMinZoom: () => number,
    getMaxZoom: () => number,
    zoomTo: (number, null, boolean) => void,
    zoomBy: (number) => void,
    applyConstraints: (?boolean) => void,
  },
  addHandler: (string, () => void) => void,
  removeHandler: (string, () => void) => void,
  open: (Array<{ type: string, url: string }>) => void,
};

function ComicPages({ urls, theme }: { urls: Array<string>, theme: string }): React.Node {
  const root = React.useRef<HTMLDivElement | null>(null);
  const canvas = React.useRef<HTMLDivElement | null>(null);
  const viewer = React.useRef<ComicViewer | null>(null);
  const [page, setPage] = React.useState(0);
  const [pageInput, setPageInput] = React.useState('1');
  const [zoom, setZoom] = React.useState('100');
  const [book, setBook] = React.useState(false);
  const [manga, setManga] = React.useState(false);
  const [pinned, setPinned] = React.useState(true);
  const [dark, setDark] = React.useState(theme === 'dark');
  const [fullscreen, setFullscreen] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [fullscreenError, setFullscreenError] = React.useState(false);
  React.useEffect(() => setDark(theme === 'dark'), [theme]);
  React.useEffect(() => setPageInput(String(page + 1)), [page]);

  React.useLayoutEffect(() => {
    const instance = OpenSeadragon({
      element: canvas.current,
      drawer: 'canvas',
      showNavigationControl: false,
      showSequenceControl: false,
      animationTime: 0,
      blendTime: 0,
      maxZoomPixelRatio: 4,
      visibilityRatio: 1,
      constrainDuringPan: true,
    });
    viewer.current = instance;
    // The reader handles page shortcuts; the viewer still handles pointer pan/zoom.
    instance.innerTracker.keyHandler = null;
    instance.innerTracker.keyDownHandler = null;
    const updateZoom = () =>
      setZoom(String(Math.round((100 * instance.viewport.getZoom()) / instance.viewport.getHomeZoom())));
    instance.addHandler('zoom', updateZoom);
    instance.addHandler('open-failed', () => setError(true));
    return () => {
      instance.destroy();
      viewer.current = null;
    };
  }, []);

  React.useEffect(() => {
    const instance = viewer.current;
    if (!instance) return;
    setError(false);
    const visible = book && page > 0 ? urls.slice(page, page + 2) : urls.slice(page, page + 1);
    if (manga) visible.reverse();
    const opened = () => {
      let x = 0;
      for (let i = 0; i < instance.world.getItemCount(); i++) {
        const item = instance.world.getItemAt(i);
        item.setHeight(1, true);
        item.setPosition(new OpenSeadragon.Point(x, 0), true);
        x += item.getBounds().width;
      }
      instance.viewport.goHome(true);
      setZoom('100');
    };
    instance.addHandler('open', opened);
    instance.open(visible.map((url) => ({ type: 'image', url })));
    return () => instance.removeHandler('open', opened);
  }, [urls, page, book, manga]);

  const navigate = React.useCallback(
    (index: number): void => {
      if (Number.isInteger(index) && index >= 0 && index < urls.length) setPage(index);
    },
    [urls.length]
  );
  const toggleFullscreen = React.useCallback(async () => {
    setFullscreenError(false);
    try {
      if (document.fullscreenElement === root.current) await document.exitFullscreen();
      else if (root.current) await root.current.requestFullscreen();
    } catch (e) {
      setFullscreenError(true);
    }
  }, []);
  React.useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  React.useEffect(() => {
    const keydown = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.target instanceof Element &&
          event.target.closest('input, textarea, select, button, [contenteditable="true"], [role="menu"]'))
      )
        return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        navigate(page + ((event.key === 'ArrowRight') !== manga ? 1 : -1));
      } else if (event.key === 'f') {
        event.preventDefault();
        toggleFullscreen();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [page, manga, navigate, toggleFullscreen]);
  const changePage = () => {
    navigate(Number(pageInput) - 1);
    setPageInput(String(page + 1));
  };
  const changeZoom = () => {
    const viewport = viewer.current?.viewport;
    if (!viewport) return;
    const value = Number(zoom);
    if (Number.isFinite(value) && value > 0) {
      viewport.zoomTo(
        Math.max(viewport.getMinZoom(), Math.min(viewport.getMaxZoom(), (viewport.getHomeZoom() * value) / 100)),
        null,
        true
      );
      viewport.applyConstraints(true);
    }
    setZoom(String(Math.round((100 * viewport.getZoom()) / viewport.getHomeZoom())));
  };
  return (
    <div
      ref={root}
      className={`comic-viewer${pinned ? '' : ' comic-viewer--unpinned'}`}
      data-theme={dark ? 'dark' : 'light'}
    >
      <div ref={canvas} className="comic-viewer__pages" aria-label={__('Comic pages')} />
      {error && (
        <div className="comic-viewer__error" role="alert">
          {__('This comic page could not be displayed. Try another page.')}
        </div>
      )}
      <div className="comic-viewer__controls">
        <div className="comic-viewer__navigation" dir={manga ? 'rtl' : 'ltr'}>
          <Button
            title={__('Previous page')}
            icon={manga ? 'ChevronRight' : 'ChevronLeft'}
            disabled={page === 0}
            onClick={() => navigate(page - 1)}
          />
          <div className="comic-viewer__navigation" dir="ltr">
            <input
              type="number"
              min="1"
              max={urls.length}
              step="1"
              aria-label={__('Go to page number')}
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={changePage}
              onKeyDown={(event) => {
                if (event.key === 'Enter') changePage();
              }}
            />
            <span aria-live="polite">{__('of %total%', { total: urls.length })}</span>
          </div>
          <Button
            title={__('Next page')}
            icon={manga ? 'ChevronLeft' : 'ChevronRight'}
            disabled={page === urls.length - 1}
            onClick={() => navigate(page + 1)}
          />
        </div>
        <input
          className="comic-viewer__slider"
          type="range"
          min="1"
          max={urls.length}
          step="1"
          dir={manga ? 'rtl' : 'ltr'}
          aria-label={__('Comic page')}
          value={page + 1}
          onChange={(event) => navigate(Number(event.target.value) - 1)}
        />
        <Button
          title={__('Zoom out')}
          aria-label={__('Zoom out')}
          label="−"
          onClick={() => {
            const viewport = viewer.current?.viewport;
            if (viewport) {
              viewport.zoomBy(1 / 1.3);
              viewport.applyConstraints();
            }
          }}
        />
        <input
          type="number"
          min="1"
          aria-label={__('Zoom to percentage value')}
          value={zoom}
          onChange={(event) => setZoom(event.target.value)}
          onBlur={changeZoom}
          onKeyDown={(event) => {
            if (event.key === 'Enter') changeZoom();
          }}
        />
        <span>%</span>
        <Button
          title={__('Zoom in')}
          aria-label={__('Zoom in')}
          label="+"
          onClick={() => {
            const viewport = viewer.current?.viewport;
            if (viewport) {
              viewport.zoomBy(1.3);
              viewport.applyConstraints();
            }
          }}
        />
        <Button title={__('Fit pages')} icon="RefreshCw" onClick={() => viewer.current?.viewport.goHome(true)} />
        <Button
          title={book ? __('Page view') : __('Book view')}
          icon="Layout"
          aria-pressed={book}
          onClick={() => setBook(!book)}
        />
        <Menu>
          <MenuButton render={<Button title={__('Reader settings')} icon="Settings" />} />
          <MenuList portal={false} className="comic-viewer__settings">
            <MenuItemCheckbox className="menu__item" name="manga" checked={manga} onChange={() => setManga(!manga)}>
              {__('Manga mode')}
            </MenuItemCheckbox>
            <MenuItemCheckbox className="menu__item" name="dark" checked={dark} onChange={() => setDark(!dark)}>
              {__('Dark theme')}
            </MenuItemCheckbox>
            <MenuItemCheckbox className="menu__item" name="pinned" checked={pinned} onChange={() => setPinned(!pinned)}>
              {__('Pin toolbar')}
            </MenuItemCheckbox>
          </MenuList>
        </Menu>
        <Button
          title={fullscreen ? __('Exit fullscreen') : __('Fullscreen')}
          icon={fullscreen ? 'X' : 'Maximize'}
          onClick={toggleFullscreen}
        />
      </div>
      {fullscreenError && <div role="alert">{__('Fullscreen is unavailable. You can continue reading here.')}</div>}
    </div>
  );
}

export default function ComicBookViewer({ source, theme }: Props): React.Node {
  const [state, setState] = React.useState<{ readFile: ?ReadFile, urls: ?Array<string>, error: ?string }>({
    readFile: null,
    urls: null,
    error: null,
  });
  const readFile = source.file;
  React.useEffect(() => {
    const abort = new AbortController();
    let urls: Array<string> = [];
    (async () => {
      try {
        const bytes = await readFile();
        urls = await readComic(bytes, abort.signal);
        if (!abort.signal.aborted) setState({ readFile, urls, error: null });
        else urls.forEach((url) => URL.revokeObjectURL(url));
      } catch (error) {
        if (!abort.signal.aborted) setState({ readFile, urls: null, error: error.message });
      }
    })();
    return () => {
      abort.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [readFile]);
  const current = state.readFile === readFile;
  return (
    <div className="file-render__viewer file-render__viewer--comic">
      {current && state.error ? (
        <LoadingScreen
          status={__("Sorry, looks like we can't load the archive.") + ' ' + (state.error || '')}
          spinner={false}
        />
      ) : current && state.urls ? (
        <ComicPages key={state.urls[0]} urls={state.urls} theme={theme} />
      ) : (
        <LoadingScreen status={__('Loading')} isDocument />
      )}
    </div>
  );
}
