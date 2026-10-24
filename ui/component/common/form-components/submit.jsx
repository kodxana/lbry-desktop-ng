// @flow
import * as React from 'react';
import Button from 'component/button';

type Props = {
  label: string,
  disabled: boolean,
};

export class Submit extends React.PureComponent<Props> {
  static defaultProps: { label: string } = {
    label: 'Submit',
  };

  render(): React.Node {
    const { label, disabled, ...otherProps } = this.props;
    return <Button button="primary" type="submit" label={label} disabled={disabled} {...otherProps} />;
  }
}

export default Submit;
