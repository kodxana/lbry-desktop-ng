// @flow
import * as React from 'react';
import desktop from 'util/desktop';
import Button from 'component/button';
import CopyableText from 'component/copyableText';
import Card from 'component/common/card';
import I18nMessage from 'component/i18nMessage';

type Props = {
  daemonSettings?: {
    wallet_dir?: ?string,
  },
};

type State = {
  errorMessage: ?string,
  successMessage: ?string,
  pending: boolean,
};

class WalletBackup extends React.PureComponent<Props, State> {
  mounted: boolean | void;
  backupPending: string | false | void;
  constructor(props: Props) {
    super(props);

    this.state = {
      errorMessage: null,
      successMessage: null,
      pending: false,
    };
  }

  showErrorMessage(message: string) {
    this.setState({ errorMessage: message });
  }

  showSuccessMessage(message: string) {
    this.setState({ successMessage: message });
  }

  clearMessages() {
    this.setState({ errorMessage: null, successMessage: null });
  }

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
    if (this.backupPending) desktop.cancelBackup(this.backupPending);
  }

  componentDidUpdate(previous: Props) {
    if (
      this.backupPending &&
      (previous.daemonSettings || {}).wallet_dir !== (this.props.daemonSettings || {}).wallet_dir
    ) {
      desktop.cancelBackup(this.backupPending);
    }
  }

  async backupWalletDir(lbryumWalletDir: ?string) {
    if (this.backupPending) return;
    this.clearMessages();
    if (!lbryumWalletDir) {
      this.showErrorMessage(__('No wallet folder was found.'));
      return;
    }
    const requestId = crypto.randomUUID();
    this.backupPending = requestId;
    this.setState({ pending: true });
    try {
      const result = await desktop.backupWallet({ id: requestId, directory: lbryumWalletDir });
      if (!this.mounted || (this.props.daemonSettings || {}).wallet_dir !== lbryumWalletDir) return;
      if (result.ok) this.showSuccessMessage(__('Saved zip archive to %outputPath%', { outputPath: result.path }));
      else if (result.error === 'archive')
        this.showErrorMessage(__('The wallet folder could not be added to the zip archive.'));
      else if (result.error === 'write')
        this.showErrorMessage(__('There was a problem writing the zip archive to disk.'));
      else this.showErrorMessage(__('The wallet folder could not be determined. Please try again.'));
    } catch (_) {
      if (this.mounted) this.showErrorMessage(__('The wallet folder could not be determined. Please try again.'));
    } finally {
      this.backupPending = false;
      if (this.mounted) this.setState({ pending: false });
    }
  }
  render(): React.Node {
    const { daemonSettings = {} } = this.props;
    const { wallet_dir: lbryumWalletDir } = daemonSettings;

    return (
      <Card
        title={__('Backup your LBRY wallet')}
        subtitle={
          <ul>
            <li>
              {__(
                'Your LBRY Credits, channels, and publishes are controllable by you and only you, via wallet file(s) stored locally on your computer.'
              )}
            </li>
            <li>
              {__(
                'If Sync is on, LBRY will backup your wallet and preferences. If disabled, you are responsible for keeping a backup.'
              )}
            </li>
            <li>
              {__(
                'However, it is easy to back up manually. To backup your wallet, make a copy of the folder listed below:'
              )}
            </li>
          </ul>
        }
        actions={
          <React.Fragment>
            <CopyableText copyable={lbryumWalletDir} snackMessage={__('Path copied.')} />
            <p className="help">
              <I18nMessage
                tokens={{
                  helpLink: (
                    <Button
                      button="link"
                      href="https://lbry.com/faq/how-to-backup-wallet"
                      label={__('see this article')}
                    />
                  ),
                }}
              >
                Access to these files are equivalent to having access to your Credits, channels, and publishes. Keep any
                copies you make of your wallet in a secure place. For more details on backing up and best practices
                %helpLink%.
              </I18nMessage>
            </p>
            <p className={'card__message card__message--error' + (this.state.errorMessage ? '' : ' hidden')}>
              {this.state.errorMessage}
            </p>
            <p className={'card__message card__message--success' + (this.state.successMessage ? '' : ' hidden')}>
              {this.state.successMessage}
            </p>
            <div className="card__actions">
              <Button
                button="primary"
                label={__('Create Backup')}
                disabled={this.state.pending}
                onClick={() => this.backupWalletDir(lbryumWalletDir)}
              />
              <Button button="link" label={__('Open Folder')} onClick={() => desktop.openWalletFolder()} />
            </div>
          </React.Fragment>
        }
      />
    );
  }
}

export default WalletBackup;
