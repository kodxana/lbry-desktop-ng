import { strict as assert } from 'assert';
import React from 'react';
import { ipcRenderer } from 'electron';
import { flushSync } from 'react-dom';
import FormField from 'component/common/form-components/form-field';
import FormFieldPrice from 'component/common/form-components/form-field-price';
import FormRow from 'component/common/form-components/form-row';
import Form from 'component/common/form-components/form';
import Submit from 'component/common/form-components/submit';
import { render, unmount, input, submit } from './helpers';

export default async function formControls(store, history) {
  await ipcRenderer.invoke('fixture-controls-focus');
  const prices = [];
  const submissions = [];
  let state;
  let update;
  let blurCount = 0;
  let enterCount = 0;
  function Controls() {
    const [values, setValues] = React.useState({
      price: { amount: 0.00000001, currency: 'LBC' },
      text: '',
      checked: false,
      disabled: false,
      notes: 'a\nb',
      range: '3',
    });
    state = values;
    update = (next) => setValues((previous) => ({ ...previous, ...next }));
    return (
      <Form className="fixture-form" onSubmit={(event) => submissions.push(event.defaultPrevented)}>
        <FormRow padded>
          <FormField
            name="form-text"
            type="text"
            autoFocus
            label="Text"
            value={values.text}
            maxLength={12}
            onChange={(event) => update({ text: event.target.value })}
            onBlur={() => blurCount++}
            onKeyPress={(event) => {
              if (event.key === 'Enter') enterCount++;
            }}
            error={{ message: 'Fixture validation' }}
          />
          <FormField
            name="form-check"
            type="checkbox"
            label="Remember fixture"
            checked={values.checked}
            disabled={values.disabled}
            onChange={(event) => update({ checked: event.target.checked })}
          />
          <FormFieldPrice
            name="form-price"
            min={0}
            step={0.00000001}
            price={values.price}
            disabled={values.disabled}
            onChange={(price) => {
              prices.push(price);
              update({ price });
            }}
          />
          <FormField
            name="form-notes"
            type="textarea"
            label="Notes"
            textAreaMaxLength={12}
            charCount={values.notes.length}
            value={values.notes}
            onChange={(event) => update({ notes: event.target.value })}
          />
          <FormField
            name="form-range"
            type="range"
            min={0}
            max={10}
            value={values.range}
            onChange={(event) => update({ range: event.target.value })}
          />
          <Submit label="Save fixture" disabled={values.disabled} />
        </FormRow>
      </Form>
    );
  }
  const field = (name) => {
    const element = document.getElementById(name);
    assert(element, 'Missing form field: ' + name);
    return element;
  };
  try {
    render(<Controls />, store, history);
    assert.equal(document.activeElement, field('form-text'));
    assert.equal(document.querySelector('form').noValidate, true);
    assert(document.querySelector('form.fixture-form .form-row--padded'));
    assert.equal(document.querySelector('.error__text').textContent, 'Fixture validation');
    assert.equal(field('form-text').maxLength, 12);
    input('form-text', 'hello');
    assert.equal(state.text, 'hello');
    flushSync(() =>
      field('form-text').dispatchEvent(
        new KeyboardEvent('keypress', {
          key: 'Enter',
          charCode: 13,
          keyCode: 13,
          bubbles: true,
          cancelable: true,
        })
      )
    );
    assert.equal(enterCount, 1);
    field('form-text').blur();
    assert.equal(blurCount, 1);
    flushSync(() => document.querySelector('label[for="form-check"]').click());
    assert.equal(state.checked, true, 'The checkbox label must update the controlled value');
    assert.equal(field('form-price_amount').step, '1e-8');
    input('form-price_amount', '1.23456789');
    assert.deepEqual(prices.at(-1), { amount: 1.23456789, currency: 'LBC' });
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(field('form-price_currency'), 'USD');
    flushSync(() => field('form-price_currency').dispatchEvent(new Event('change', { bubbles: true })));
    assert.deepEqual(
      prices.at(-1),
      { amount: 1.23456789, currency: 'USD' },
      'Changing currency must preserve the amount'
    );
    input('form-price_amount', '');
    assert.deepEqual(
      prices.at(-1),
      { amount: 0, currency: 'USD' },
      'Clearing the field must retain its existing zero behavior'
    );
    input('form-price_amount', '0.00000001');
    assert.deepEqual(
      prices.at(-1),
      { amount: 0.00000001, currency: 'USD' },
      'Small amounts must retain eight decimal places'
    );
    assert.equal(prices.length, 4, 'Each amount or currency change must notify the form once');
    input('form-range', '7');
    assert.equal(state.range, '7');
    assert.equal(field('form-notes').maxLength, 12);
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(
      field('form-notes'),
      'first\nnext'
    );
    flushSync(() => field('form-notes').dispatchEvent(new Event('input', { bubbles: true })));
    assert.equal(state.notes, 'first\nnext');
    assert.equal(document.querySelector('.comment__char-count-mde').textContent, '10/12');
    submit();
    assert.deepEqual(submissions, [true], 'Form submission must prevent navigation before invoking the callback');
    flushSync(() => update({ disabled: true }));
    assert(field('form-price_amount').disabled);
    assert(field('form-price_currency').disabled);
    assert(field('form-check').disabled);
    assert(document.querySelector('button[type="submit"]').disabled);
    flushSync(() => field('form-check').click());
    assert.equal(state.checked, true, 'Disabled inputs must keep their current value');
    unmount();
    render(<FormField name="focused-notes" type="textarea" autoFocus />, store, history);
    assert.equal(document.activeElement, field('focused-notes'), 'Textarea refs must still support initial focus');
  } finally {
    unmount();
  }
}
