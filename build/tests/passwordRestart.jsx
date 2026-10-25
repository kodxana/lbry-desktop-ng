import { strict as assert } from 'assert';
import { getSavedPasswordState, deleteSavedPassword, getAuthToken, doSignOutCleanup } from 'util/saved-passwords';

export default async function passwordRestart() {
  const saved = await getSavedPasswordState();
  assert(
    saved.password === 'fixture-restart-password' && saved.remembered,
    'A new renderer must load the protected password'
  );
  assert(!document.cookie.includes('saved_password'), 'The old cookie must not reappear on restart');
  assert(await deleteSavedPassword());
  assert.equal((await getSavedPasswordState()).password, null);
  assert.equal(getAuthToken(), 'fixture-restart-auth', 'Account cookies must survive a renderer restart');
  assert(document.cookie.includes('unrelated_cookie=preserve-me'));
  assert(await doSignOutCleanup());
  assert.equal(getAuthToken(), null);
  assert(document.cookie.includes('unrelated_cookie=preserve-me'), 'Sign-out must preserve unrelated cookies');
  return 'remembered password survives renderer restart; Forget removes it from memory and disk';
}
