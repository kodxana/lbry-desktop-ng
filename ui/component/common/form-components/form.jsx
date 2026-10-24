// @flow
import * as React from 'react';

type Props = {
  children: React.Node,
  className?: string,
  onSubmit: (any) => any,
};

export class Form extends React.PureComponent<Props> {
  render(): React.Node {
    const { children, onSubmit, ...otherProps } = this.props;
    return (
      <form
        noValidate
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(event);
        }}
        {...otherProps}
      >
        {children}
      </form>
    );
  }
}

export default Form;
