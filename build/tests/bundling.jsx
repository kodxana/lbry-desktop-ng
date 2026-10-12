import { strict as assert } from 'assert';
import image from './fixtures/build-probe.svg';
import shader from './fixtures/build-probe.glsl';
import 'scss/third-party.scss';
import 'scss/all.scss';
import './fixtures/build-probe.scss';

export default async function testBundling() {
  const root = document.documentElement;
  root.setAttribute('theme', 'dark');
  root.setAttribute('dir', 'ltr');
  const button = document.createElement('button');
  button.className = 'button button--primary';
  button.textContent = 'Continue';
  const probe = document.createElement('div');
  probe.className = 'build-probe';
  document.body.append(button, probe);
  assert.equal(getComputedStyle(root).backgroundColor, 'rgb(31, 31, 34)', 'Retain the desktop dark theme');
  assert.equal(getComputedStyle(button).backgroundColor, 'rgb(43, 187, 144)', 'Retain the primary button style');
  assert.equal(getComputedStyle(probe).marginLeft, '13px');
  assert.equal(getComputedStyle(probe).paddingRight, '7px');
  root.setAttribute('dir', 'rtl');
  assert.equal(getComputedStyle(probe).marginRight, '13px', 'RTL rules must still be generated');
  assert.equal(getComputedStyle(probe).paddingLeft, '7px');
  root.setAttribute('theme', 'light');
  assert.equal(getComputedStyle(root).backgroundColor, 'rgb(231, 231, 231)', 'Retain the light theme option');
  assert(getComputedStyle(probe).backgroundImage.includes('img/build-probe.svg'));
  assert.equal(image, 'img/build-probe.svg', 'Image imports keep relative URLs for packaged file:// pages');
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Emitted image failed to load'));
    img.src = image;
  });
  assert.equal(img.naturalWidth, 8);
  assert(shader.includes('gl_FragColor'), 'Shader imports must remain source strings');
  assert.equal((await import('./fixtures/build-lazy')).default, 'lazy module loaded');
  assert.equal(typeof process.env, 'object', 'Keep Electron runtime environment access');
  return 'production styles, dark/light themes, RTL, emitted images, shader strings and lazy chunks';
}
