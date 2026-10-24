/* eslint no-console:0 */
function watchRenderer({ window, app, dialog, appState, reportError = console.error }) {
  let pending = false;
  let stopped = false;
  const closing = () => appState.isQuitting || window.isDestroyed();

  window.on('unresponsive', async () => {
    if (pending || stopped || closing()) return;
    pending = true;
    try {
      const { response } = await dialog.showMessageBox(window, {
        type: 'warning',
        buttons: ['Wait', 'Quit'],
        title: 'LBRY Unresponsive',
        defaultId: 0,
        cancelId: 0,
        message: 'LBRY is not responding. Would you like to wait or quit?',
      });
      if (response === 1 && !stopped && !closing()) app.quit();
    } catch (error) {
      reportError('Could not show the unresponsive window dialog:', error);
    } finally {
      pending = false;
    }
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit' || stopped || closing()) return;
    stopped = true;
    try {
      dialog.showErrorBox('LBRY window stopped', 'The application window stopped unexpectedly. Please reopen LBRY.');
    } catch (error) {
      reportError('Could not show the stopped window notice:', error);
    } finally {
      // Use the normal quit lifecycle so the SDK finishes writing its wallet.
      // Do not discard the window or bypass shutdown with app.exit().
      app.quit();
    }
  });
}

module.exports = { watchRenderer };
