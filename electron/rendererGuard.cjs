function documentURL(value) {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  return url.href;
}

function createRendererGuard(getWindow, rendererURL) {
  const expectedURL = documentURL(rendererURL);
  return (event, window = getWindow()) => {
    try {
      return !!(
        window &&
        window === getWindow() &&
        !window.isDestroyed() &&
        !window.webContents.isDestroyed() &&
        event.sender === window.webContents &&
        event.senderFrame === window.webContents.mainFrame &&
        documentURL(event.senderFrame.url) === expectedURL
      );
    } catch (_) {
      return false;
    }
  };
}

module.exports = { createRendererGuard };
