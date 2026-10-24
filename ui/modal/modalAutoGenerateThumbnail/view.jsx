// @flow
import React, { useRef } from 'react';
import { Modal } from 'modal/modal';
import { formatFileSystemPath } from 'util/url';

type Props = {
  upload: (File) => void,
  filePath: string,
  closeModal: () => void,
  showToast: (ToastParams) => void,
};

function ModalAutoGenerateThumbnail(props: Props): React.Node {
  const { closeModal, filePath, upload, showToast } = props;
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const videoSrc = formatFileSystemPath(filePath);

  function uploadImage() {
    try {
      const imageBuffer = captureSnapshot();
      if (!imageBuffer) return onError();
      const file = new File([imageBuffer], 'thumbnail.png', { type: 'image/png' });
      upload(file);
      closeModal();
    } catch (_) {
      onError();
    }
  }

  function captureSnapshot(): ArrayBuffer | void {
    const player = playerRef.current;
    if (!player || !player.videoWidth || !player.videoHeight) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = player.videoWidth;
    canvas.height = player.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(player, 0, 0, canvas.width, canvas.height);
    const dataURL = canvas.toDataURL();
    const rawData = atob(dataURL.replace(/data:image\/\w+;base64,/i, ''));
    canvas.remove();
    const bytes = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
    return bytes.buffer;
  }

  function resize(): void {
    const player = playerRef.current;
    if (!player || !player.videoWidth || !player.videoHeight) {
      return;
    }

    const fixedWidth = 450;
    const videoWidth = player.videoWidth;
    const videoHeight = player.videoHeight;
    player.width = fixedWidth;
    player.height = Math.floor(videoHeight * (fixedWidth / videoWidth));
  }

  function onError(): void {
    showToast({ isError: true, message: __("Something didn't work. Please try again.") });
  }

  return (
    <Modal
      isOpen
      title={__('Upload thumbnail')}
      contentLabel={__('Confirm Thumbnail Upload')}
      type="confirm"
      confirmButtonLabel={__('Upload')}
      onConfirmed={uploadImage}
      onAborted={closeModal}
    >
      <p className="section__subtitle">{__('Pause at any time to select a thumbnail from your video')}.</p>
      <video ref={playerRef} src={videoSrc} onLoadedMetadata={resize} onError={onError} controls />
    </Modal>
  );
}

export default ModalAutoGenerateThumbnail;
