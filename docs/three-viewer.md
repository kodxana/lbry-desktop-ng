# 3D viewer dependencies

Replace three-full 28.0.2 (Three.js r113) with upstream three 0.186.1, and
dat.gui 0.7.9 with lil-gui 0.21.0. Remove the unused @types/three 0.103.2
dependency, its extra Three.js runtime, and obsolete generated Flow declarations.
The viewer still supports STL and OBJ; its material, rotation and reset controls
remain available. Detailed Three.js Flow types remain unmodeled.

## Compatibility changes

Modern Three.js requires WebGL 2. Unsupported machines receive an explicit
preview message instead of an endless loader. The test runners use software
WebGL to exercise real rendering without depending on a particular GPU; these
flags do not change the production app's graphics or sandbox configuration.

Use the upstream STLLoader and OBJLoader ES modules. OBJLoader returns a Group,
replacing OBJLoader2's event wrapper. Models now stay in BufferGeometry;
BufferGeometryUtils.mergeVertices and recomputed normals replace the removed
Geometry conversion. The material uses boolean vertexColors, and the renderer
uses sRGB output instead of removed gamma flags. Lighting follows the current
Three.js pipeline, so exact shading can differ from the old engine.

Read model bytes through the existing authorized desktop file service before
parsing. This preserves Windows/Unicode paths containing spaces or # and avoids
unrestricted file URLs. OBJ material/texture references do not initiate network
or filesystem requests; the viewer continues to use its own material controls.

Fit bounds across all three axes and center off-origin models above the grid.
Reject empty and nonfinite geometry. Source changes and unmount invalidate
pending reads. Cleanup stops animation, removes the GUI and controls, and
disposes each geometry/material once before releasing the renderer/context,
including after partial initialization or parser failure. Scene.dispose and
manual assignment of renderer internals are no longer used.

lil-gui keeps the numeric hex color representation and existing closed folders.
The stylesheet targets its new DOM classes. Reset also invalidates the material
shader when restoring flat shading. Existing GUI controls remain over the model
in the desktop's dark viewer.

## Validation

The original viewer first passed a synthetic STL/WebGL baseline. The expanded
renderer fixture now exercises ASCII and binary STL, multipart colored OBJ,
visible model pixels, off-origin bounds, controls/reset, wheel zoom, resizing,
missing WebGL 2, malformed/empty/unauthorized files, late reads and resource
cleanup. It captures dist/ci/three-preview.png with the production stylesheet.
A separate sandbox fixture loads and renders an authorized model through the
production preload with Node globals absent. Network requests are blocked.

These checks run in the Windows/Linux renderer matrix alongside the existing
wallet backup/encryption, saved-password and updater UI regressions. Native
password storage, real SDK backup restoration, production packaging and startup
remain required. Actual installed Windows upgrades run only on hosted runners
with disposable, unfunded wallets.

Hardware-specific graphics drivers are not covered by software rendering.
The application now passes Flow 0.337.0 in required CI. The Three.js runtime
remains partly untyped, so renderer regressions are still required.

References: [Three.js migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide),
[STLLoader](https://threejs.org/docs/pages/STLLoader.html),
[OBJLoader](https://threejs.org/docs/pages/OBJLoader.html),
[WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html),
[lil-gui migration](https://lil-gui.georgealways.com/#Migrating).
