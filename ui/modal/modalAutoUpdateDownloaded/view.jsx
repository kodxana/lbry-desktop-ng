// @flow
import React, { useState, useEffect, useRef } from 'react';
// @if TARGET='app'
import { requestUpdater } from 'util/updater-client';
// @endif
import { Modal } from 'modal/modal';
import LastReleaseChanges from 'component/lastReleaseChanges';

type Props = {
  closeModal: (any) => any,
  declineAutoUpdate: () => any,
  errorWhileUpdating: boolean,
  isDownloading: boolean,
  isUpdateAvailable: boolean,
  isInstalling: boolean,
};

const ModalAutoUpdateDownloaded = (props: Props) => {
  const { closeModal, declineAutoUpdate, errorWhileUpdating, isDownloading, isUpdateAvailable, isInstalling } = props;
  const [waitingForAutoUpdateResponse, setWaitingForAutoUpdateResponse] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const handleConfirm = async () => {
    if (waitingForAutoUpdateResponse || declining || isDownloading || isInstalling || !isUpdateAvailable) return;
    setWaitingForAutoUpdateResponse(true);
    setRequestError(false);
    const result = await requestUpdater('accept');
    if (mounted.current) {
      setWaitingForAutoUpdateResponse(false);
      setRequestError(!result.ok);
    }
  };

  const handleAbort = async () => {
    if (isInstalling || declining) return;
    setDeclining(true);
    setRequestError(false);
    const result = await declineAutoUpdate();
    if (mounted.current) {
      setDeclining(false);
      if (result.ok) closeModal();
      else setRequestError(true);
    }
  };

  return (
    <Modal
      isOpen
      type="confirm"
      contentLabel={__('Upgrade Downloaded')}
      title={__('LBRY leveled up')}
      confirmButtonLabel={isInstalling ? __('Installing...') : isDownloading ? __('Downloading...') : __('Upgrade Now')}
      abortButtonLabel={isDownloading ? __('Keep browsing') : __('Not Now')}
      confirmButtonDisabled={
        !isUpdateAvailable || isDownloading || isInstalling || declining || waitingForAutoUpdateResponse
      }
      abortButtonDisabled={isInstalling || declining}
      onConfirmed={handleConfirm}
      onAborted={handleAbort}
    >
      <LastReleaseChanges />
      {(errorWhileUpdating || requestError) && <p>{__('There was an error while updating. Please try again.')}</p>}
    </Modal>
  );
};

export default ModalAutoUpdateDownloaded;
