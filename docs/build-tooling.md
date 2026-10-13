# Node 24 and Webpack 5 migration

The build host uses Node 24.21.0, pinned in `.node-version`, with the checked-in
Yarn 3.2.0 and immutable lockfile. CI and the packaging script use the same Node
pin. No OpenSSL legacy-provider option is needed.

This stage updates Webpack to 5.111.1 and its CLI, middleware, merge utility,
Babel loader, asset-copy plugin, environment plugin, minifier and stylesheet
loaders. PostCSS 8 uses the existing RTL plugin's compatible 2.0 release. The
Sass compiler stays at the RC3 lock's 1.53.0; it is passed explicitly to the new
loader because its older CommonJS export is not recognized by automatic ESM
discovery. Sass language/output changes are a separate migration.

That build-tooling migration kept Electron 17.2.0, React and the SDK pin at their
RC3 versions. The [subsequent runtime migration](electron-runtime.md) moves to
the supported Electron 44.7.0 release. Packaging and
updater changes are described in [their migration notes](packaging-updater.md).
Updating build-host Node does not update the Node or
Chromium embedded in Electron. RC3 remains the published regression baseline;
these source changes are not part of its packages.

## Compatibility changes

- The desktop already uses explicit Webpack configs and an Express development
  server. The unused `electron-webpack`, `webpack-dev-server`, analyzer and
  Node-externals dependencies are removed.
- Webpack asset modules replace the file and raw loaders. Images keep the
  `img/[name][ext]` paths and shaders remain strings. Explicit empty public paths
  preserve relative URLs when production pages load through `file://`.
- The merge utility uses its named `merge` export. Removed minifier and
  middleware options are replaced with the supported configuration.
- PostCSS plugins move into `postcssOptions`. Config discovery is disabled for
  this pipeline: the old desktop loader's explicit plugins also bypassed the
  root PostCSS config. Enabling that config would introduce unrelated imports
  and minification changes.
- The environment plugin's browser stub is disabled because Electron provides
  a real runtime `process.env`. Replacing it breaks `electron-is-dev` and other
  environment checks. Build-time definitions still use the existing defaults.
- JSON metadata uses default imports, as required by the updated bundler.
- Development launch waits for both compilations, forwards profile arguments
  to Electron, binds locally, and closes watchers when the application exits.
  `--skip-devtools` avoids downloading developer extensions during smoke tests.
  It opens the application directory with the corrected package entry point so
  Electron reads the app version. Launching a bare JavaScript file left Linux
  with version `0.0`, which the updater rejected during startup.
- Development translation collection can write to `LBRY_I18N_OUTPUT_FILE`.
  The smoke test seeds this file in its disposable profile so collection still
  runs without changing `static/app-strings.json` in the source checkout.

## Validation

The existing Windows/Linux regression matrix remains mandatory. The renderer
suite now also imports the actual application styles and checks the dark/light
theme colors, primary button styling, RTL margins and padding, stylesheet image
URLs, emitted images, shader strings, lazy chunks and runtime environment access.
It uses the production output configuration, including asset paths.

After building, `node build/testPackagedDesktop.js` tests the packaged app.
`node build/testPackagedDesktop.js --development` additionally compiles and
launches the real development app against the same local hub fixture, with a
new disposable profile. It checks hub selection before wallet creation, an
unfunded wallet sync and clean desktop/SDK shutdown. Setup screenshots and
results are kept in `dist/ci`; no personal wallet is used.

The compiler still reports the inherited `PAGES.PUBLISHED` and
`PAGES.DOWNLOADED` references in `file_info.js`; those constants were already
absent in RC3. They are not suppressed or changed in this tooling migration.
Legacy dependency deprecation notices and the old application lint/Flow
baseline are not a claim of a fully modernized runtime.
