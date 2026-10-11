// @flow
import * as MODALS from 'constants/modal_types';
import React from 'react';
import Lbry from 'lbry';
import Button from 'component/button';
import SetupLayout from 'component/setupLayout';
import Icon from 'component/common/icon';
import * as ICONS from 'constants/icons';
import { startupProgress } from 'util/startup-progress';
import ModalWalletUnlock from 'modal/modalWalletUnlock';
import ModalIncompatibleDaemon from 'modal/modalIncompatibleDaemon';
import ModalUpgrade from 'modal/modalUpgrade';
import ModalDownloading from 'modal/modalDownloading';

const PROGRESS_WAIT = 45 * 1000;
const UPDATE_INTERVAL = 1000;

type Props = {
  checkDaemonVersion: () => Promise<any>,
  notifyUnlockWallet: (?boolean) => Promise<any>,
  daemonVersionMatched: boolean,
  onReadyToLaunch: () => void,
  hideModal: () => void,
  modal: ?{ id: string },
  onChooseHub: () => void,
};

type State = {
  status: ?StatusResponse,
  waitingForUnlock: boolean,
  connectionFailed: boolean,
  launchedModal: boolean,
  waitingForProgress: boolean,
  isRunning: boolean,
  launchWithIncompatibleDaemon: boolean,
};

export default class SplashScreen extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      status: null,
      waitingForUnlock: false,
      connectionFailed: false,
      launchedModal: false,
      waitingForProgress: false,
      launchWithIncompatibleDaemon: false,
      isRunning: false,
    };
    (this: any).runWithIncompatibleDaemon = this.runWithIncompatibleDaemon.bind(this);
  }

  componentDidMount() {
    this.active = true;
    this.watchProgress('starting');
    Lbry.connect()
      .then(this.props.checkDaemonVersion)
      .then(() => {
        if (this.active) this.updateStatus();
      })
      .catch(() => {
        if (!this.active) return;
        this.setState({ connectionFailed: true });
        this.schedulePoll();
      });
  }

  componentWillUnmount() {
    this.active = false;
    clearTimeout(this.pollTimeout);
    clearTimeout(this.timeout);
  }

  watchProgress(progress: string) {
    if (progress === this.lastProgress) return;
    this.lastProgress = progress;
    clearTimeout(this.timeout);
    this.setState({ waitingForProgress: false });
    this.timeout = setTimeout(() => {
      if (this.active) this.setState({ waitingForProgress: true });
    }, PROGRESS_WAIT);
  }

  async updateStatus() {
    if (!this.active) return;
    const { modal, notifyUnlockWallet } = this.props;
    try {
      const status = await Lbry.status();
      if (!this.active) return;
      let walletStatus;
      try {
        walletStatus = await Lbry.wallet_status();
      } catch (error) {
        // wallet_status is unavailable until the wallet component has started.
        if (status.is_running) throw error;
        walletStatus = { is_locked: false };
      }
      if (!this.active) return;
      const waitingForUnlock = Boolean(walletStatus.is_locked);
      this.updateStatusCallback(status, waitingForUnlock);
      if (waitingForUnlock && !this.state.launchedModal && !modal) {
        this.setState({ launchedModal: true }, () => notifyUnlockWallet());
      }
    } catch (_) {
      if (!this.active) return;
      this.setState({ connectionFailed: true });
      this.schedulePoll();
    }
  }

  schedulePoll() {
    if (!this.active) return;
    clearTimeout(this.pollTimeout);
    this.pollTimeout = setTimeout(() => this.updateStatus(), UPDATE_INTERVAL);
  }

  updateStatusCallback(status: StatusResponse, waitingForUnlock: boolean = false) {
    const { wallet } = status;
    this.watchProgress(
      JSON.stringify([
        status.is_running,
        status.startup_status,
        waitingForUnlock,
        wallet && wallet.connected,
        wallet && wallet.blocks,
        wallet && wallet.blocks_behind,
        wallet && wallet.headers_synchronization_progress,
      ])
    );
    this.setState({ status, waitingForUnlock, connectionFailed: false });
    if (waitingForUnlock) {
      clearTimeout(this.timeout);
    } else if (status.is_running && wallet && wallet.available_servers) {
      Lbry.resolve({ urls: 'lbry://one' })
        .then(() => {
          if (this.active) this.setState({ isRunning: true }, () => this.continueAppLaunch());
        })
        .catch(() => this.schedulePoll());
      return;
    }
    this.schedulePoll();
  }

  runWithIncompatibleDaemon() {
    this.props.hideModal();
    this.setState({ launchWithIncompatibleDaemon: true }, () => this.continueAppLaunch());
  }

  continueAppLaunch() {
    const { daemonVersionMatched, onReadyToLaunch } = this.props;
    const { isRunning, launchWithIncompatibleDaemon } = this.state;
    if (daemonVersionMatched || (launchWithIncompatibleDaemon && isRunning)) onReadyToLaunch();
  }

  timeout: ?TimeoutID;
  pollTimeout: ?TimeoutID;
  active: boolean;
  lastProgress: ?string;

  renderModals() {
    const { modal } = this.props;
    switch (modal && modal.id) {
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
    const { status, waitingForUnlock, connectionFailed, waitingForProgress } = this.state;
    const { onChooseHub, modal } = this.props;
    const progress = startupProgress(status, waitingForUnlock);
    const steps = [__('Connect to the network'), __('Sync wallet headers and history'), __('Open LBRY')];
    return (
      <SetupLayout>
        <section className="wallet-startup">
          <h1 className="section__title--large">{__('Connecting to LBRY')}</h1>
          <div className="wallet-startup__status" role="status">
            <h2 className="section__subtitle">
              {connectionFailed ? __('Waiting for the local wallet') : progress.title}
            </h2>
            <p>
              {connectionFailed
                ? __('The app is retrying the connection. You can return to hub selection if this continues.')
                : progress.detail}
            </p>
          </div>
          <ol className="wallet-startup__steps ul--no-style" aria-label={__('Wallet startup')}>
            {steps.map((label, index) => (
              <li
                key={label}
                className={index === progress.step ? 'is-current' : index < progress.step ? 'is-complete' : ''}
                aria-current={index === progress.step ? 'step' : undefined}
              >
                <span aria-hidden="true">
                  <Icon icon={index < progress.step ? ICONS.COMPLETE : ICONS.NOT_COMPLETED} size={16} />
                </span>
                {label}
              </li>
            ))}
          </ol>
          {progress.percent !== null && !connectionFailed && (
            <div className="wallet-startup__progress">
              <div>
                <label htmlFor="wallet-headers-progress">{__('Wallet headers')}</label>
                <span>{progress.percent}%</span>
              </div>
              <progress id="wallet-headers-progress" max="100" value={progress.percent} />
              <p className="help">
                {progress.percent === 100
                  ? __('Headers are up to date. Wallet history and other startup checks may still be running.')
                  : __('This measures header sync, not the whole setup.')}
              </p>
            </div>
          )}
          {progress.hub && !connectionFailed && (
            <p className="wallet-startup__connection help">
              {__('Connected hub')}: {progress.hub}
            </p>
          )}
          {waitingForProgress && !waitingForUnlock && !connectionFailed && (
            <p className="wallet-startup__notice" role="status">
              {__(
                'No new progress reported recently. You can keep waiting or try another hub. Your wallet stays in place.'
              )}
            </p>
          )}
          {!modal && (
            <div className="first-run__actions">
              <Button button="primary" label={__('Choose another hub')} onClick={onChooseHub} />
              {connectionFailed && (
                <Button button="link" label={__('Restart screen')} onClick={() => window.location.reload()} />
              )}
            </div>
          )}
          <p className="help">{__('Your wallet stays on this computer. Changing hubs does not move it.')}</p>
        </section>
        {this.renderModals()}
      </SetupLayout>
    );
  }
}
