// @flow
import React from 'react';
import { useRadioState, Radio, RadioGroup } from 'reakit/Radio';

type Props = {
  files: Array<File>,
  onChange: (File | void) => void,
};

type RadioProps = {
  id: string,
  label: string,
};

// Same as FormField type="radio" but it works with reakit:
const ForwardedRadio = React.forwardRef((props: RadioProps, ref) => (
  <span className="radio">
    <input {...props} type="radio" ref={ref} />
    <label htmlFor={props.id}>{props.label}</label>
  </span>
));

function FileList(props: Props) {
  const { files, onChange } = props;
  const radio = useRadioState({ state: '0' });

  React.useEffect(() => {
    onChange(files && files[Number(radio.state)]);
  }, [radio.state, files, onChange]);

  return (
    <div className={'file-list'}>
      <RadioGroup {...radio} aria-label="files">
        {files.map(({ name }, index) => {
          return <Radio key={index} {...radio} value={String(index)} label={name} as={ForwardedRadio} />;
        })}
      </RadioGroup>
    </div>
  );
}

export default FileList;
