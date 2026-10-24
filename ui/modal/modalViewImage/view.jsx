// @flow
import React from 'react';
import { Modal } from 'modal/modal';
import Lightbox from 'react-awesome-lightbox';
import 'react-awesome-lightbox/style.css';

type Props = {
  src: string,
  title: string,
  closeModal: () => void,
};

export default function ModalMobileSearch(props: Props): React.Node {
  const { src, title, closeModal } = props;

  return (
    <Modal
      onAborted={closeModal}
      isOpen
      type="custom"
      className="modal--image"
      role="presentation"
      shouldCloseOnEsc={false}
    >
      <Lightbox image={src} title={title} onClose={closeModal} portal={false} />
    </Modal>
  );
}
