# Shared UI dependency upgrades

| Dependency | Previous lockfile | Updated |
| --- | --- | --- |
| react-modal | 3.15.1 | 3.16.3 |
| react-draggable | 3.3.2 | 4.7.2 |
| react-paginate | 5.3.1 | 8.3.0 |
| qrcode.react | 0.8.0 | 4.2.0 |
| rc-progress | 2.6.1 | 4.0.0 |
| imagesloaded | 4.1.4 | 5.0.0 |
| classnames | 2.3.1 | 2.5.1 |

All seven support the current React 16.14 renderer. Existing styles and component
wrappers remain in use.

## Compatibility changes

- QR rendering uses the named `QRCodeCanvas` export, adds a four-module quiet
  margin for scanning, and waits for a nonempty receive address. Its canvas size
  and black-on-white colors remain unchanged.
- Pagination uses only `forcePage`. The wrapper retains the initial fetch callback
  even when controls are hidden during loading. Back navigation to a URL without
  a page resets selection to page one; go-to rejects fractional page numbers.
- The floating player passes its DOM ref to Draggable. The renderer's existing
  process shim uses a fully resolved path so the new ESM build can import it.
- Dialogs retain their focus trap, focus restoration and cancellation behavior.
  The download dialog continues using the progress library's `Line` component;
  the changed circle-step API is not used.
- Thumbnail initialization ignores failed image loads, which cannot be drawn to
  a canvas. Successful loads still create the frozen frame and hover controls.

## Regression coverage

`node build/testRenderer.js` runs the real wrappers in Electron, including wallet
receive-address changes decoded from canvas pixels by the independent jsQR 1.4.0
decoder. jsQR is a development dependency; package verification rejects it in the
application archive. The suite also checks pagination callbacks/navigation,
dialog keyboard focus and dismissal, update progress and controls, floating-player
drag/persistence, and thumbnail load/failure handling.

Existing wallet backup/encryption, OS-protected password migration/restart/forget,
updater consent/shutdown, old saved-state and sandbox checks run alongside these
tests. Windows/Linux CI verifies packaging and startup; the separate hosted
Windows job performs real upgrades from the published RC3 through two private
candidates with a disposable unfunded wallet.

Physical QR scanning, touch dragging and a manual visual acceptance pass remain
outside the automated checks.

Release references: [QR code export changes](https://github.com/zpao/qrcode.react/releases),
[pagination changes](https://github.com/AdeleD/react-paginate/blob/master/CHANGELOG.md),
[dragging changes](https://github.com/react-grid-layout/react-draggable/blob/master/CHANGELOG.md),
[dialog changes](https://github.com/reactjs/react-modal/blob/master/CHANGELOG.md).
