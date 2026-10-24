import { strict as assert } from 'assert';
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import DesktopRouter from 'component/common/desktop-router';

export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function waitFor(predicate, message) {
  const deadline = Date.now() + 10000;
  while (!(await predicate())) {
    assert(Date.now() < deadline, message);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

let root;
export function render(element, store, history) {
  if (!root) root = createRoot(document.getElementById('app'));
  flushSync(() =>
    root.render(
      <Provider store={store}>
        <DesktopRouter history={history}>{element}</DesktopRouter>
      </Provider>
    )
  );
}

export function unmount() {
  if (root) flushSync(() => root.unmount());
  root = null;
}

// Use native DOM events so the form exercises React's input tracking too.
// Flush each discrete event before the fixture sends the next user action.
export function input(name, value) {
  const field = document.getElementById(name);
  assert(field, 'Missing form field: ' + name);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, value);
  flushSync(() => field.dispatchEvent(new Event('input', { bubbles: true })));
}

export function submit() {
  const form = document.querySelector('form');
  assert(form, 'Missing form');
  flushSync(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
