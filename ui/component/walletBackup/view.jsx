// @flow
import * as React from 'react';
import { shell } from 'electron';
import { getDesktopInfo } from 'util/desktop-info';
import Button from 'component/button';
import CopyableText from 'component/copyableText';
import AdmZip from 'adm-zip';
import path from 'path';
import Card from 'component/common/card';
import I18nMessage from 'component/i18nMessage';

type Props = {
  daemonSettings: {
    wallet_dir: ?string,
  },
};

type State = {
  errorMessage: ?string,
  successMessage: ?string,
  pending: boolean,
};

class WalletBackup extends React.PureComponent<Props, State> {
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
  }

  async backupWalletDir(lbryumWalletDir: ?string) {
    if (this.backupPending) return;
    this.clearMessages();
    if (!lbryumWalletDir) {
      this.showErrorMessage(__('No wallet folder was found.'));
      return;
    }
    this.backupPending = true;
    this.setState({ pending: true });
    try {
      let directory;
      try {
        ({ directory } = await getDesktopInfo('backup-directory'));
      } catch (_) {
        if (this.mounted) this.showErrorMessage(__('The backup location could not be determined. Please try again.'));
        return;
      }
      // Do not write a backup after leaving this page or switching wallets.
      if (!this.mounted || (this.props.daemonSettings || {}).wallet_dir !== lbryumWalletDir) return;
      const filenameTime = new Date().toISOString().replace(/:/g, '-');
      const outputFilename = [path.basename(lbryumWalletDir), '-', filenameTime, '.zip'].join('');
      // Prefer Downloads, then home, then beside the wallet directory. A write
      // failure is reported at the chosen location, not silently redirected.
      const outputPath = path.join(directory || path.dirname(lbryumWalletDir), outputFilename);
      const zip = new AdmZip();
      try {
        zip.addLocalFolder(lbryumWalletDir);
      } catch (err) {
        console.error(err); // eslint-disable-line no-console
        this.showErrorMessage(__('The wallet folder could not be added to the zip archive.'));
        return;
      }
      try {
        zip.writeZip(outputPath);
      } catch (err) {
        console.error(err); // eslint-disable-line no-console
        this.showErrorMessage(__('There was a problem writing the zip archive to disk.'));
        return;
      }
      this.showSuccessMessage(__('Saved zip archive to %outputPath%', { outputPath }));
      shell.showItemInFolder(outputPath);
    } finally {
      this.backupPending = false;
      if (this.mounted) this.setState({ pending: false });
    }
  }
  render() {
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
              <Button button="link" label={__('Open Folder')} onClick={() => shell.openPath(lbryumWalletDir)} />
            </div>
          </React.Fragment>
        }
      />
    );
  }
}

export default WalletBackup;
