// @flow
import type { Node } from 'react';
import React from 'react';
import Yrbl from 'component/yrbl';
import Button from 'component/button';
import { withDesktopRouter } from 'component/common/desktop-router';
import analytics from 'analytics';
import I18nMessage from 'component/i18nMessage';
import Native from 'native';
import Lbry from 'lbry';

type Props = {
  children: Node,
  history: {
    replace: (string) => void,
  },
};

type State = {
  hasError: boolean,
  desktopErrorReported: boolean,
};

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, desktopErrorReported: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    // @if TARGET='app'
    let errorMessage = 'Uncaught error\n';
    Native.getAppVersionInfo().then(({ localVersion }) => {
      Lbry.version().then(({ lbrynet_version: sdkVersion }) => {
        errorMessage += `app version: ${localVersion}\n`;
        errorMessage += `sdk version: ${sdkVersion}\n`;
        errorMessage += `page: ${window.location.href.split('.html')[1]}\n`;
        errorMessage += `${error.stack}`;
        analytics.error(errorMessage).then((isSharingData) => {
          this.setState({ desktopErrorReported: isSharingData });
        });
      });
    });
    // @endif
  }

  refresh = (): void => {
    const { history } = this.props;

    // use history.replace instead of history.push so the user can't click back to the errored page
    history.replace('/');
    this.setState({ hasError: false });
  };

  render(): React.Node {
    const { hasError } = this.state;
    const { desktopErrorReported } = this.state;

    const errorWasReported = desktopErrorReported;

    if (hasError) {
      return (
        <div className="main main--full-width main--empty">
          <Yrbl
            type="sad"
            title={__('Aw shucks!')}
            subtitle={
              <I18nMessage
                tokens={{
                  refreshing_the_app_link: (
                    <Button
                      button="link"
                      className="load-screen__button"
                      label={__('refreshing the app')}
                      onClick={this.refresh}
                    />
                  ),
                }}
              >
                There was an error. Try %refreshing_the_app_link% to fix it. If that doesn't work, try pressing
                Ctrl+R/Cmd+R.
              </I18nMessage>
            }
          />
          {!errorWasReported && (
            <div className="error__wrapper">
              <span className="error__text">
                {__('You are not currently sharing diagnostic data so this error was not reported.')}
              </span>
            </div>
          )}

          {errorWasReported && (
            <div className="error__wrapper">
              {/* @if TARGET='app' */}
              <span className="error__text">{__('This error was reported and will be fixed.')}</span>
              {/* @endif */}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

const RoutedErrorBoundary: React.ComponentType<Omit<Props, 'history' | 'location'>> =
  withDesktopRouter<Props>(ErrorBoundary);
export default RoutedErrorBoundary;
