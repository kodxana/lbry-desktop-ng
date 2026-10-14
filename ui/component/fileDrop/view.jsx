// @flow
import React from 'react';
import * as ICONS from 'constants/icons';
import * as PAGES from 'constants/pages';
import * as MODALS from 'constants/modal_types';
import classnames from 'classnames';
import useDragDrop from 'effects/use-drag-drop';
import { getTree } from 'util/web-file-system';
import { getFilePath } from 'util/file-path';
import { withRouter } from 'react-router';
import Icon from 'component/common/icon';
import Button from 'component/button';

type Props = {
  modal: { id: string, modalProps: {} },
  filePath: ?string,
  clearPublish: () => void,
  updatePublishForm: ({}) => void,
  openModal: (id: string, { files: Array<File> }) => void,
  // React router
  history: {
    entities: {}[],
    goBack: () => void,
    goForward: () => void,
    index: number,
    length: number,
    location: { pathname: string },
    push: (string) => void,
  },
};

const HIDE_TIME_OUT = 600;
const NAVIGATE_TIME_OUT = 400;
const PUBLISH_URL = `/$/${PAGES.UPLOAD}`;

function FileDrop(props: Props) {
  const { modal, history, openModal, updatePublishForm } = props;
  const { drag, dropData } = useDragDrop();
  const [files, setFiles] = React.useState([]);
  const [error, setError] = React.useState(false);
  const [target, setTarget] = React.useState<?File>(null);
  const hideTimer = React.useRef(null);
  const navigationTimer = React.useRef(null);
  const handledDrop = React.useRef(null);
  const choosingFile = modal && modal.id === MODALS.FILE_SELECTION;

  // Gets respective icon given a mimetype
  const getFileIcon = (type) => {
    // Not all files have a type
    if (!type) return ICONS.FILE;
    // Detect common types
    const contentType = type.split('/')[0];
    if (contentType === 'text') return ICONS.TEXT;
    if (contentType === 'image') return ICONS.IMAGE;
    if (contentType === 'video') return ICONS.VIDEO;
    if (contentType === 'audio') return ICONS.AUDIO;
    // Binary file
    return ICONS.FILE;
  };

  // Navigates user to publish page
  const navigateToPublish = React.useCallback(() => {
    // Navigate only if location is not publish area
    // - Prevents spam in browser history
    if (history.location.pathname !== PUBLISH_URL) {
      history.push(PUBLISH_URL);
    }
  }, [history]);

  // Handle file selection
  const handleFileSelected = React.useCallback(
    (selectedFile) => {
      const filePath = getFilePath(selectedFile);
      if (!filePath) {
        setError(true);
        setFiles([]);
        setTarget(null);
        return;
      }
      // Delay hide and navigation for a smooth transition
      hideTimer.current = setTimeout(() => {
        setFiles([]);
        setTarget(null);
        // Navigate to publish area
        navigationTimer.current = setTimeout(() => {
          // Navigate first, THEN assign filePath, otherwise
          // the file selected will get reset (that's how the
          // publish file view works, when the user switches to
          // publish a file, the pathFile value gets reset to undefined)
          navigateToPublish();
          updatePublishForm({
            filePath,
          });
        }, NAVIGATE_TIME_OUT);
      }, HIDE_TIME_OUT);
    },
    [setFiles, navigateToPublish, updatePublishForm]
  );

  // Clear timers when unmounted
  React.useEffect(() => {
    return () => {
      // Clear hide timer
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      // Clear navigation timer
      if (navigationTimer.current) {
        clearTimeout(navigationTimer.current);
      }
    };
  }, []);

  // Handle file drop...
  React.useEffect(() => {
    let active = true;
    if (dropData && dropData !== handledDrop.current && !choosingFile) {
      handledDrop.current = dropData;
      setError(false);
      setFiles([]);
      setTarget(null);
      clearTimeout(hideTimer.current);
      clearTimeout(navigationTimer.current);
      getTree(dropData)
        .then((entries) => {
          if (!active || !entries) return;
          if (entries.length > 1) {
            openModal(MODALS.FILE_SELECTION, { files: entries });
          } else if (entries.length === 1) {
            setFiles(entries);
            setTarget(entries[0]);
            handleFileSelected(entries[0]);
          }
        })
        .catch((error) => {
          if (active) setError(error || true);
        });
    }
    return () => {
      active = false;
    };
  }, [dropData, choosingFile, openModal, handleFileSelected]);

  // Show icon based on file type
  const icon = target ? getFileIcon(target.type) : ICONS.PUBLISH;
  // Show drop area when files are dragged over or processing dropped file
  const show = error || files.length === 1 || (!target && drag && (!modal || modal.id !== MODALS.FILE_SELECTION));

  return (
    <div aria-hidden={!show} className={classnames('file-drop', show && 'file-drop--show')}>
      <div className={classnames('card', 'file-drop__area')}>
        <Icon size={64} icon={icon} className={'main-icon'} />
        {error ? (
          <>
            <p role="alert">{__('The selected file or folder could not be opened.')}</p>
            <Button button="primary" label={__('Dismiss')} onClick={() => setError(false)} />
          </>
        ) : (
          <p>{target ? target.name : __(`Drop here to publish!`)} </p>
        )}
      </div>
    </div>
  );
}

export default withRouter(FileDrop);
