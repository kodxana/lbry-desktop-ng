# Stylesheet compiler

The desktop uses Sass 1.106.1, upgraded from the RC3 lockfile's 1.53.0, through
sass-loader's modern JavaScript API. Its existing PostCSS 8 RTL transform stays
in place. Sass is a build dependency; the packaged renderer receives CSS.

The unused `cssnano`, `postcss-import` and `css-doodle` dependencies and the old
root PostCSS config are removed. The desktop's explicit loader configuration
never loaded that config. No CSS minifier or new import transform is enabled.

## Declaration order

Sass now emits declarations after nested rules in source order. Previously it
hoisted them ahead of the nested rules. In `.card__main-actions.settings__row`,
that made the default bottom padding override the narrow-window `padding: 0`
rule. Moving the default before the media query preserves the existing layout.

The main stylesheet was compiled before and after the upgrade. Both outputs
contain 7,176 declarations; changes include nested-rule ordering, formatting,
string quoting and equivalent `calc()` simplifications. The responsive fixture
passed against the captured old output, failed against the new output before
the settings fix, and passed against the corrected output.

`build/tests/stylesheets.jsx` uses the actual bundled styles in an iframe with
480, 900, 1280 and 1700-pixel viewports. It checks settings and action spacing,
thumbnail dimensions, storage bars and onboarding layout in dark/light themes
and LTR/RTL directions. Existing renderer checks also verify theme colors,
buttons, image paths, documents and interactive controls.

The development smoke test edits an imported Sass partial and waits for the
heading color to change, without reloading the document or losing an unfinished
hub form. It restores the source in `finally` and checks that the original color
returns. A concurrent source edit causes a failure instead of being overwritten.

## Remaining work and validation

The Sass `@import` graph is retained. Its deprecation warnings remain visible;
moving these stylesheets to modules needs a separate review of shared variables,
repeated CSS and cascade order. This upgrade does not claim Sass 3 readiness.

The required Windows/Linux matrix includes renderer and sandbox regressions,
wallet backup/encryption, native password migration/restart/Forget, SDK isolation,
packaging and packaged/development startup. The separate hosted Windows job
tests real installed upgrades and update decline/install/shutdown behavior.
These use disposable, unfunded wallets. macOS and exhaustive visual comparisons
of every application page are outside this coverage.

References: [Sass breaking changes](https://sass-lang.com/documentation/breaking-changes/),
[mixed declarations](https://sass-lang.com/documentation/breaking-changes/mixed-decls/),
and [import deprecation](https://sass-lang.com/documentation/breaking-changes/import/).
