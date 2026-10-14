import { strict as assert } from 'assert';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { ipcRenderer } from 'electron';
import { Box3, Vector3 } from 'three';
import ThreeViewer from 'component/viewers/threeViewer';
import desktop from 'util/desktop';
import { render, unmount, waitFor, tick } from './helpers';
import 'scss/all.scss';

const stl =
  'solid triangle\nfacet normal 0 0 1\nouter loop\nvertex -1 -1 0\nvertex 1 -1 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle';
const obj =
  'mtllib https://example.invalid/never-fetch.mtl\no first\nv 20 30 40 1 0 0\nv 22 30 40 0 1 0\nv 21 32 40 0 0 1\nv 21 31 43 1 1 1\nf 1 2 3\nf 1 4 2\no second\nf 2 4 3\nf 3 4 1';
const binary = new Uint8Array(84 + 50);
const binaryData = new DataView(binary.buffer);
binaryData.setUint32(80, 1, true);
[-1, -1, 0, 1, -1, 0, 0, 1, 0].forEach((value, i) => binaryData.setFloat32(96 + i * 4, value, true));

function pixels(viewer) {
  const gl = viewer.renderer.getContext();
  viewer.renderer.render(viewer.scene, viewer.camera);
  const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  assert.equal(gl.getError(), gl.NO_ERROR);
  return pixels;
}

function observeDisposal(viewer) {
  const resources = new Map();
  viewer.scene.traverse((child) => {
    for (const resource of [child.geometry, ...[].concat(child.material || [])]) {
      if (!resource || resources.has(resource)) continue;
      resources.set(resource, 0);
      resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1));
    }
  });
  const renderer = viewer.renderer;
  const canvas = renderer.domElement;
  const panel = viewer.gui.domElement;
  return () => {
    assert(!canvas.isConnected && !panel.isConnected, 'Old canvas and controls must be removed');
    for (const count of resources.values()) assert.equal(count, 1, 'Dispose each shared resource once');
    assert.equal(renderer.info.memory.geometries, 0, 'Release uploaded geometry');
  };
}

export default async function three(store, history, root) {
  document.documentElement.setAttribute('theme', 'dark');
  document.documentElement.setAttribute('dir', 'ltr');
  const style = document.createElement('style');
  style.textContent =
    '.file-render__viewer--three { width: 640px; } .three-viewer { width: 640px; height: 480px; max-height: none; }';
  document.head.append(style);
  const files = {};
  for (const [name, bytes] of Object.entries({
    'ascii.stl': stl,
    'binary.stl': binary,
    'parts.obj': obj,
    'empty.obj': '# empty',
    'broken.stl': 'invalid',
    'nan.obj': 'v NaN 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3',
    'point.obj': 'v 1 1 1\nf 1 1 1',
  })) {
    const filename = path.join(root, 'model ł # ' + name);
    fs.writeFileSync(filename, bytes);
    await ipcRenderer.invoke('fixture-grant-file', filename);
    files[name] = filename;
  }
  let viewer;
  const show = (filename, fileType = filename.split('.').pop()) =>
    render(
      <ThreeViewer
        ref={(value) => {
          viewer = value;
        }}
        source={{ fileType, downloadPath: filename }}
      />,
      store,
      history
    );
  const loaded = async () => {
    await waitFor(() => viewer.state.isReady || viewer.state.error, 'Model loading must finish');
    assert.equal(viewer.state.error, null);
  };
  let checkDisposal;
  for (const name of ['ascii.stl', 'binary.stl', 'parts.obj']) {
    show(files[name]);
    if (checkDisposal) checkDisposal();
    await loaded();
    const box = new Box3().setFromObject(viewer.mesh);
    const size = box.getSize(new Vector3());
    assert(Math.abs(Math.max(size.x, size.y, size.z) - 10) < 0.001);
    assert(Math.abs(box.min.y) < 0.001, 'Model must sit on the ground');
    const center = box.getCenter(new Vector3());
    assert(Math.abs(center.x) < 0.001 && Math.abs(center.z) < 0.001, 'Center off-origin OBJ models');
    const visible = pixels(viewer);
    viewer.mesh.visible = false;
    const background = pixels(viewer);
    viewer.mesh.visible = true;
    assert(
      visible.filter((value, index) => value !== background[index]).length > 300,
      name + ' must paint visible model pixels'
    );
    assert(viewer.renderer.getContext() instanceof WebGL2RenderingContext);
    assert.equal(viewer.material.vertexColors, name === 'parts.obj');
    checkDisposal = observeDisposal(viewer);
  }

  for (const folder of viewer.gui.folders) folder.open();
  assert.equal(getComputedStyle(document.documentElement).backgroundColor, 'rgb(31, 31, 34)');
  assert.equal(getComputedStyle(viewer.guiContainer).position, 'absolute');
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await ipcRenderer.invoke('fixture-three-capture');
  const control = (property) => viewer.gui.controllersRecursive().find((item) => item.property === property);
  for (const property of ['wireframe', 'flatShading']) {
    control(property).domElement.querySelector('input').click();
    assert.equal(viewer.material[property], property === 'wireframe');
  }
  const color = control('color').domElement.querySelector('input[type=color]');
  color.value = '#ff0000';
  color.dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(viewer.material.color.getHex(), 0xff0000);
  const shine = control('shininess').domElement.querySelector('input');
  shine.value = '75';
  shine.dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(viewer.material.shininess, 75);
  control('autoRotate').domElement.querySelector('input').click();
  const position = viewer.camera.position.clone();
  await waitFor(() => viewer.camera.position.distanceTo(position) > 0.01, 'Auto-rotate must move the camera');
  control('reset').domElement.querySelector('button').click();
  assert.equal(viewer.material.color.getHex(), 0xffffff);
  assert.equal(viewer.material.shininess, 30);
  assert(viewer.material.flatShading && !viewer.material.wireframe && !viewer.controls.autoRotate);
  const distance = viewer.camera.position.distanceTo(viewer.controls.target);
  viewer.renderer.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
  assert(viewer.camera.position.distanceTo(viewer.controls.target) < distance, 'Wheel zoom remains usable');
  viewer.viewer.style.width = '400px';
  viewer.viewer.style.height = '200px';
  window.dispatchEvent(new Event('resize'));
  assert.equal(viewer.camera.aspect, 2);
  assert.equal(viewer.renderer.domElement.width, 400 * window.devicePixelRatio);
  viewer.viewer.style.height = '0px';
  window.dispatchEvent(new Event('resize'));
  assert(Number.isFinite(viewer.camera.aspect), 'Hidden containers must not produce an invalid camera');
  const renderer = viewer.renderer;
  unmount();
  checkDisposal();
  const lastFrame = renderer.info.render.frame;
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(renderer.info.render.frame, lastFrame, 'Unmount must stop the render loop');

  for (const name of ['empty.obj', 'broken.stl', 'nan.obj', 'point.obj', 'missing.stl']) {
    show(files[name] || path.join(root, name));
    await waitFor(() => viewer.state.error, name + ' must fail visibly');
    assert(!viewer.state.isReady && !viewer.state.isLoading);
    assert(!document.querySelector('canvas, .lil-gui'));
    unmount();
  }
  const ungranted = path.join(root, 'ungranted.stl');
  fs.writeFileSync(ungranted, stl);
  show(ungranted);
  await waitFor(() => viewer.state.error, 'Unknown files must remain denied by the main process');
  unmount();

  show(files['ascii.stl'], 'ply');
  await waitFor(() => viewer.state.error, 'Unsupported model types must fail visibly');
  assert(!document.querySelector('canvas, .lil-gui'));
  unmount();

  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    return type === 'webgl2' ? null : getContext.call(this, type, ...args);
  };
  try {
    show(files['ascii.stl']);
    await waitFor(() => viewer.state.error, 'Missing WebGL 2 must show a useful message');
    assert(viewer.state.error.includes('WebGL 2'));
    assert(!document.querySelector('canvas, .lil-gui'));
  } finally {
    unmount();
    HTMLCanvasElement.prototype.getContext = getContext;
  }

  const read = desktop.readDocument;
  let finish;
  desktop.readDocument = (filename) =>
    filename === 'delayed.stl'
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : read(filename);
  try {
    show('delayed.stl');
    show(files['parts.obj']);
    await loaded();
    const current = viewer.mesh;
    finish(new TextEncoder().encode(stl));
    await tick();
    assert.equal(viewer.mesh, current, 'Late data must not replace the newly selected model');
    checkDisposal = observeDisposal(viewer);
    unmount();
    checkDisposal();
    show('delayed.stl');
    unmount();
    finish(new TextEncoder().encode(stl));
    await tick();
    assert(!document.querySelector('canvas, .lil-gui'), 'Late data must not recreate an unmounted viewer');
  } finally {
    desktop.readDocument = read;
    unmount();
    style.remove();
  }
  return 'WebGL 2 STL/OBJ pixels, Unicode paths, color/mesh controls, zoom/resize, denied/corrupt files, missing WebGL, source races and resource disposal';
}
