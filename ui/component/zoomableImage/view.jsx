// @flow
import React from 'react';
import * as MODALS from 'constants/modal_types';

type Props = {
  src: string,
  title?: string,
  alt?: string,
  openModal: (string, { src: string, title?: string }) => void,
};

function ZoomableImage(props: Props): React.Node {
  const { openModal, ...imgProps } = props;

  const onClick = () => {
    openModal(MODALS.VIEW_IMAGE, { src: imgProps.src, title: imgProps.title || imgProps.alt });
  };

  return <img className="img__zoomable" {...imgProps} onClick={onClick} />;
}

export default ZoomableImage;
