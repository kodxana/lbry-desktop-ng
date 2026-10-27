// @flow
import React from 'react';
import desktop from 'util/desktop';
import Button from 'component/button';
import SetupLayout from 'component/setupLayout';
import { FormField } from 'component/common/form-components/form-field';

type Choice = { id: string, name: string };
type Profile = { id: string, label: string };
type Preview = { ok: boolean, error?: string, accounts?: number, channels?: number, encrypted?: boolean };
type Props = { onContinue: () => void };
type Request = { id?: string, password?: string, confirmed?: boolean };

export default function WalletSetup({ onContinue }: Props): React.Node {
  const [hasWallet, setHasWallet] = React.useState(false);
  const [profiles, setProfiles] = React.useState<Array<Profile>>([]);
  const [mode, setMode] = React.useState('import');
  const [choices, setChoices] = React.useState<Array<Choice>>([]);
  const [selected, setSelected] = React.useState('');
  const [profileId, setProfileId] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    desktop
      .walletSetup('state')
      .then((state) => {
        setHasWallet(state.hasWallet);
        setProfiles(state.profiles);
        if (state.hasWallet) setMode('keep');
      })
      .catch(() => setError(__('Could not read wallet setup. Close and reopen the app.')))
      .finally(() => setBusy(false));
  }, []);

  async function run(operation: string, value?: Request) {
    setBusy(true);
    setError('');
    try {
      return await desktop.walletSetup(operation, value);
    } catch (_) {
      setError(__('The wallet operation could not be completed. Your original wallet has not been changed.'));
      return null;
    } finally {
      setBusy(false);
    }
  }

  function selectMode(value: string) {
    setMode(value);
    setPassword('');
    setConfirmed(false);
    setError('');
  }

  async function check(id: string, secret?: string) {
    setPreview(null);
    const result = await run('preview', { id, password: secret });
    setPassword('');
    setPreview(result);
  }

  async function choose() {
    setChoices([]);
    setPreview(null);
    setPassword('');
    setConfirmed(false);
    const result = await run('choose');
    if (result && !result.canceled) {
      setChoices(result.choices);
      setSelected(result.choices[0].id);
      await check(result.choices[0].id);
    }
  }

  async function next() {
    const result = await run(mode, { confirmed, id: profileId });
    if (result && mode === 'keep') onContinue();
  }

  const needsPassword = preview && (preview.error === 'password-required' || preview.error === 'password');
  const canContinue =
    mode === 'keep' ||
    (confirmed &&
      (mode === 'fresh' || (mode === 'import' && preview && preview.ok) || (mode === 'switch' && profileId)));

  return (
    <SetupLayout>
      <section className="wallet-setup">
        <h1 className="section__title--large">{__('Wallet setup')}</h1>
        <p className="section__subtitle">
          {__('Bring an existing LBRY wallet with you, or start fresh. Nothing will be moved from the original app.')}
        </p>
        {mode === 'import' && choices.length > 0 ? (
          <Button
            button="link"
            label={__('Back to wallet choices')}
            disabled={busy}
            onClick={() => {
              setChoices([]);
              setPreview(null);
              setPassword('');
              setConfirmed(false);
            }}
          />
        ) : (
          <fieldset disabled={busy} className="section__body">
            <legend className="section__subtitle">{__('Choose how to start')}</legend>
            {hasWallet && (
              <FormField
                type="radio"
                name="wallet-keep"
                inputName="wallet-mode"
                checked={mode === 'keep'}
                label={__('Keep using this wallet')}
                helper={__('Continue with the wallet and sync settings already in this NG profile.')}
                onChange={() => selectMode('keep')}
              />
            )}
            <FormField
              type="radio"
              name="wallet-import"
              inputName="wallet-mode"
              checked={mode === 'import'}
              label={__('Import a wallet copy')}
              helper={__('Choose a wallet file or a backup ZIP made by LBRY Desktop.')}
              onChange={() => selectMode('import')}
            />
            <FormField
              type="radio"
              name="wallet-fresh"
              inputName="wallet-mode"
              checked={mode === 'fresh'}
              label={__('Create a new wallet')}
              helper={__('Start in a separate profile. Any existing wallet stays available.')}
              onChange={() => selectMode('fresh')}
            />
            {profiles.length > 0 && (
              <FormField
                type="radio"
                name="wallet-switch"
                inputName="wallet-mode"
                checked={mode === 'switch'}
                label={__('Return to another NG profile')}
                onChange={() => selectMode('switch')}
              />
            )}
          </fieldset>
        )}

        {mode === 'import' && (
          <div className="wallet-setup__import">
            <Button
              button="secondary"
              label={choices.length ? __('Choose another file') : __('Choose wallet or backup')}
              disabled={busy}
              onClick={choose}
            />
            {choices.length > 0 && (
              <label className="wallet-setup__file">
                {__('Wallet in this file')}
                <select
                  aria-label={__('Wallet in this file')}
                  disabled={busy}
                  value={selected}
                  onChange={(event) => {
                    const id = event.target.value;
                    setSelected(id);
                    setPassword('');
                    setConfirmed(false);
                    check(id);
                  }}
                >
                  {choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {needsPassword && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  check(selected, password);
                }}
              >
                <FormField
                  name="import-wallet-password"
                  type="password"
                  label={__('Wallet password')}
                  helper={__('Used only to check this copy. It will not be remembered.')}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
                <Button button="secondary" label={__('Check password')} type="submit" disabled={busy || !password} />
              </form>
            )}
            {preview && preview.ok && (
              <p role="status" className="help">
                {__('Wallet checked: %accounts% account(s), %channels% channel key(s).', {
                  accounts: preview.accounts,
                  channels: preview.channels,
                })}{' '}
                {preview.encrypted
                  ? __('The copy stays encrypted. You will unlock it after restart.')
                  : __(
                      'This wallet is not encrypted. Import keeps its current protection; encrypt it in Wallet settings after setup.'
                    )}
              </p>
            )}
            {preview && preview.error && preview.error !== 'password-required' && (
              <p className="error__text" role="alert">
                {preview.error === 'password'
                  ? __('That password did not unlock the wallet. Try again.')
                  : __(
                      'This wallet could not be verified. Check its format, network and password. No wallet has been imported.'
                    )}
              </p>
            )}
            <p className="help">
              {__(
                'Only the selected wallet is copied. Downloads, blobs and other wallets in a backup stay where they are.'
              )}
            </p>
          </div>
        )}

        {mode === 'switch' && (
          <label className="wallet-setup__file">
            {__('NG profile')}
            <select
              aria-label={__('NG profile')}
              disabled={busy}
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
            >
              <option value="">{__('Choose a profile')}</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode !== 'keep' && (
          <div className="wallet-setup__notice">
            <h2>{__('Before you continue')}</h2>
            <p>
              {mode === 'switch'
                ? __('Switching restores that profile’s wallet and sync settings.')
                : __(
                    'Odysee wallet sync is off in the new profile, even if you sign in. It will not receive future Odysee wallet changes or send changes back.'
                  )}
            </p>
            <p>
              {__(
                'An imported copy controls the same funds as its original. It does not create a second balance. Keep your original wallet and backup.'
              )}
            </p>
            <FormField
              name="wallet-import-confirm"
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              label={__('I understand. Continue in a separate profile and keep my original wallet.')}
              onChange={() => setConfirmed(!confirmed)}
            />
          </div>
        )}
        {error && (
          <p className="error__text" role="alert">
            {error}
          </p>
        )}
        <p role="status" className="help">
          {busy ? __('Checking your wallet…') : __('You can return here from Settings → Account → Wallet setup.')}
        </p>
        <div className="first-run__actions">
          <Button
            button="primary"
            label={mode === 'keep' ? __('Continue to hub selection') : __('Continue and restart')}
            disabled={busy || !canContinue}
            onClick={next}
          />
        </div>
      </section>
    </SetupLayout>
  );
}
