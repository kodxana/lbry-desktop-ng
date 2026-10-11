// @flow
import type { Node } from 'react';
import * as MODALS from 'constants/modal_types';
import * as ICONS from 'constants/icons';
import React from 'react';
import Lbry from 'lbry';
import Button from 'component/button';
import ModalWalletUnlock from 'modal/modalWalletUnlock';
import ModalIncompatibleDaemon from 'modal/modalIncompatibleDaemon';
import ModalUpgrade from 'modal/modalUpgrade';
import ModalDownloading from 'modal/modalDownloading';
import Card from 'component/common/card';
import I18nMessage from 'component/i18nMessage';
import 'css-doodle';

const FORTY_FIVE_SECONDS = 45 * 1000;
const UPDATE_INTERVAL = 1000; // 1 second
const MAX_SYNC_WAIT = 45; // 45 seconds to sync wallet, show message if taking long

type Props = {
  checkDaemonVersion: () => Promise<any>,
  notifyUnlockWallet: (?boolean) => Promise<any>,
  daemonVersionMatched: boolean,
  onReadyToLaunch: () => void,
  hideModal: () => void,
  modal: ?{
    id: string,
  },
  animationHidden: boolean,
  toggleSplashAnimation: () => void,
  onChooseHub: () => void,
};

type State = {
  details: string | Node,
  message: string,
  launchedModal: boolean,
  error: boolean,
  isRunning: boolean,
  launchWithIncompatibleDaemon: boolean,
  waitingForSync: number,
};

export default class SplashScreen extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      details: __('Starting...'),
      message: __('Connecting'),
      launchedModal: false,
      error: false,
      launchWithIncompatibleDaemon: !process.env.NODE_ENV === 'production',
      isRunning: false,
      waitingForSync: 0,
    };

    (this: any).renderModals = this.renderModals.bind(this);
    (this: any).runWithIncompatibleDaemon = this.runWithIncompatibleDaemon.bind(this);
    this.timeout = undefined;
  }

  componentDidMount() {
    this.active = true;
    const { checkDaemonVersion } = this.props;
    this.adjustErrorTimeout();

    Lbry.connect()
      .then(checkDaemonVersion)
      .then(() => {
        if (this.active) this.updateStatus();
      })
      .catch(() => {
        if (!this.active) return;
        this.setState({
          message: __('Connection Failure'),
          details: __(
            'Could not connect to the local SDK. You can choose another hub or restart the app.'
          ),
        });
      });
  }

  componentDidUpdate() {
    this.adjustErrorTimeout();
  }

  componentWillUnmount() {
    this.active = false;
    clearTimeout(this.pollTimeout);
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }

  adjustErrorTimeout() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    // Every time we make it to a new step in the daemon startup process, reset the timer
    // If nothing changes after 1 minute, show the error message.
    this.timeout = setTimeout(() => {
      this.setState({ error: true });
    }, FORTY_FIVE_SECONDS);
  }

  async updateStatus() {
    if (!this.active) return;
    const { modal, notifyUnlockWallet } = this.props;
    const { launchedModal } = this.state;
    try {
      const sdkStatus = await Lbry.status();
      if (!this.active) return;
      const { wallet } = sdkStatus;
      let walletStatus;
      try { walletStatus = await Lbry.wallet_status() } catch (error) {
        // wallet_status requires the wallet component to finish starting.
        if (sdkStatus.is_running) throw error;
        walletStatus = { is_syncing: Boolean(wallet && wallet.available_servers), is_locked: false };
      }
      if (!this.active) return;
      if (sdkStatus.is_running && wallet && wallet.available_servers) {
        if (walletStatus.is_locked) {
          // Clear the error timeout while waiting for the wallet password.
          if (this.timeout) {
            clearTimeout(this.timeout);
          }
          this.updateStatusCallback(sdkStatus, walletStatus, true);
          if (launchedModal === false && !modal) {
            this.setState({ launchedModal: true }, () => notifyUnlockWallet());
          }
        } else {
          this.updateStatusCallback(sdkStatus, walletStatus);
        }
      } else {
        if (!sdkStatus.is_running && walletStatus.is_syncing && this.timeout) {
          clearTimeout(this.timeout);
        }
        this.updateStatusCallback(sdkStatus, walletStatus);
      }
    } catch (_) {
      if (!this.active) return;
      this.setState({ details: __('Waiting for the wallet connection. You can choose another hub below.') });
      this.schedulePoll();
    }
  }

  schedulePoll() {
    if (!this.active) return;
    clearTimeout(this.pollTimeout);
    this.pollTimeout = setTimeout(() => this.updateStatus(), UPDATE_INTERVAL);
  }

  updateStatusCallback(status: StatusResponse, walletStatus: WalletStatusResponse, waitingForUnlock: boolean = false) {
    const { wallet, startup_status: startupStatus } = status;

    // If the wallet is locked, stop doing anything and make the user input their password
    if (startupStatus && wallet && wallet.available_servers < 1) {
      this.setState({ details: __('Connecting to a wallet hub. You can choose another hub below.') });
    } else if (status.is_running && !waitingForUnlock) {
      Lbry.resolve({ urls: 'lbry://one' }).then(() => {
        if (this.active) this.setState({ isRunning: true }, () => this.continueAppLaunch());
      }).catch(() => this.schedulePoll());

      return;
    } else if (wallet && !status.is_running && walletStatus.is_syncing) {
      this.setState({ waitingForSync: this.state.waitingForSync + UPDATE_INTERVAL / 1000 });
      if (this.state.waitingForSync < MAX_SYNC_WAIT) {
        this.setState({
          message: __('Loading Wallet'),
          details: __('Updating wallet data...'),
        });
      } else {
        this.setState({
          message: __('Loading Wallet'),
          details: (
            <React.Fragment>
              <div>{__('Synchronizing wallet headers and history')}</div>
              <div>{__('Please wait...')}</div>
            </React.Fragment>
          ),
        });
      }
    } else if (wallet && !status.is_running && startupStatus.database) {
      this.setState({
        message: __('Finalizing'),
        details: __('Almost ready...'),
      });
    }

    this.schedulePoll();
  }

  runWithIncompatibleDaemon() {
    const { hideModal } = this.props;
    hideModal();
    this.setState({ launchWithIncompatibleDaemon: true }, () => this.continueAppLaunch());
  }

  continueAppLaunch() {
    const { daemonVersionMatched, onReadyToLaunch } = this.props;
    const { isRunning, launchWithIncompatibleDaemon } = this.state;

    if (daemonVersionMatched) {
      onReadyToLaunch();
    } else if (launchWithIncompatibleDaemon && isRunning) {
      // The user may have decided to run the app with mismatched daemons
      // They could make this decision before the daemon is finished starting up
      // If it isn't running, this function will be called after the daemon is started
      onReadyToLaunch();
    }
  }

  timeout: ?TimeoutID;
  pollTimeout: ?TimeoutID;
  active: boolean;

  renderModals() {
    const { modal } = this.props;
    const modalId = modal && modal.id;

    if (!modalId) {
      return null;
    }

    switch (modalId) {
      case MODALS.INCOMPATIBLE_DAEMON:
        return <ModalIncompatibleDaemon onContinueAnyway={this.runWithIncompatibleDaemon} />;
      case MODALS.WALLET_UNLOCK:
        return <ModalWalletUnlock />;
      case MODALS.UPGRADE:
        return <ModalUpgrade />;
      case MODALS.DOWNLOADING:
        return <ModalDownloading />;
      default:
        return null;
    }
  }

  render() {
    const { error, details } = this.state;
    const { animationHidden, toggleSplashAnimation, onChooseHub, modal } = this.props;

    return (
      <div className="splash">
        {!error && (
          <>
            <h1 className="splash__title">LBRY</h1>
            <div className="splash__details">{details}</div>
          </>
        )}
        {!modal && <Button button="primary" className="splash__hub-choice" label={__('Choose another hub')} onClick={onChooseHub} />}

        {!animationHidden && !error && (
          <css-doodle class="doodle">
            {`
            --color: @p(var(--color-primary), var(--color-secondary), var(--color-focus), var(--color-nothing));
            :doodle {
              @grid: 30x1 / 18vmin;
              --deg: @p(-180deg, 180deg);
            }
            :container {
              perspective: 30vmin;
            }

            @place-cell: center;
            @size: 100%;

            box-shadow: @m2(0 0 50px var(--color));
            will-change: transform, opacity;
            animation: scale-up 12s linear infinite;
            animation-delay: calc(-12s / @size() * @i());

            @keyframes scale-up {
              0%, 95.01%, 100% {
                transform: translateZ(0) rotate(0);
                opacity: 0;
              }
              10% {
                opacity: 1;
              }
              95% {
                transform:
                  translateZ(35vmin) rotateZ(@var(--deg));
              }
            }
          )
          `}
          </css-doodle>
        )}
        {!error && (
          <Button
            className="splash__animation-toggle"
            label={!animationHidden ? __('I feel woosy! Stop spinning!') : __('Spin Spin Sugar')}
            onClick={() => toggleSplashAnimation()}
          />
        )}
        {error && (
          <Card
            title={<h1 className="splash__error-title">{__('Error starting up')}</h1>}
            subtitle={
              <React.Fragment>
                <p>
                  {__(
                    'You can try refreshing to fix it. If you still have issues, your anti-virus software or firewall may be preventing startup.'
                  )}
                </p>
                <p>
                  <I18nMessage
                    tokens={{
                      help_link: (
                        <Button
                          button="link"
                          href="https://github.com/kodxana/lbry-desktop-ng/issues"
                          label={__('community issue tracker')}
                        />
                      ),
                    }}
                  >
                    You can choose another hub or report the problem in the %help_link%.
                  </I18nMessage>
                </p>
              </React.Fragment>
            }
            actions={
              <Button
                button="primary"
                icon={ICONS.REFRESH}
                label={__('Refresh')}
                onClick={() => window.location.reload()}
              />
            }
          />
        )}
        {/* Temp hack: don't show any modals on splash screen daemon is running;
            daemon doesn't let you quit during startup, so the "Quit" buttons
          in the modals won't work. */}
        {this.renderModals()}
      </div>
    );
  }
}
