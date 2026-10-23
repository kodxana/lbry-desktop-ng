// @flow
import React from 'react';
import { Form, FormField } from 'component/common/form';
import { Modal } from 'modal/modal';
import Button from 'component/button';
import { getSavedPasswordState, setSavedPassword } from 'util/saved-passwords';

type Props = {
  quit: () => void,
  closeModal: () => void,
  unlockWallet: (?string) => Promise<boolean>,
  walletUnlockSucceded: boolean,
  shouldTryWithBlankPassword: boolean,
};

type State = {
  password: string,
  rememberPassword: boolean,
  submittedPassword: ?string,
  pending: boolean,
};

class ModalWalletUnlock extends React.PureComponent<Props, State> {
  unmounted = false;
  saving = false;
  pendingRequest = false;

  state = {
    password: '',
    rememberPassword: false,
    submittedPassword: null,
    pending: false,
  };

  componentDidMount() {
    this.unmounted = false;
    const { shouldTryWithBlankPassword } = this.props;

    getSavedPasswordState().then(({ password: p, remembered: rememberPassword }) => {
      if (this.unmounted || this.state.submittedPassword !== null || this.state.password) return;
      if (p !== null) {
        this.setState({ password: p, rememberPassword });
        this.submitPassword(p, rememberPassword);
      } else if (shouldTryWithBlankPassword) {
        this.submitPassword('', false);
      }
    });
  }
  componentWillUnmount() {
    this.unmounted = true;
  }

  async submitPassword(password: string, rememberPassword: boolean = this.state.rememberPassword) {
    if (this.saving || this.pendingRequest || this.unmounted) return;
    this.pendingRequest = true;
    this.setState({ submittedPassword: password, pending: true });
    try {
      if (!(await this.props.unlockWallet(password)) || this.unmounted) return;
      this.saving = true;
      await setSavedPassword(password, rememberPassword);
      if (!this.unmounted) this.props.closeModal();
    } finally {
      this.pendingRequest = false;
      if (!this.unmounted) this.setState({ pending: false });
    }
  }

  onChangePassword(event: SyntheticInputEvent<*>) {
    this.setState({ password: event.target.value });
  }

  onChangeRememberPassword(event: SyntheticInputEvent<>) {
    this.setState({ rememberPassword: event.target.checked });
  }

  render() {
    const { quit, walletUnlockSucceded } = this.props;

    const { password, rememberPassword } = this.state;
    return (
      <Modal
        isOpen
        title={__('Unlock wallet')}
        contentLabel={__('Unlock wallet')}
        type="confirm"
        shouldCloseOnOverlayClick={false}
        confirmButtonLabel={__('Unlock')}
        confirmButtonDisabled={this.state.pending}
        abortButtonLabel={__('Exit')}
        onConfirmed={() => this.submitPassword(password)}
        onAborted={quit}
      >
        <p>
          {__('Your wallet has been encrypted with a local password. Please enter your wallet password to proceed.')}{' '}
          <Button button="link" label={__('Learn more')} href="https://lbry.com/faq/wallet-encryption" />.
        </p>
        <Form className="section" onSubmit={() => this.submitPassword(password)}>
          <FormField
            autoFocus
            error={walletUnlockSucceded === false ? 'Incorrect Password' : false}
            label={__('Wallet Password')}
            type="password"
            name="wallet-password"
            onChange={(event) => this.onChangePassword(event)}
            value={password || ''}
          />
          <fieldset-section>
            <FormField
              label={__('Remember Password')}
              type="checkbox"
              name="wallet-remember-password"
              onChange={(event) => this.onChangeRememberPassword(event)}
              checked={rememberPassword}
            />
          </fieldset-section>
        </Form>
      </Modal>
    );
  }
}

export default ModalWalletUnlock;
