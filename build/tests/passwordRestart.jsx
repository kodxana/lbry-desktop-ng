import { strict as assert } from 'assert';
import { getSavedPasswordState, deleteSavedPassword } from 'util/saved-passwords';

export default async function passwordRestart() {
  const saved = await getSavedPasswordState();
  assert(
    saved.password === 'fixture-restart-password' && saved.remembered,
    'A new renderer must load the protected password'
  );
  assert(!document.cookie.includes('saved_password'), 'The old cookie must not reappear on restart');
  assert(await deleteSavedPassword());
  assert.equal((await getSavedPasswordState()).password, null);
  return 'remembered password survives renderer restart; Forget removes it from memory and disk';
}
