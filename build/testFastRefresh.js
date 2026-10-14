/* eslint no-console:0 */
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

module.exports = async function testFastRefresh(evaluate, until) {
  const file = path.join(__dirname, '../ui/component/hubSetup/view.jsx');
  const original = fs.readFileSync(file, 'utf8');
  const updated = original.replace("__('Choose a wallet hub')", "__('Choose a wallet hub (refresh fixture)')");
  assert.notEqual(updated, original, 'The refresh fixture must change a rendered component');
  await until(() => evaluate("!document.querySelector('fieldset').disabled"), 'Initial hub scan did not finish');
  await evaluate(`(() => {
    document.querySelector('.hub-setup__custom').open = true;
    const input = document.getElementById('custom-wallet-hub');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'draft.invalid:50001');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    window.refreshFixture = 'same document';
  })()`);
  try {
    fs.writeFileSync(file, updated);
    await until(
      () => evaluate("document.querySelector('h1')?.textContent === 'Choose a wallet hub (refresh fixture)'"),
      'Fast Refresh did not apply the component edit'
    );
    assert.equal(await evaluate('window.refreshFixture'), 'same document', 'Component edits must not reload the page');
    assert.equal(
      await evaluate("document.getElementById('custom-wallet-hub').value"),
      'draft.invalid:50001',
      'Fast Refresh must preserve unsaved React form state'
    );
    await until(() => evaluate("!document.querySelector('fieldset').disabled"), 'Effects must recover after refresh');
  } finally {
    assert.equal(
      fs.readFileSync(file, 'utf8'),
      updated,
      'Refusing to overwrite a concurrent edit to the refresh fixture'
    );
    fs.writeFileSync(file, original);
  }
  await until(
    () =>
      evaluate(
        "document.querySelector('h1')?.textContent === 'Choose a wallet hub' && !document.querySelector('fieldset').disabled"
      ),
    'Restoring the component must also refresh successfully'
  );
  assert.equal(await evaluate("document.getElementById('custom-wallet-hub').value"), 'draft.invalid:50001');
  const stylesheet = path.join(__dirname, '../ui/scss/component/_first-run.scss');
  const originalStyles = fs.readFileSync(stylesheet, 'utf8');
  const updatedStyles = originalStyles + '\nh1 { color: rgb(12, 34, 56) !important; }\n';
  const headingColor = () => evaluate("getComputedStyle(document.querySelector('h1')).color");
  const originalColor = await headingColor();
  assert.notEqual(originalColor, 'rgb(12, 34, 56)');
  try {
    fs.writeFileSync(stylesheet, updatedStyles);
    await until(() => headingColor().then((color) => color === 'rgb(12, 34, 56)'), 'Sass partial edits must reload CSS');
    assert.equal(await evaluate('window.refreshFixture'), 'same document', 'Style edits must not reload the page');
    assert.equal(await evaluate("document.getElementById('custom-wallet-hub').value"), 'draft.invalid:50001');
  } finally {
    assert.equal(fs.readFileSync(stylesheet, 'utf8'), updatedStyles, 'Refusing to overwrite a concurrent style edit');
    fs.writeFileSync(stylesheet, originalStyles);
  }
  await until(() => headingColor().then((color) => color === originalColor), 'Restoring the partial must restore CSS');
  console.log(
    'PASS: component Fast Refresh and Sass partial reload apply/restore edits without losing the document or unsaved form state'
  );
};
