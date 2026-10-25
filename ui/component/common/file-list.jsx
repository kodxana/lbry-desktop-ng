// @flow
import React from 'react';
import { v4 as uuid } from 'uuid';

type Props = {
  files: Array<File>,
  onChange: (File | void) => void,
};

function FileList(props: Props): React.Node {
  const { files, onChange } = props;
  const [name] = React.useState(uuid);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const activeIndex = selectedIndex < files.length ? selectedIndex : 0;

  React.useEffect(() => {
    setSelectedIndex(activeIndex);
    onChange(files[activeIndex]);
  }, [activeIndex, files, onChange]);

  return (
    <div className={'file-list'}>
      <div role="radiogroup" aria-label={__('Files')}>
        {files.map((file, index) => (
          <span className="radio" key={index}>
            <input
              type="radio"
              name={name}
              id={`${name}-${index}`}
              value={index}
              checked={activeIndex === index}
              onChange={() => setSelectedIndex(index)}
            />
            <label htmlFor={`${name}-${index}`}>{file.name}</label>
          </span>
        ))}
      </div>
    </div>
  );
}

export default FileList;
