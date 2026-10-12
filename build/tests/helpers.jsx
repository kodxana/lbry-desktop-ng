import { strict as assert } from 'assert';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';

export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function waitFor(predicate, message) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    assert(Date.now() < deadline, message);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

export function render(element, store, history) {
  ReactDOM.render(
    <Provider store={store}>
      <ConnectedRouter history={history}>{element}</ConnectedRouter>
    </Provider>,
    document.getElementById('app')
  );
}

export function unmount() {
  ReactDOM.unmountComponentAtNode(document.getElementById('app'));
}

// Use native DOM events so the form exercises React's input tracking too.
export function input(name, value) {
  const field = document.getElementById(name);
  assert(field, 'Missing form field: ' + name);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

export function submit() {
  const form = document.querySelector('form');
  assert(form, 'Missing form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
