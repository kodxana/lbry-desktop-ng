// @flow
import React from 'react';
import { Form, FormField } from 'component/common/form';
import { Modal } from 'modal/modal';
import Button from 'component/button';
import { getSavedPasswordState, setSavedPassword } from 'util/saved-passwords';

type Props = {
  quit: () => void,
  closeModal: () => void,
  unlockWallet: (?string) => void,
  walletUnlockSucceded: boolean,
  shouldTryWithBlankPassword: boolean,
};

type State = {
  password: string,
  rememberPassword: boolean,
  submittedPassword: ?string,
  submittedRememberPassword: boolean,
};

class ModalWalletUnlock extends React.PureComponent<Props, State> {
  unmounted = false;
  saving = false;

  state = {
    password: '',
    rememberPassword: false,
    submittedPassword: null,
    submittedRememberPassword: false,
  };

  componentDidMount() {
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

  componentDidUpdate(prevProps: Props) {
    const { props } = this;

    if (
      this.state.submittedPassword !== null &&
      props.walletUnlockSucceded === true &&
      prevProps.walletUnlockSucceded !== true
    ) {
      this.saving = true;
      setSavedPassword(this.state.submittedPassword, this.state.submittedRememberPassword).then(() => {
        if (!this.unmounted) props.closeModal();
      });
    }
  }

  submitPassword(password: string, rememberPassword: boolean = this.state.rememberPassword) {
    if (this.saving) return;
    this.props.unlockWallet(password);
    this.setState({ submittedPassword: password, submittedRememberPassword: rememberPassword });
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
