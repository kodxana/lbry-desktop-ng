// @flow
import React from 'react';
import desktop from 'util/desktop';
import classnames from 'classnames';

type Props = {};

type State = {
  hoverUrl: string,
  show: boolean,
};

class StatusBar extends React.PureComponent<Props, State> {
  unsubscribe: ?() => void;

  constructor(props: Props) {
    super(props);
    this.state = {
      hoverUrl: '',
      show: false,
    };
  }

  componentDidMount() {
    this.unsubscribe = desktop.onTargetUrl(this.handleUrlChange);
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
  }

  handleUrlChange = (url: string): void => {
    // We want to retain the previous URL so that it can fade out
    // without the component collapsing.
    if (url === '') {
      this.setState({ show: false });
    } else {
      this.setState({ show: true });
      this.setState({ hoverUrl: url });
    }
  };

  render(): React.Node {
    const { hoverUrl, show } = this.state;
    return <div className={classnames('status-bar', { visible: show })}>{decodeURI(hoverUrl)}</div>;
  }
}

export default StatusBar;
