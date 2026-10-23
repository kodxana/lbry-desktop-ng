// @flow
import React from 'react';
import { Form, FormField, Submit } from 'component/common/form';
import { Modal } from 'modal/modal';
import Button from 'component/button';
import { setSavedPassword } from 'util/saved-passwords';

type Props = {
  closeModal: () => void,
  encryptWallet: (?string) => Promise<boolean>,
  updateWalletStatus: () => void,
};

type State = {
  newPassword: ?string,
  newPasswordConfirm: ?string,
  passwordMismatch: boolean,
  understandConfirmed: boolean,
  understandError: boolean,
  pending: boolean,
  failMessage: ?string,
  rememberPassword: boolean,
};

const acknowledgementText = __('I Understand');

class ModalWalletEncrypt extends React.PureComponent<Props, State> {
  saving = false;
  pendingRequest = false;
  unmounted = false;

  state = {
    newPassword: null,
    newPasswordConfirm: null,
    passwordMismatch: false,
    understandConfirmed: false,
    understandError: false,
    pending: false,
    failMessage: undefined,
    rememberPassword: false,
  };

  componentDidMount() {
    this.unmounted = false;
  }

  componentWillUnmount() {
    this.unmounted = true;
  }

  onChangeNewPassword(event: SyntheticInputEvent<>) {
    this.setState({ newPassword: event.target.value });
  }

  onChangeRememberPassword(event: SyntheticInputEvent<>) {
    this.setState({ rememberPassword: event.target.checked });
  }

  onChangeNewPasswordConfirm(event: SyntheticInputEvent<>) {
    this.setState({ newPasswordConfirm: event.target.value });
  }

  onChangeUnderstandConfirm(event: SyntheticInputEvent<>) {
    const regex = new RegExp('^.?' + acknowledgementText + '.?$', 'i');
    this.setState({
      understandConfirmed: regex.test(event.target.value),
    });
  }

  async submitEncryptForm() {
    const { state } = this;

    if (this.saving || this.pendingRequest || this.unmounted || !state.newPassword) {
      return;
    }

    let invalidEntries = false;

    if (state.newPassword !== state.newPasswordConfirm) {
      this.setState({ passwordMismatch: true });
      invalidEntries = true;
    }

    if (state.understandConfirmed === false) {
      this.setState({ understandError: true });
      invalidEntries = true;
    }

    if (invalidEntries === true) {
      return;
    }

    const { newPassword, rememberPassword } = state;
    this.pendingRequest = true;
    this.setState({
      pending: true,
      passwordMismatch: false,
      understandError: false,
      failMessage: undefined,
    });
    try {
      const succeeded = await this.props.encryptWallet(newPassword);
      if (this.unmounted) return;
      if (succeeded) {
        this.saving = true;
        this.props.updateWalletStatus();
        await setSavedPassword(newPassword, rememberPassword);
        if (!this.unmounted) this.props.closeModal();
      } else {
        this.setState({ failMessage: 'Unable to encrypt wallet.' });
      }
    } finally {
      this.pendingRequest = false;
      if (!this.unmounted) this.setState({ pending: false });
    }
  }

  render() {
    const { closeModal } = this.props;

    const { passwordMismatch, understandError, failMessage } = this.state;
    const pending = this.state.pending;
    return (
      <Modal
        isOpen
        title={__('Encrypt wallet')}
        contentLabel={__('Encrypt wallet')}
        type="custom"
        onConfirmed={() => this.submitEncryptForm()}
        onAborted={closeModal}
      >
        <Form onSubmit={() => this.submitEncryptForm()}>
          <p>
            {__(
              'Encrypting your wallet will require a password to access your local wallet data when LBRY starts. Please enter a new password for your wallet.'
            )}{' '}
            <Button button="link" label={__('Learn more')} href="https://lbry.com/faq/wallet-encryption" />.
          </p>
          <fieldset-section>
            <FormField
              autoFocus
              error={passwordMismatch === true ? 'Passwords do not match' : false}
              label={__('Password')}
              placeholder={__('Shh...')}
              type="password"
              name="wallet-new-password"
              onChange={(event) => this.onChangeNewPassword(event)}
            />
          </fieldset-section>
          <fieldset-section>
            <FormField
              error={passwordMismatch === true ? 'Passwords do not match' : false}
              label={__('Confirm Password')}
              placeholder={__('Your eyes only')}
              type="password"
              name="wallet-new-password-confirm"
              onChange={(event) => this.onChangeNewPasswordConfirm(event)}
            />
          </fieldset-section>
          <fieldset-section>
            <FormField
              label={__('Remember Password')}
              type="checkbox"
              name="wallet-remember-password"
              onChange={(event) => this.onChangeRememberPassword(event)}
              checked={this.state.rememberPassword}
            />
          </fieldset-section>

          <div className="help--warning">
            {__(
              'If your password is lost, it cannot be recovered. You will not be able to access your wallet without a password.'
            )}
          </div>
          <FormField
            inputButton={<Submit disabled={pending} label={pending ? __('Encrypting Wallet') : __('Encrypt wallet')} />}
            error={
              understandError === true
                ? __('You must enter "%acknowledgement_text%"', { acknowledgement_text: acknowledgementText })
                : false
            }
            label={__('Enter "%acknowledgement_text%"', { acknowledgement_text: acknowledgementText })}
            placeholder={__('Type "%acknowledgement_text%"', { acknowledgement_text: acknowledgementText })}
            type="text"
            name="wallet-understand"
            onChange={(event) => this.onChangeUnderstandConfirm(event)}
          />
          {failMessage && <div className="error__text">{__(failMessage)}</div>}
        </Form>
        <div className="card__actions">
          <Button button="link" label={__('Cancel')} onClick={closeModal} />
        </div>
      </Modal>
    );
  }
}

export default ModalWalletEncrypt;
